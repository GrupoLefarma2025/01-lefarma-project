using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Features.Profile;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.EducacionMedica;

/// <summary>
/// Impartición de talleres (ADR-00008, revisión 2026-10-09): material (FOR-007),
/// asistencias (FOR-008), evidencias, máquina de estados con historial e imprimibles.
/// Sin workflow: las transiciones se validan aquí.
/// </summary>
public class TallerImparticionService : ITallerImparticionService
{
    private const string RolGerenteVentas = "Gerente de Ventas";
    private const string RolAem = "Auxiliar Administrativo Educación Médica";
    private const string RolCem = "Coordinador de Educación Médica";

    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly IProfileService _profileService;
    private readonly ILogger<TallerImparticionService> _logger;

    public TallerImparticionService(
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        IProfileService profileService,
        ILogger<TallerImparticionService> logger)
    {
        _context = context;
        _asokamContext = asokamContext;
        _profileService = profileService;
        _logger = logger;
    }

    // ----- Material (FOR-007) -----

    public async Task<TallerMaterialDto?> GetMaterialAsync(int idTaller, CancellationToken ct = default)
    {
        _ = await ObtenerTallerAsync(idTaller, ct);

        var material = await _context.TalleresMateriales.AsNoTracking()
            .FirstOrDefaultAsync(m => m.IdTaller == idTaller, ct);

        return material is null ? null : await ArmarMaterialDtoAsync(material, ct);
    }

    public async Task<TallerMaterialDto> GuardarMaterialAsync(int idTaller, GuardarTallerMaterialRequest request, int idUsuario, CancellationToken ct = default)
    {
        _ = await ObtenerTallerAsync(idTaller, ct);

        var material = await _context.TalleresMateriales
            .FirstOrDefaultAsync(m => m.IdTaller == idTaller, ct);

        if (material is null)
        {
            material = new TallerMaterial
            {
                IdTaller = idTaller,
                IdUsuarioCreacion = idUsuario,
            };
            _context.TalleresMateriales.Add(material);
        }

        material.FechaEntrega = request.FechaEntrega;
        material.CargoPuesto = request.CargoPuesto;
        material.NombreProducto = request.NombreProducto;
        material.CantidadProducto = request.CantidadProducto;
        material.IncluyeListaAsistencia = request.IncluyeListaAsistencia;
        material.IncluyeFlayers = request.IncluyeFlayers;
        material.IncluyeEquipoComputo = request.IncluyeEquipoComputo;
        material.IncluyeProyector = request.IncluyeProyector;
        material.IncluyeDulces = request.IncluyeDulces;
        material.IncluyeModeloAnatomico = request.IncluyeModeloAnatomico;
        material.NombreEjecutivoRecepcion = request.NombreEjecutivoRecepcion;
        material.Observaciones = request.Observaciones;
        material.IdUsuarioModificacion = idUsuario;
        material.FechaModificacion = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Material del taller {IdTaller} registrado/actualizado por el usuario {IdUsuario}.",
            idTaller, idUsuario);

        return await ArmarMaterialDtoAsync(material, ct);
    }

    public async Task<TallerMaterialDto> ConfirmarMaterialAsync(int idTaller, ConfirmarMaterialRequest request, int idUsuario, CancellationToken ct = default)
    {
        var taller = await ObtenerTallerAsync(idTaller, ct);
        ValidarMiembroEquipo(taller, idUsuario, "confirmar la recepción del material");

        var material = await _context.TalleresMateriales
            .FirstOrDefaultAsync(m => m.IdTaller == idTaller, ct)
            ?? throw new InvalidOperationException("El taller no tiene material registrado por el AEM.");

        if (material.FechaRecepcion.HasValue)
        {
            throw new InvalidOperationException("La recepción del material ya fue confirmada.");
        }

        // Patrón bitácora: la firma digital es la del perfil del usuario que confirma.
        var tieneFirma = await _profileService.HasFirmaAsync(idUsuario, ct);
        if (tieneFirma.IsError || !tieneFirma.Value)
        {
            throw new InvalidOperationException(
                "El usuario no tiene una firma digital registrada. Cárguela en Configuración > Perfil para continuar.");
        }

        var firmaUrl = await _context.UsuariosDetalle.AsNoTracking()
            .Where(ud => ud.IdUsuario == idUsuario)
            .Select(ud => ud.FirmaPath)
            .FirstOrDefaultAsync(ct);

        material.FirmaUrl = firmaUrl;
        material.FechaRecepcion = DateTime.UtcNow;
        material.IdUsuarioRecepcion = idUsuario;
        material.IdUsuarioModificacion = idUsuario;
        material.FechaModificacion = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(request.NombreEjecutivoRecepcion))
        {
            material.NombreEjecutivoRecepcion = request.NombreEjecutivoRecepcion;
        }

        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Recepción del material del taller {IdTaller} confirmada por el usuario {IdUsuario}.",
            idTaller, idUsuario);

        return await ArmarMaterialDtoAsync(material, ct);
    }

    // ----- Asistencias (FOR-008) -----

    public async Task<List<TallerAsistenciaDto>> GetAsistenciasAsync(int idTaller, CancellationToken ct = default)
    {
        _ = await ObtenerTallerAsync(idTaller, ct);

        return await _context.TalleresAsistencias.AsNoTracking()
            .Where(a => a.IdTaller == idTaller)
            .OrderBy(a => a.Numero)
            .Select(a => ArmarAsistenciaDto(a))
            .ToListAsync(ct);
    }

    public async Task<TallerAsistenciaDto> CrearAsistenciaAsync(int idTaller, GuardarTallerAsistenciaRequest request, int idUsuario, CancellationToken ct = default)
    {
        var taller = await ObtenerTallerAsync(idTaller, ct);
        ValidarMiembroEquipo(taller, idUsuario, "capturar asistencias");
        ValidarVentanaAsistencias(taller);

        var existentes = await _context.TalleresAsistencias
            .Where(a => a.IdTaller == idTaller)
            .ToListAsync(ct);

        if (existentes.Count >= TallerAsistencia.MaximoAsistentes)
        {
            throw new InvalidOperationException(
                $"La lista de asistencia ya alcanzó el máximo de {TallerAsistencia.MaximoAsistentes} asistentes (FOR-008).");
        }

        if (existentes.Any(a => a.Numero == request.Numero))
        {
            throw new InvalidOperationException($"El número {request.Numero} ya está usado en la lista de asistencia.");
        }

        var asistencia = new TallerAsistencia
        {
            IdTaller = idTaller,
            Numero = request.Numero,
            NombreMedico = request.NombreMedico.Trim(),
            CedulaProfesional = request.CedulaProfesional,
            PuestoMedico = request.PuestoMedico,
            TelefonoCelular = request.TelefonoCelular,
            CorreoElectronico = request.CorreoElectronico,
            Observaciones = request.Observaciones,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
            FechaCreacion = DateTime.UtcNow,
            FechaModificacion = DateTime.UtcNow,
        };

        _context.TalleresAsistencias.Add(asistencia);
        await _context.SaveChangesAsync(ct);

        return ArmarAsistenciaDto(asistencia);
    }

    public async Task<TallerAsistenciaDto> ActualizarAsistenciaAsync(int idTaller, int idAsistencia, GuardarTallerAsistenciaRequest request, int idUsuario, CancellationToken ct = default)
    {
        var taller = await ObtenerTallerAsync(idTaller, ct);
        ValidarMiembroEquipo(taller, idUsuario, "capturar asistencias");
        ValidarVentanaAsistencias(taller);

        var asistencia = await _context.TalleresAsistencias
            .FirstOrDefaultAsync(a => a.IdAsistencia == idAsistencia && a.IdTaller == idTaller, ct)
            ?? throw new InvalidOperationException($"La asistencia {idAsistencia} no existe en el taller.");

        if (request.Numero != asistencia.Numero
            && await _context.TalleresAsistencias.AnyAsync(a => a.IdTaller == idTaller && a.Numero == request.Numero && a.IdAsistencia != idAsistencia, ct))
        {
            throw new InvalidOperationException($"El número {request.Numero} ya está usado en la lista de asistencia.");
        }

        asistencia.Numero = request.Numero;
        asistencia.NombreMedico = request.NombreMedico.Trim();
        asistencia.CedulaProfesional = request.CedulaProfesional;
        asistencia.PuestoMedico = request.PuestoMedico;
        asistencia.TelefonoCelular = request.TelefonoCelular;
        asistencia.CorreoElectronico = request.CorreoElectronico;
        asistencia.Observaciones = request.Observaciones;
        asistencia.IdUsuarioModificacion = idUsuario;
        asistencia.FechaModificacion = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
        return ArmarAsistenciaDto(asistencia);
    }

    public async Task EliminarAsistenciaAsync(int idTaller, int idAsistencia, int idUsuario, CancellationToken ct = default)
    {
        var taller = await ObtenerTallerAsync(idTaller, ct);
        ValidarMiembroEquipo(taller, idUsuario, "capturar asistencias");
        ValidarVentanaAsistencias(taller);

        var asistencia = await _context.TalleresAsistencias
            .FirstOrDefaultAsync(a => a.IdAsistencia == idAsistencia && a.IdTaller == idTaller, ct)
            ?? throw new InvalidOperationException($"La asistencia {idAsistencia} no existe en el taller.");

        _context.TalleresAsistencias.Remove(asistencia);
        await _context.SaveChangesAsync(ct);
    }

    // ----- Evidencias -----

    public async Task<List<TallerEvidenciaDto>> GetEvidenciasAsync(int idTaller, CancellationToken ct = default)
    {
        _ = await ObtenerTallerAsync(idTaller, ct);

        return await _context.TalleresEvidencias.AsNoTracking()
            .Where(e => e.IdTaller == idTaller)
            .OrderBy(e => e.IdEvidencia)
            .Select(e => ArmarEvidenciaDto(e))
            .ToListAsync(ct);
    }

    public async Task<TallerEvidenciaDto> AgregarEvidenciaAsync(int idTaller, GuardarTallerEvidenciaRequest request, int idUsuario, CancellationToken ct = default)
    {
        var taller = await ObtenerTallerAsync(idTaller, ct);
        ValidarMiembroEquipo(taller, idUsuario, "capturar evidencias");
        ValidarVentanaEvidencias(taller);

        if (!TallerEvidencia.TiposValidos.Contains(request.TipoEvidencia))
        {
            throw new InvalidOperationException(
                $"Tipo de evidencia desconocido: '{request.TipoEvidencia}'. Use {string.Join(", ", TallerEvidencia.TiposValidos)}.");
        }

        var evidencia = new TallerEvidencia
        {
            IdTaller = idTaller,
            TipoEvidencia = request.TipoEvidencia,
            ArchivoUrl = request.ArchivoUrl,
            Descripcion = request.Descripcion,
            FechaEvidencia = request.FechaEvidencia,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
            FechaCreacion = DateTime.UtcNow,
            FechaModificacion = DateTime.UtcNow,
        };

        _context.TalleresEvidencias.Add(evidencia);
        await _context.SaveChangesAsync(ct);
        return ArmarEvidenciaDto(evidencia);
    }

    public async Task EliminarEvidenciaAsync(int idTaller, int idEvidencia, int idUsuario, CancellationToken ct = default)
    {
        var taller = await ObtenerTallerAsync(idTaller, ct);
        ValidarMiembroEquipo(taller, idUsuario, "capturar evidencias");
        ValidarVentanaEvidencias(taller);

        var evidencia = await _context.TalleresEvidencias
            .FirstOrDefaultAsync(e => e.IdEvidencia == idEvidencia && e.IdTaller == idTaller, ct)
            ?? throw new InvalidOperationException($"La evidencia {idEvidencia} no existe en el taller.");

        _context.TalleresEvidencias.Remove(evidencia);
        await _context.SaveChangesAsync(ct);
    }

    // ----- Máquina de estados (ADR-00008 revisado) -----

    public async Task<TallerDto> CambiarEstadoAsync(int idTaller, CambiarEstadoTallerRequest request, int idUsuario, CancellationToken ct = default)
    {
        var taller = await ObtenerTallerAsync(idTaller, ct);
        var nuevoEstado = request.NuevoEstado.Trim();

        if (!Taller.EstadosValidos.Contains(nuevoEstado))
        {
            throw new InvalidOperationException(
                $"Estado desconocido: '{nuevoEstado}'. Use {string.Join(", ", Taller.EstadosValidos)}.");
        }

        ValidarTransicionPermitida(taller.Estado, nuevoEstado);

        switch (nuevoEstado)
        {
            case Taller.EstadoEnCurso:
            case Taller.EstadoRealizado:
                ValidarMiembroEquipo(taller, idUsuario, $"pasar el taller a {nuevoEstado}");
                break;
            case Taller.EstadoCancelado:
                await ValidarRolCancelacionAsync(idUsuario, ct);
                if (string.IsNullOrWhiteSpace(request.Motivo))
                {
                    throw new InvalidOperationException("El motivo de la cancelación es obligatorio.");
                }
                break;
        }

        if (nuevoEstado == Taller.EstadoRealizado)
        {
            var tieneEvidencias = await _context.TalleresEvidencias.AnyAsync(e => e.IdTaller == idTaller, ct);
            var tieneAsistencias = await _context.TalleresAsistencias.AnyAsync(a => a.IdTaller == idTaller, ct);
            if (!tieneEvidencias || !tieneAsistencias)
            {
                throw new InvalidOperationException(
                    "Para cerrar el taller (Realizado) se requiere al menos 1 evidencia y 1 asistencia registradas.");
            }
        }

        var estadoAnterior = taller.Estado;
        taller.Estado = nuevoEstado;
        taller.IdUsuarioModificacion = idUsuario;
        if (nuevoEstado == Taller.EstadoRealizado)
        {
            taller.FechaRealizado = DateOnly.FromDateTime(DateTime.Today);
        }

        _context.TalleresEstadosHistorial.Add(new TallerEstadoHistorial
        {
            IdTaller = idTaller,
            EstadoAnterior = estadoAnterior,
            EstadoNuevo = nuevoEstado,
            Origen = TallerEstadoHistorial.OrigenManual,
            Motivo = request.Motivo,
            IdUsuario = idUsuario,
            Fecha = DateTime.Now,
        });

        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Taller {IdTaller}: transición {EstadoAnterior} -> {EstadoNuevo} por el usuario {IdUsuario}.",
            idTaller, estadoAnterior, nuevoEstado, idUsuario);

        return await ArmarTallerDtoAsync(taller, ct);
    }

    public async Task<List<TallerEstadoHistorialDto>> GetHistorialEstadosAsync(int idTaller, CancellationToken ct = default)
    {
        _ = await ObtenerTallerAsync(idTaller, ct);

        var historial = await _context.TalleresEstadosHistorial.AsNoTracking()
            .Where(h => h.IdTaller == idTaller)
            .OrderBy(h => h.Fecha)
            .ThenBy(h => h.IdHistorial)
            .ToListAsync(ct);

        var idsUsuarios = historial
            .Where(h => h.IdUsuario.HasValue)
            .Select(h => h.IdUsuario!.Value)
            .Distinct()
            .ToList();

        var nombres = idsUsuarios.Count > 0
            ? await _asokamContext.Usuarios.AsNoTracking()
                .Where(u => idsUsuarios.Contains(u.IdUsuario))
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? string.Empty, ct)
            : new Dictionary<int, string>();

        return historial
            .Select(h => new TallerEstadoHistorialDto
            {
                IdHistorial = h.IdHistorial,
                EstadoAnterior = h.EstadoAnterior,
                EstadoNuevo = h.EstadoNuevo,
                Origen = h.Origen,
                Motivo = h.Motivo,
                IdUsuario = h.IdUsuario,
                NombreUsuario = h.IdUsuario.HasValue
                    ? nombres.GetValueOrDefault(h.IdUsuario.Value)
                    : null,
                Fecha = h.Fecha,
            })
            .ToList();
    }

    // ----- Imprimibles (FOR-007 / FOR-008) -----

    public async Task<TallerDocumentoMaterialDto> GetDocumentoMaterialAsync(int idTaller, CancellationToken ct = default)
    {
        var taller = await ObtenerTallerAsync(idTaller, ct);
        var material = await _context.TalleresMateriales.AsNoTracking()
            .FirstOrDefaultAsync(m => m.IdTaller == idTaller, ct);

        return new TallerDocumentoMaterialDto
        {
            Taller = await ArmarTallerDtoAsync(taller, ct),
            Material = material is null ? null : await ArmarMaterialDtoAsync(material, ct),
        };
    }

    public async Task<TallerDocumentoAsistenciaDto> GetDocumentoAsistenciaAsync(int idTaller, CancellationToken ct = default)
    {
        var taller = await ObtenerTallerAsync(idTaller, ct);
        var asistencias = await _context.TalleresAsistencias.AsNoTracking()
            .Where(a => a.IdTaller == idTaller)
            .OrderBy(a => a.Numero)
            .ToListAsync(ct);

        return new TallerDocumentoAsistenciaDto
        {
            Taller = await ArmarTallerDtoAsync(taller, ct),
            Asistencias = asistencias.Select(ArmarAsistenciaDto).ToList(),
        };
    }

    // ----- Helpers -----

    private async Task<Taller> ObtenerTallerAsync(int idTaller, CancellationToken ct)
    {
        return await _context.Talleres
            .Include(t => t.Recursos)
            .FirstOrDefaultAsync(t => t.IdTaller == idTaller && t.Activo, ct)
            ?? throw new InvalidOperationException($"El taller {idTaller} no existe.");
    }

    private static void ValidarMiembroEquipo(Taller taller, int idUsuario, string accion)
    {
        if (taller.IdEjecutivo != idUsuario && taller.IdEspecialista != idUsuario)
        {
            throw new InvalidOperationException(
                $"Solo el Ejecutivo de Ventas o el Especialista de Producto del equipo puede {accion}.");
        }
    }

    private static void ValidarVentanaAsistencias(Taller taller)
    {
        if (taller.Estado is not (Taller.EstadoProgramado or Taller.EstadoEnCurso))
        {
            throw new InvalidOperationException(
                $"La lista de asistencia se captura con el taller Programado o En curso (estado actual: {taller.Estado}).");
        }
    }

    private static void ValidarVentanaEvidencias(Taller taller)
    {
        if (taller.Estado != Taller.EstadoEnCurso)
        {
            throw new InvalidOperationException(
                $"Las evidencias se capturan mientras el taller está En curso (estado actual: {taller.Estado}).");
        }
    }

    private static readonly Dictionary<string, string[]> TransicionesPermitidas = new()
    {
        [Taller.EstadoProgramado] = [Taller.EstadoEnCurso, Taller.EstadoCancelado],
        [Taller.EstadoEnCurso] = [Taller.EstadoRealizado, Taller.EstadoCancelado],
    };

    private static void ValidarTransicionPermitida(string estadoActual, string nuevoEstado)
    {
        if (estadoActual == nuevoEstado)
        {
            throw new InvalidOperationException($"El taller ya está en estado {nuevoEstado}.");
        }

        if (!TransicionesPermitidas.TryGetValue(estadoActual, out var permitidas) || !permitidas.Contains(nuevoEstado))
        {
            throw new InvalidOperationException(
                $"Transición no permitida: {estadoActual} → {nuevoEstado}. Transiciones válidas desde {estadoActual}: " +
                (permitidas is null ? "ninguna" : string.Join(", ", permitidas)));
        }
    }

    private async Task ValidarRolCancelacionAsync(int idUsuario, CancellationToken ct)
    {
        var roles = await _asokamContext.UsuariosRoles.AsNoTracking()
            .Where(ur => ur.IdUsuario == idUsuario)
            .Select(ur => ur.Rol.NombreRol)
            .ToListAsync(ct);

        if (!roles.Any(r => r is RolGerenteVentas or RolAem or RolCem))
        {
            throw new InvalidOperationException(
                "Solo el Gerente de Ventas, el Auxiliar Administrativo de Educación Médica o el Coordinador de Educación Médica pueden cancelar el taller.");
        }
    }

    private async Task<TallerMaterialDto> ArmarMaterialDtoAsync(TallerMaterial material, CancellationToken ct)
    {
        string? nombreRecepcion = null;
        if (material.IdUsuarioRecepcion.HasValue)
        {
            nombreRecepcion = await _asokamContext.Usuarios.AsNoTracking()
                .Where(u => u.IdUsuario == material.IdUsuarioRecepcion.Value)
                .Select(u => u.NombreCompleto)
                .FirstOrDefaultAsync(ct);
        }

        return new TallerMaterialDto
        {
            IdTallerMaterial = material.IdTallerMaterial,
            IdTaller = material.IdTaller,
            FechaEntrega = material.FechaEntrega,
            CargoPuesto = material.CargoPuesto,
            NombreProducto = material.NombreProducto,
            CantidadProducto = material.CantidadProducto,
            IncluyeListaAsistencia = material.IncluyeListaAsistencia,
            IncluyeFlayers = material.IncluyeFlayers,
            IncluyeEquipoComputo = material.IncluyeEquipoComputo,
            IncluyeProyector = material.IncluyeProyector,
            IncluyeDulces = material.IncluyeDulces,
            IncluyeModeloAnatomico = material.IncluyeModeloAnatomico,
            NombreEjecutivoRecepcion = material.NombreEjecutivoRecepcion,
            Observaciones = material.Observaciones,
            FirmaUrl = material.FirmaUrl,
            FechaRecepcion = material.FechaRecepcion,
            IdUsuarioRecepcion = material.IdUsuarioRecepcion,
            NombreUsuarioRecepcion = nombreRecepcion,
            Confirmado = material.FechaRecepcion.HasValue,
        };
    }

    private static TallerAsistenciaDto ArmarAsistenciaDto(TallerAsistencia asistencia) => new()
    {
        IdAsistencia = asistencia.IdAsistencia,
        IdTaller = asistencia.IdTaller,
        Numero = asistencia.Numero,
        NombreMedico = asistencia.NombreMedico,
        CedulaProfesional = asistencia.CedulaProfesional,
        PuestoMedico = asistencia.PuestoMedico,
        TelefonoCelular = asistencia.TelefonoCelular,
        CorreoElectronico = asistencia.CorreoElectronico,
        Observaciones = asistencia.Observaciones,
    };

    private static TallerEvidenciaDto ArmarEvidenciaDto(TallerEvidencia evidencia) => new()
    {
        IdEvidencia = evidencia.IdEvidencia,
        IdTaller = evidencia.IdTaller,
        TipoEvidencia = evidencia.TipoEvidencia,
        ArchivoUrl = evidencia.ArchivoUrl,
        Descripcion = evidencia.Descripcion,
        FechaEvidencia = evidencia.FechaEvidencia,
    };

    private async Task<TallerDto> ArmarTallerDtoAsync(Taller taller, CancellationToken ct)
    {
        var idsHospitales = taller.IdHospital.HasValue ? new List<int?> { taller.IdHospital } : [];
        var idsUsuarios = new List<int?> { taller.IdEjecutivo, taller.IdEspecialista, taller.IdUsuarioCreacion };

        var idsHosp = idsHospitales.Where(i => i.HasValue).Select(i => i!.Value).Distinct().ToList();
        var idsUsr = idsUsuarios.Where(i => i.HasValue).Select(i => i!.Value).Distinct().ToList();

        var nombresHospitales = idsHosp.Count > 0
            ? await _asokamContext.Hospitales.AsNoTracking()
                .Where(h => idsHosp.Contains(h.CodigoContacto))
                .ToDictionaryAsync(h => h.CodigoContacto, h => h.NombreContacto ?? $"Hospital {h.CodigoContacto}", ct)
            : new Dictionary<int, string>();

        var nombresUsuarios = idsUsr.Count > 0
            ? await _asokamContext.Usuarios.AsNoTracking()
                .Where(u => idsUsr.Contains(u.IdUsuario))
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? string.Empty, ct)
            : new Dictionary<int, string>();

        var (nombresEstados, nombresProductos) = await EducacionMedicaNombres.ResolverParaTalleresAsync(
            _asokamContext, [taller], ct);

        return TallerDtoMapper.Armar(taller, nombresHospitales, nombresUsuarios, nombresProductos, nombresEstados);
    }
}
