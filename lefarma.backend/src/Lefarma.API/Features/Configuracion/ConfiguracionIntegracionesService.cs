using ErrorOr;
using Lefarma.API.Domain.Entities.Configuracion;
using Lefarma.API.Features.Configuracion.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Configuracion;

/// <summary>
/// Administración de clientes de integración y consulta externa de variables
/// autenticada por API key.
/// </summary>
public sealed class ConfiguracionIntegracionesService : IConfiguracionIntegracionesService
{
    private readonly ApplicationDbContext _context;
    private readonly IIntegracionApiKeyService _apiKeyService;
    private readonly ILogger<ConfiguracionIntegracionesService> _logger;

    public ConfiguracionIntegracionesService(
        ApplicationDbContext context,
        IIntegracionApiKeyService apiKeyService,
        ILogger<ConfiguracionIntegracionesService> logger)
    {
        _context = context;
        _apiKeyService = apiKeyService;
        _logger = logger;
    }

    // -------------------------------------------------------- administración

    public async Task<ErrorOr<List<IntegracionClienteResponse>>> ListarAsync(CancellationToken ct = default)
    {
        var integraciones = await _context.ConfigIntegraciones
            .AsNoTracking()
            .OrderByDescending(i => i.FechaCreacion)
            .ThenBy(i => i.Nombre)
            .ToListAsync(ct);

        return integraciones.Select(Mapear).ToList();
    }

    public async Task<ErrorOr<IntegracionCreadaResponse>> CrearAsync(
        CrearIntegracionRequest request,
        CancellationToken ct = default)
    {
        var nombre = request.Nombre?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(nombre))
        {
            return CommonErrors.Validation("nombre", "El nombre es obligatorio.");
        }

        if (nombre.Length > 200)
        {
            return CommonErrors.Validation("nombre", "El nombre no puede exceder 200 caracteres.");
        }

        if (request.FechaExpiracion.HasValue && request.FechaExpiracion.Value <= DateTime.UtcNow)
        {
            return CommonErrors.Validation("fechaExpiracion", "La fecha de expiración debe ser futura.");
        }

        var claves = IntegracionLlaves.NormalizarClaves(request.ClavesPermitidas);
        if (claves.IsError)
        {
            return claves.Errors;
        }

        var llave = IntegracionLlaves.Generar();

        var entidad = new ConfigIntegracion
        {
            Nombre = nombre,
            PrefijoLlave = IntegracionLlaves.ObtenerPrefijoVisible(llave),
            HashLlave = IntegracionLlaves.CalcularHash(llave),
            ClavesPermitidasJson = IntegracionLlaves.SerializarClaves(claves.Value),
            Activo = true,
            FechaCreacion = DateTime.UtcNow,
            FechaExpiracion = request.FechaExpiracion
        };

        _context.ConfigIntegraciones.Add(entidad);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Se creó el cliente de integración {IdIntegracion} ({Nombre}) con prefijo {Prefijo}.",
            entidad.IdIntegracion,
            entidad.Nombre,
            entidad.PrefijoLlave);

        return new IntegracionCreadaResponse
        {
            IdIntegracion = entidad.IdIntegracion,
            Nombre = entidad.Nombre,
            PrefijoLlave = entidad.PrefijoLlave,
            ClavesPermitidas = IntegracionLlaves.DeserializarClaves(entidad.ClavesPermitidasJson),
            Activo = entidad.Activo,
            FechaCreacion = entidad.FechaCreacion,
            FechaExpiracion = entidad.FechaExpiracion,
            UltimaUtilizacion = entidad.UltimaUtilizacion,
            Llave = llave
        };
    }

    public async Task<ErrorOr<IntegracionClienteResponse>> RevocarAsync(int id, CancellationToken ct = default)
    {
        var entidad = await _context.ConfigIntegraciones.FirstOrDefaultAsync(i => i.IdIntegracion == id, ct);
        if (entidad is null)
        {
            return CommonErrors.NotFound("ConfigIntegracion", id.ToString());
        }

        if (entidad.Activo)
        {
            entidad.Activo = false;
            await _context.SaveChangesAsync(ct);

            _logger.LogInformation(
                "Se revocó el cliente de integración {IdIntegracion} ({Nombre}).",
                entidad.IdIntegracion,
                entidad.Nombre);
        }

        return Mapear(entidad);
    }

    // ------------------------------------------------------- API externa

    public async Task<ErrorOr<IntegracionVariableResponse>> ObtenerVariableAsync(
        string? apiKey,
        string clave,
        CancellationToken ct = default)
    {
        var autenticacion = await _apiKeyService.AutenticarAsync(apiKey, ct);
        if (autenticacion.IsError)
        {
            return autenticacion.Errors;
        }

        if (string.IsNullOrWhiteSpace(clave))
        {
            return CommonErrors.Validation("clave", "La clave es obligatoria.");
        }

        var claveNormalizada = clave.Trim();

        if (!IntegracionLlaves.ClavePermitida(autenticacion.Value.ClavesPermitidas, claveNormalizada))
        {
            return Error.Unauthorized(
                "Integracion.ClaveNoPermitida",
                $"El cliente de integración no tiene acceso a la clave '{claveNormalizada}'.");
        }

        var variable = await _context.ConfigVariables
            .AsNoTracking()
            .FirstOrDefaultAsync(
                v => v.Clave == claveNormalizada && v.Activo && v.DisponibleIntegraciones,
                ct);

        if (variable is null)
        {
            return CommonErrors.NotFound("ConfigVariable", claveNormalizada);
        }

        var revision = await ObtenerRevisionAsync(variable.IdVariable, ct);

        return new IntegracionVariableResponse
        {
            Clave = variable.Clave,
            TipoDato = variable.TipoDato,
            Valor = ConfiguracionJson.Parsear(variable.ValorJson),
            Revision = revision
        };
    }

    public async Task<ErrorOr<IntegracionBatchResponse>> ConsultarVariablesAsync(
        string? apiKey,
        IntegracionConsultarRequest request,
        CancellationToken ct = default)
    {
        var autenticacion = await _apiKeyService.AutenticarAsync(apiKey, ct);
        if (autenticacion.IsError)
        {
            return autenticacion.Errors;
        }

        var claves = (request?.Claves ?? new List<string>())
            .Select(c => c?.Trim())
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => c!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (claves.Count == 0)
        {
            return CommonErrors.Validation("claves", "Debe solicitar al menos una clave.");
        }

        var permitidas = claves
            .Where(c => IntegracionLlaves.ClavePermitida(autenticacion.Value.ClavesPermitidas, c))
            .ToList();

        var respuesta = new IntegracionBatchResponse();

        if (permitidas.Count == 0)
        {
            return respuesta;
        }

        var variables = await _context.ConfigVariables
            .AsNoTracking()
            .Where(v => permitidas.Contains(v.Clave) && v.Activo && v.DisponibleIntegraciones)
            .ToListAsync(ct);

        if (variables.Count == 0)
        {
            return respuesta;
        }

        var ids = variables.Select(v => v.IdVariable).ToList();
        var revisiones = await _context.ConfigVariablesBitacora
            .AsNoTracking()
            .Where(b => ids.Contains(b.IdVariable))
            .GroupBy(b => b.IdVariable)
            .Select(g => new { IdVariable = g.Key, Revision = g.Max(b => b.IdBitacora) })
            .ToDictionaryAsync(x => x.IdVariable, x => x.Revision, ct);

        foreach (var variable in variables.OrderBy(v => v.Clave))
        {
            respuesta.Variables.Add(new IntegracionVariableResponse
            {
                Clave = variable.Clave,
                TipoDato = variable.TipoDato,
                Valor = ConfiguracionJson.Parsear(variable.ValorJson),
                Revision = revisiones.GetValueOrDefault(variable.IdVariable)
            });
        }

        return respuesta;
    }

    private async Task<long> ObtenerRevisionAsync(long idVariable, CancellationToken ct)
        => await _context.ConfigVariablesBitacora
               .AsNoTracking()
               .Where(b => b.IdVariable == idVariable)
               .MaxAsync(b => (long?)b.IdBitacora, ct) ?? 0;

    private static IntegracionClienteResponse Mapear(ConfigIntegracion integracion)
        => new()
        {
            IdIntegracion = integracion.IdIntegracion,
            Nombre = integracion.Nombre,
            PrefijoLlave = integracion.PrefijoLlave,
            ClavesPermitidas = IntegracionLlaves.DeserializarClaves(integracion.ClavesPermitidasJson),
            Activo = integracion.Activo,
            FechaCreacion = integracion.FechaCreacion,
            FechaExpiracion = integracion.FechaExpiracion,
            UltimaUtilizacion = integracion.UltimaUtilizacion
        };
}
