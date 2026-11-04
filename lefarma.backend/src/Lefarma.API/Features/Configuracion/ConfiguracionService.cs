using System.Text.Encodings.Web;
using System.Text.Json;
using ErrorOr;
using Lefarma.API.Domain.Entities.Configuracion;
using Lefarma.API.Features.Auth;
using Lefarma.API.Features.Configuracion.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Lefarma.API.Features.Configuracion;

/// <summary>
/// Servicio principal del módulo Configuración: CRUD de variables globales,
/// bitácora inmutable, restauración de versiones y sincronización con frontend.
/// </summary>
public sealed class ConfiguracionService : IConfiguracionService
{
    private static readonly JsonSerializerOptions SnapshotJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private readonly ApplicationDbContext _context;
    private readonly IConfiguracionRuntimeService _runtime;
    private readonly ISseService _sseService;
    private readonly ILogger<ConfiguracionService> _logger;

    public ConfiguracionService(
        ApplicationDbContext context,
        IConfiguracionRuntimeService runtime,
        ISseService sseService,
        ILogger<ConfiguracionService> logger)
    {
        _context = context;
        _runtime = runtime;
        _sseService = sseService;
        _logger = logger;
    }

    // ---------------------------------------------------------------- listado

    public async Task<ErrorOr<List<ConfigVariableResponse>>> ListarAsync(
        ConfiguracionFiltros filtros,
        CancellationToken ct = default)
    {
        var query = _context.ConfigVariables.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(filtros.Buscar))
        {
            var texto = filtros.Buscar.Trim();
            query = query.Where(v =>
                v.Clave.Contains(texto) ||
                v.Nombre.Contains(texto) ||
                (v.Descripcion != null && v.Descripcion.Contains(texto)));
        }

        if (!string.IsNullOrWhiteSpace(filtros.Tipo))
        {
            var tipo = ConfiguracionTiposDato.Normalizar(filtros.Tipo);
            if (tipo is null || !ConfiguracionTiposDato.EsValido(tipo))
            {
                return CommonErrors.Validation(
                    "tipo",
                    $"El tipo de dato '{filtros.Tipo}' no está soportado.");
            }

            query = query.Where(v => v.TipoDato == tipo);
        }

        var destino = filtros.Destino?.Trim().ToLowerInvariant();
        switch (destino)
        {
            case null or "":
                break;
            case "backend":
                query = query.Where(v => v.DisponibleBackend);
                break;
            case "frontend":
                query = query.Where(v => v.DisponibleFrontend);
                break;
            case "sql":
                query = query.Where(v => v.DisponibleSql);
                break;
            case "integraciones":
                query = query.Where(v => v.DisponibleIntegraciones);
                break;
            default:
                return CommonErrors.Validation(
                    "destino",
                    "El destino debe ser backend, frontend, sql o integraciones.");
        }

        if (filtros.Activo.HasValue)
        {
            query = query.Where(v => v.Activo == filtros.Activo.Value);
        }

        var entidades = await query.OrderBy(v => v.Clave).ToListAsync(ct);
        return entidades.Select(Mapear).ToList();
    }

    public async Task<ErrorOr<ConfigVariableResponse>> ObtenerAsync(long id, CancellationToken ct = default)
    {
        var entidad = await _context.ConfigVariables.AsNoTracking()
            .FirstOrDefaultAsync(v => v.IdVariable == id, ct);

        return entidad is null
            ? CommonErrors.NotFound("ConfigVariable", id.ToString())
            : Mapear(entidad);
    }

    // ------------------------------------------------------------------ crear

    public async Task<ErrorOr<ConfigVariableResponse>> CrearAsync(
        CreateConfigVariableRequest request,
        int? idUsuario,
        CancellationToken ct = default)
    {
        if (request.IdOperacion == Guid.Empty)
        {
            return CommonErrors.Validation("idOperacion", "El identificador de operación es obligatorio.");
        }

        var clave = (request.Clave ?? string.Empty).Trim();

        var previa = await BuscarVariablePorOperacionAsync(request.IdOperacion, ct);
        if (previa is not null)
        {
            if (!string.Equals(previa.Clave, clave, StringComparison.Ordinal))
            {
                return CommonErrors.Conflict(
                    "IdOperacion",
                    "El identificador de operación ya fue utilizado en otra variable.");
            }

            return Mapear(previa);
        }

        var nombre = (request.Nombre ?? string.Empty).Trim();
        var tipo = ConfiguracionTiposDato.Normalizar(request.TipoDato);

        if (string.IsNullOrWhiteSpace(clave))
        {
            return CommonErrors.Validation("clave", "La clave es obligatoria.");
        }

        if (clave.Length > 200)
        {
            return CommonErrors.Validation("clave", "La clave no puede exceder 200 caracteres.");
        }

        if (string.IsNullOrWhiteSpace(nombre))
        {
            return CommonErrors.Validation("nombre", "El nombre es obligatorio.");
        }

        if (nombre.Length > 200)
        {
            return CommonErrors.Validation("nombre", "El nombre no puede exceder 200 caracteres.");
        }

        if (request.Descripcion is { Length: > 1000 })
        {
            return CommonErrors.Validation("descripcion", "La descripción no puede exceder 1000 caracteres.");
        }

        if (tipo is null || !ConfiguracionTiposDato.EsValido(tipo))
        {
            return CommonErrors.Validation(
                "tipoDato",
                $"El tipo de dato '{request.TipoDato}' no está soportado.");
        }

        if (!ConfiguracionReglas.TieneDestino(
                request.DisponibleBackend,
                request.DisponibleFrontend,
                request.DisponibleSql,
                request.DisponibleIntegraciones))
        {
            return SinDestinos();
        }

        var valor = ConfiguracionJson.Normalizar(request.Valor) ?? default;
        var esquema = ConfiguracionJson.Normalizar(request.Esquema);

        var validacion = ConfiguracionValueValidator.Validar(tipo, valor, esquema);
        if (validacion.IsError)
        {
            return validacion.Errors;
        }

        if (await _context.ConfigVariables.AnyAsync(v => v.Clave == clave, ct))
        {
            return CommonErrors.AlreadyExists("ConfigVariable", "clave", clave);
        }

        var ahora = DateTime.UtcNow;
        var entidad = new ConfigVariable
        {
            Clave = clave,
            Nombre = nombre,
            Descripcion = string.IsNullOrWhiteSpace(request.Descripcion) ? null : request.Descripcion.Trim(),
            TipoDato = tipo,
            ValorJson = ConfiguracionJson.Canonicalizar(valor),
            EsquemaJson = esquema.HasValue ? ConfiguracionJson.Canonicalizar(esquema.Value) : null,
            DisponibleBackend = request.DisponibleBackend,
            DisponibleFrontend = request.DisponibleFrontend,
            DisponibleSql = request.DisponibleSql,
            DisponibleIntegraciones = request.DisponibleIntegraciones,
            Activo = true,
            FechaCreacion = ahora,
            FechaModificacion = ahora,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
            Version = 1
        };

        await using var transaccion = await IniciarTransaccionAsync(ct);

        _context.ConfigVariables.Add(entidad);
        var guardado = await GuardarAsync(ct);
        if (guardado.IsError)
        {
            return guardado.Errors;
        }

        var bitacora = new ConfigVariableBitacora
        {
            IdOperacion = request.IdOperacion,
            IdVariable = entidad.IdVariable,
            Clave = entidad.Clave,
            Accion = ConfiguracionAcciones.Crear,
            DatosNuevosJson = ConstruirSnapshot(entidad),
            IdUsuario = idUsuario,
            FechaCreacion = ahora
        };

        _context.ConfigVariablesBitacora.Add(bitacora);
        guardado = await GuardarAsync(ct);
        if (guardado.IsError)
        {
            return guardado.Errors;
        }

        await ConfirmarAsync(transaccion, ct);

        _runtime.Invalidar(entidad.Clave);

        if (entidad.DisponibleFrontend)
        {
            await NotificarCambioAsync(bitacora.IdBitacora, ct);
        }

        return Mapear(entidad);
    }

    // ------------------------------------------------------------- actualizar

    public async Task<ErrorOr<ConfigVariableResponse>> ActualizarAsync(
        long id,
        UpdateConfigVariableRequest request,
        int? idUsuario,
        CancellationToken ct = default)
    {
        var idempotente = await ResolverIdempotenciaAsync(request.IdOperacion, id, ct);
        if (idempotente is { } respuestaIdempotente)
        {
            return respuestaIdempotente;
        }

        var entidad = await _context.ConfigVariables.FirstOrDefaultAsync(v => v.IdVariable == id, ct);
        if (entidad is null)
        {
            return CommonErrors.NotFound("ConfigVariable", id.ToString());
        }

        var inmutables = ConfiguracionReglas.ValidarInmutables(
            entidad.Clave,
            entidad.TipoDato,
            request.Clave,
            request.TipoDato);

        if (inmutables.IsError)
        {
            return inmutables.Errors;
        }

        if (request.VersionEsperada != entidad.Version)
        {
            return CommonErrors.ConcurrencyError("ConfigVariable");
        }

        var nombre = (request.Nombre ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(nombre))
        {
            return CommonErrors.Validation("nombre", "El nombre es obligatorio.");
        }

        if (nombre.Length > 200)
        {
            return CommonErrors.Validation("nombre", "El nombre no puede exceder 200 caracteres.");
        }

        if (request.Descripcion is { Length: > 1000 })
        {
            return CommonErrors.Validation("descripcion", "La descripción no puede exceder 1000 caracteres.");
        }

        if (!ConfiguracionReglas.TieneDestino(
                request.DisponibleBackend,
                request.DisponibleFrontend,
                request.DisponibleSql,
                request.DisponibleIntegraciones))
        {
            return SinDestinos();
        }

        var valor = ConfiguracionJson.Normalizar(request.Valor) ?? default;
        var esquema = ConfiguracionJson.Normalizar(request.Esquema);

        var validacion = ConfiguracionValueValidator.Validar(entidad.TipoDato, valor, esquema);
        if (validacion.IsError)
        {
            return validacion.Errors;
        }

        var eraVisibleFrontend = entidad.Activo && entidad.DisponibleFrontend;
        var datosAnteriores = ConstruirSnapshot(entidad);

        entidad.Nombre = nombre;
        entidad.Descripcion = string.IsNullOrWhiteSpace(request.Descripcion) ? null : request.Descripcion.Trim();
        entidad.ValorJson = ConfiguracionJson.Canonicalizar(valor);
        entidad.EsquemaJson = esquema.HasValue ? ConfiguracionJson.Canonicalizar(esquema.Value) : null;
        entidad.DisponibleBackend = request.DisponibleBackend;
        entidad.DisponibleFrontend = request.DisponibleFrontend;
        entidad.DisponibleSql = request.DisponibleSql;
        entidad.DisponibleIntegraciones = request.DisponibleIntegraciones;
        entidad.Version += 1;
        entidad.FechaModificacion = DateTime.UtcNow;
        entidad.IdUsuarioModificacion = idUsuario;

        await using var transaccion = await IniciarTransaccionAsync(ct);

        var guardado = await GuardarAsync(ct);
        if (guardado.IsError)
        {
            return guardado.Errors;
        }

        var bitacora = await RegistrarBitacoraAsync(
            entidad,
            request.IdOperacion,
            ConfiguracionAcciones.Actualizar,
            datosAnteriores,
            idUsuario,
            null,
            ct);

        if (bitacora.IsError)
        {
            return bitacora.Errors;
        }

        await ConfirmarAsync(transaccion, ct);

        _runtime.Invalidar(entidad.Clave);

        var esVisibleFrontend = entidad.Activo && entidad.DisponibleFrontend;
        if (eraVisibleFrontend || esVisibleFrontend)
        {
            await NotificarCambioAsync(bitacora.Value.IdBitacora, ct);
        }

        return Mapear(entidad);
    }

    // -------------------------------------------------- activar / desactivar

    public Task<ErrorOr<ConfigVariableResponse>> DesactivarAsync(
        long id,
        CambiarEstadoVariableRequest request,
        int? idUsuario,
        CancellationToken ct = default)
        => CambiarEstadoAsync(id, request, idUsuario, activar: false, ct);

    public Task<ErrorOr<ConfigVariableResponse>> ReactivarAsync(
        long id,
        CambiarEstadoVariableRequest request,
        int? idUsuario,
        CancellationToken ct = default)
        => CambiarEstadoAsync(id, request, idUsuario, activar: true, ct);

    private async Task<ErrorOr<ConfigVariableResponse>> CambiarEstadoAsync(
        long id,
        CambiarEstadoVariableRequest request,
        int? idUsuario,
        bool activar,
        CancellationToken ct)
    {
        var idempotente = await ResolverIdempotenciaAsync(request.IdOperacion, id, ct);
        if (idempotente is { } respuestaIdempotente)
        {
            return respuestaIdempotente;
        }

        var entidad = await _context.ConfigVariables.FirstOrDefaultAsync(v => v.IdVariable == id, ct);
        if (entidad is null)
        {
            return CommonErrors.NotFound("ConfigVariable", id.ToString());
        }

        if (request.VersionEsperada != entidad.Version)
        {
            return CommonErrors.ConcurrencyError("ConfigVariable");
        }

        var eraVisibleFrontend = entidad.Activo && entidad.DisponibleFrontend;
        var datosAnteriores = ConstruirSnapshot(entidad);

        entidad.Activo = activar;
        entidad.Version += 1;
        entidad.FechaModificacion = DateTime.UtcNow;
        entidad.IdUsuarioModificacion = idUsuario;

        await using var transaccion = await IniciarTransaccionAsync(ct);

        var guardado = await GuardarAsync(ct);
        if (guardado.IsError)
        {
            return guardado.Errors;
        }

        var bitacora = await RegistrarBitacoraAsync(
            entidad,
            request.IdOperacion,
            activar ? ConfiguracionAcciones.Reactivar : ConfiguracionAcciones.Desactivar,
            datosAnteriores,
            idUsuario,
            null,
            ct);

        if (bitacora.IsError)
        {
            return bitacora.Errors;
        }

        await ConfirmarAsync(transaccion, ct);

        _runtime.Invalidar(entidad.Clave);

        var esVisibleFrontend = entidad.Activo && entidad.DisponibleFrontend;
        if (eraVisibleFrontend || esVisibleFrontend)
        {
            await NotificarCambioAsync(bitacora.Value.IdBitacora, ct);
        }

        return Mapear(entidad);
    }

    // --------------------------------------------------------------- historial

    public async Task<ErrorOr<List<BitacoraResumenResponse>>> ObtenerHistorialAsync(
        long id,
        CancellationToken ct = default)
    {
        if (!await _context.ConfigVariables.AnyAsync(v => v.IdVariable == id, ct))
        {
            return CommonErrors.NotFound("ConfigVariable", id.ToString());
        }

        return await _context.ConfigVariablesBitacora
            .AsNoTracking()
            .Where(b => b.IdVariable == id)
            .OrderByDescending(b => b.IdBitacora)
            .Select(b => new BitacoraResumenResponse
            {
                IdBitacora = b.IdBitacora,
                IdVariable = b.IdVariable,
                Clave = b.Clave,
                Accion = b.Accion,
                IdBitacoraOrigen = b.IdBitacoraOrigen,
                IdUsuario = b.IdUsuario,
                FechaCreacion = b.FechaCreacion
            })
            .ToListAsync(ct);
    }

    public async Task<ErrorOr<BitacoraDetalleResponse>> ObtenerHistorialDetalleAsync(
        long id,
        long idBitacora,
        CancellationToken ct = default)
    {
        var entrada = await _context.ConfigVariablesBitacora
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.IdBitacora == idBitacora && b.IdVariable == id, ct);

        if (entrada is null)
        {
            return CommonErrors.NotFound("ConfigVariableBitacora", idBitacora.ToString());
        }

        return new BitacoraDetalleResponse
        {
            IdBitacora = entrada.IdBitacora,
            IdVariable = entrada.IdVariable,
            Clave = entrada.Clave,
            Accion = entrada.Accion,
            IdBitacoraOrigen = entrada.IdBitacoraOrigen,
            IdUsuario = entrada.IdUsuario,
            FechaCreacion = entrada.FechaCreacion,
            IdOperacion = entrada.IdOperacion,
            DatosAnteriores = string.IsNullOrWhiteSpace(entrada.DatosAnterioresJson)
                ? null
                : ConfiguracionJson.Parsear(entrada.DatosAnterioresJson),
            DatosNuevos = ConfiguracionJson.Parsear(entrada.DatosNuevosJson)
        };
    }

    // ------------------------------------------------------------- restauración

    public async Task<ErrorOr<ConfigVariableResponse>> RestaurarAsync(
        long id,
        RestaurarVariableRequest request,
        int? idUsuario,
        CancellationToken ct = default)
    {
        var idempotente = await ResolverIdempotenciaAsync(request.IdOperacion, id, ct);
        if (idempotente is { } respuestaIdempotente)
        {
            return respuestaIdempotente;
        }

        var entidad = await _context.ConfigVariables.FirstOrDefaultAsync(v => v.IdVariable == id, ct);
        if (entidad is null)
        {
            return CommonErrors.NotFound("ConfigVariable", id.ToString());
        }

        if (request.VersionEsperada != entidad.Version)
        {
            return CommonErrors.ConcurrencyError("ConfigVariable");
        }

        var origen = await _context.ConfigVariablesBitacora
            .AsNoTracking()
            .FirstOrDefaultAsync(
                b => b.IdBitacora == request.IdBitacoraOrigen && b.IdVariable == id,
                ct);

        if (origen is null)
        {
            return CommonErrors.NotFound("ConfigVariableBitacora", request.IdBitacoraOrigen.ToString());
        }

        var extraidos = ConfiguracionReglas.ExtraerRestaurables(origen.DatosNuevosJson);
        if (extraidos.IsError)
        {
            return extraidos.Errors;
        }

        var valores = extraidos.Value;

        var nombre = string.IsNullOrWhiteSpace(valores.Nombre) ? entidad.Nombre : valores.Nombre.Trim();
        var descripcion = valores.DescripcionDefinida
            ? (string.IsNullOrWhiteSpace(valores.Descripcion) ? null : valores.Descripcion.Trim())
            : entidad.Descripcion;

        var valor = valores.Valor ?? ConfiguracionJson.Parsear(entidad.ValorJson);
        var esquema = valores.EsquemaDefinido
            ? valores.Esquema
            : ConfiguracionJson.ParsearEsquema(entidad.EsquemaJson);

        var disponibleBackend = valores.DisponibleBackend ?? entidad.DisponibleBackend;
        var disponibleFrontend = valores.DisponibleFrontend ?? entidad.DisponibleFrontend;
        var disponibleSql = valores.DisponibleSql ?? entidad.DisponibleSql;
        var disponibleIntegraciones = valores.DisponibleIntegraciones ?? entidad.DisponibleIntegraciones;

        if (!ConfiguracionReglas.TieneDestino(
                disponibleBackend,
                disponibleFrontend,
                disponibleSql,
                disponibleIntegraciones))
        {
            return SinDestinos();
        }

        var validacion = ConfiguracionValueValidator.Validar(entidad.TipoDato, valor, esquema);
        if (validacion.IsError)
        {
            return validacion.Errors;
        }

        var eraVisibleFrontend = entidad.Activo && entidad.DisponibleFrontend;
        var datosAnteriores = ConstruirSnapshot(entidad);

        entidad.Nombre = nombre;
        entidad.Descripcion = descripcion;
        entidad.ValorJson = ConfiguracionJson.Canonicalizar(valor);
        entidad.EsquemaJson = esquema.HasValue ? ConfiguracionJson.Canonicalizar(esquema.Value) : null;
        entidad.DisponibleBackend = disponibleBackend;
        entidad.DisponibleFrontend = disponibleFrontend;
        entidad.DisponibleSql = disponibleSql;
        entidad.DisponibleIntegraciones = disponibleIntegraciones;
        entidad.Version += 1;
        entidad.FechaModificacion = DateTime.UtcNow;
        entidad.IdUsuarioModificacion = idUsuario;

        await using var transaccion = await IniciarTransaccionAsync(ct);

        var guardado = await GuardarAsync(ct);
        if (guardado.IsError)
        {
            return guardado.Errors;
        }

        var bitacora = await RegistrarBitacoraAsync(
            entidad,
            request.IdOperacion,
            ConfiguracionAcciones.Restaurar,
            datosAnteriores,
            idUsuario,
            origen.IdBitacora,
            ct);

        if (bitacora.IsError)
        {
            return bitacora.Errors;
        }

        await ConfirmarAsync(transaccion, ct);

        _runtime.Invalidar(entidad.Clave);

        var esVisibleFrontend = entidad.Activo && entidad.DisponibleFrontend;
        if (eraVisibleFrontend || esVisibleFrontend)
        {
            await NotificarCambioAsync(bitacora.Value.IdBitacora, ct);
        }

        return Mapear(entidad);
    }

    // ------------------------------------------------------ frontend (sync)

    public async Task<ErrorOr<FrontendSyncResponse>> ConsultarFrontendAsync(
        FrontendConsultarRequest request,
        CancellationToken ct = default)
    {
        var claves = (request.Variables ?? new List<FrontendConsultaClave>())
            .Select(v => v.Clave?.Trim())
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => c!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var respuesta = new FrontendSyncResponse
        {
            RevisionActual = await ObtenerRevisionActualAsync(ct)
        };

        if (claves.Count == 0)
        {
            return respuesta;
        }

        var variables = await _context.ConfigVariables
            .AsNoTracking()
            .Where(v => claves.Contains(v.Clave))
            .ToListAsync(ct);

        var ids = variables.Select(v => v.IdVariable).ToList();
        var revisiones = new Dictionary<long, long>();

        if (ids.Count > 0)
        {
            var filas = await _context.ConfigVariablesBitacora
                .AsNoTracking()
                .Where(b => ids.Contains(b.IdVariable))
                .GroupBy(b => b.IdVariable)
                .Select(g => new { IdVariable = g.Key, Revision = g.Max(b => b.IdBitacora) })
                .ToListAsync(ct);

            revisiones = filas.ToDictionary(f => f.IdVariable, f => f.Revision);
        }

        var porClave = variables.ToDictionary(v => v.Clave, v => v, StringComparer.OrdinalIgnoreCase);

        foreach (var clave in claves)
        {
            if (!porClave.TryGetValue(clave, out var variable) ||
                !variable.Activo ||
                !variable.DisponibleFrontend)
            {
                respuesta.Eliminadas.Add(clave);
                continue;
            }

            respuesta.Variables.Add(new FrontendVariableEntry
            {
                Clave = variable.Clave,
                TipoDato = variable.TipoDato,
                Valor = ConfiguracionJson.Parsear(variable.ValorJson),
                Revision = revisiones.GetValueOrDefault(variable.IdVariable)
            });
        }

        return respuesta;
    }

    public async Task<ErrorOr<FrontendSyncResponse>> SincronizarFrontendAsync(
        FrontendSyncRequest request,
        CancellationToken ct = default)
    {
        var respuesta = new FrontendSyncResponse
        {
            RevisionActual = await ObtenerRevisionActualAsync(ct)
        };

        if (request.Desde >= respuesta.RevisionActual)
        {
            return respuesta;
        }

        var claves = (request.Claves ?? new List<string>())
            .Select(c => c?.Trim())
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => c!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var consulta =
            from b in _context.ConfigVariablesBitacora.AsNoTracking()
            join v in _context.ConfigVariables.AsNoTracking() on b.IdVariable equals v.IdVariable
            where b.IdBitacora > request.Desde
            select new
            {
                b.IdBitacora,
                b.IdVariable,
                v.Clave,
                v.TipoDato,
                v.ValorJson,
                v.Activo,
                v.DisponibleFrontend
            };

        if (claves.Count > 0)
        {
            consulta = consulta.Where(x => claves.Contains(x.Clave));
        }

        var filas = await consulta.ToListAsync(ct);

        foreach (var grupo in filas.GroupBy(f => f.IdVariable))
        {
            var ultima = grupo.OrderByDescending(f => f.IdBitacora).First();

            if (!ultima.Activo || !ultima.DisponibleFrontend)
            {
                respuesta.Eliminadas.Add(ultima.Clave);
                continue;
            }

            respuesta.Variables.Add(new FrontendVariableEntry
            {
                Clave = ultima.Clave,
                TipoDato = ultima.TipoDato,
                Valor = ConfiguracionJson.Parsear(ultima.ValorJson),
                Revision = ultima.IdBitacora
            });
        }

        return respuesta;
    }

    // ---------------------------------------------------------------- helpers

    private async Task<long> ObtenerRevisionActualAsync(CancellationToken ct)
        => await _context.ConfigVariablesBitacora
               .AsNoTracking()
               .MaxAsync(b => (long?)b.IdBitacora, ct) ?? 0;

    private async Task<ConfigVariable?> BuscarVariablePorOperacionAsync(Guid idOperacion, CancellationToken ct)
    {
        var bitacora = await ObtenerOperacionAsync(idOperacion, ct);
        if (bitacora is null)
        {
            return null;
        }

        return await _context.ConfigVariables.AsNoTracking()
            .FirstOrDefaultAsync(v => v.IdVariable == bitacora.IdVariable, ct);
    }

    private async Task<ConfigVariableBitacora?> ObtenerOperacionAsync(Guid idOperacion, CancellationToken ct)
    {
        if (idOperacion == Guid.Empty)
        {
            return null;
        }

        return await _context.ConfigVariablesBitacora.AsNoTracking()
            .FirstOrDefaultAsync(b => b.IdOperacion == idOperacion, ct);
    }

    private async Task<ErrorOr<ConfigVariableResponse>?> ResolverIdempotenciaAsync(
        Guid idOperacion,
        long id,
        CancellationToken ct)
    {
        if (idOperacion == Guid.Empty)
        {
            return CommonErrors.Validation("idOperacion", "El identificador de operación es obligatorio.");
        }

        var operacion = await ObtenerOperacionAsync(idOperacion, ct);
        if (operacion is null)
        {
            return null;
        }

        if (operacion.IdVariable != id)
        {
            return CommonErrors.Conflict(
                "IdOperacion",
                "El identificador de operación ya fue utilizado en otra variable.");
        }

        var previa = await _context.ConfigVariables.AsNoTracking()
            .FirstOrDefaultAsync(v => v.IdVariable == id, ct);

        if (previa is null)
        {
            return CommonErrors.NotFound("ConfigVariable", id.ToString());
        }

        return Mapear(previa);
    }

    private async Task<ErrorOr<ConfigVariableBitacora>> RegistrarBitacoraAsync(
        ConfigVariable entidad,
        Guid idOperacion,
        string accion,
        string? datosAnterioresJson,
        int? idUsuario,
        long? idBitacoraOrigen,
        CancellationToken ct)
    {
        var bitacora = new ConfigVariableBitacora
        {
            IdOperacion = idOperacion,
            IdVariable = entidad.IdVariable,
            Clave = entidad.Clave,
            Accion = accion,
            DatosAnterioresJson = datosAnterioresJson,
            DatosNuevosJson = ConstruirSnapshot(entidad),
            IdBitacoraOrigen = idBitacoraOrigen,
            IdUsuario = idUsuario,
            FechaCreacion = DateTime.UtcNow
        };

        _context.ConfigVariablesBitacora.Add(bitacora);

        var guardado = await GuardarAsync(ct);
        return guardado.IsError ? guardado.Errors : bitacora;
    }

    private async Task<IDbContextTransaction?> IniciarTransaccionAsync(CancellationToken ct)
    {
        // El proveedor InMemory (pruebas) no soporta transacciones; en SQL Server siempre se usa.
        return _context.Database.IsRelational()
            ? await _context.Database.BeginTransactionAsync(ct)
            : null;
    }

    private static async Task ConfirmarAsync(IDbContextTransaction? transaccion, CancellationToken ct)
    {
        if (transaccion is not null)
        {
            await transaccion.CommitAsync(ct);
        }
    }

    private async Task<ErrorOr<Success>> GuardarAsync(CancellationToken ct)
    {
        try
        {
            await _context.SaveChangesAsync(ct);
            return Result.Success;
        }
        catch (DbUpdateConcurrencyException)
        {
            return CommonErrors.ConcurrencyError("ConfigVariable");
        }
    }

    private async Task NotificarCambioAsync(long revision, CancellationToken ct)
    {
        try
        {
            await _sseService.BroadcastAsync("configuracion.changed", new { Revision = revision }, ct);
        }
        catch (Exception ex)
        {
            // Un fallo al notificar nunca debe tumbar la mutación ya confirmada.
            _logger.LogWarning(ex,
                "No se pudo emitir el evento SSE configuracion.changed (revisión {Revision}).",
                revision);
        }
    }

    private static Error SinDestinos()
        => CommonErrors.Validation(
            "disponibleBackend",
            "La variable debe estar disponible al menos en un destino (backend, frontend, sql o integraciones).");

    private static string ConstruirSnapshot(ConfigVariable variable)
    {
        var snapshot = new ConfiguracionSnapshot(
            variable.IdVariable,
            variable.Clave,
            variable.Nombre,
            variable.Descripcion,
            variable.TipoDato,
            ConfiguracionJson.Parsear(variable.ValorJson),
            ConfiguracionJson.ParsearEsquema(variable.EsquemaJson),
            variable.DisponibleBackend,
            variable.DisponibleFrontend,
            variable.DisponibleSql,
            variable.DisponibleIntegraciones,
            variable.Activo,
            variable.Version);

        return JsonSerializer.Serialize(snapshot, SnapshotJsonOptions);
    }

    private static ConfigVariableResponse Mapear(ConfigVariable variable)
        => new()
        {
            IdVariable = variable.IdVariable,
            Clave = variable.Clave,
            Nombre = variable.Nombre,
            Descripcion = variable.Descripcion,
            TipoDato = variable.TipoDato,
            Valor = ConfiguracionJson.Parsear(variable.ValorJson),
            Esquema = ConfiguracionJson.ParsearEsquema(variable.EsquemaJson),
            DisponibleBackend = variable.DisponibleBackend,
            DisponibleFrontend = variable.DisponibleFrontend,
            DisponibleSql = variable.DisponibleSql,
            DisponibleIntegraciones = variable.DisponibleIntegraciones,
            Activo = variable.Activo,
            Version = variable.Version,
            FechaCreacion = variable.FechaCreacion,
            FechaModificacion = variable.FechaModificacion,
            IdUsuarioCreacion = variable.IdUsuarioCreacion,
            IdUsuarioModificacion = variable.IdUsuarioModificacion
        };
}
