using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.EducacionMedica;

public class TalleresService : ITalleresService
{
    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly IWorkflowResolver _workflowResolver;
    private readonly IJefeInmediatoResolver _jefeInmediatoResolver;
    private readonly ILogger<TalleresService> _logger;

    public TalleresService(
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        IWorkflowResolver workflowResolver,
        IJefeInmediatoResolver jefeInmediatoResolver,
        ILogger<TalleresService> logger)
    {
        _context = context;
        _asokamContext = asokamContext;
        _workflowResolver = workflowResolver;
        _jefeInmediatoResolver = jefeInmediatoResolver;
        _logger = logger;
    }

    public async Task<MisTalleresResponse> GetMisTalleresAsync(int idUsuario, string? periodo, CancellationToken ct = default)
    {
        var periodoDate = ParsePeriodo(periodo);
        var equipo = await ObtenerEquipoDelUsuarioAsync(idUsuario, ct);

        var response = new MisTalleresResponse
        {
            IdEquipo = equipo?.IdEquipo,
            NombreRegion = equipo?.Region?.Nombre,
            Periodo = periodoDate,
        };

        if (equipo is null)
        {
            return response;
        }

        var matriz = await _context.MatricesIndividuales.AsNoTracking()
            .FirstOrDefaultAsync(m => m.IdEquipo == equipo.IdEquipo && m.Periodo == periodoDate, ct);

        var talleres = matriz is null
            ? []
            : await _context.Talleres.AsNoTracking()
                .Include(t => t.Recursos)
                .Where(t => t.IdMatrizIndividual == matriz.IdMatrizIndividual && t.Activo)
                .OrderBy(t => t.FechaTaller)
                .ThenBy(t => t.IdTaller)
                .ToListAsync(ct);

        var (nombresHospitales, nombresUsuarios) = await ResolverNombresAsync(
            talleres.Select(t => t.IdHospital),
            [equipo.IdEjecutivo, equipo.IdEspecialista],
            ct);

        response.Matriz = matriz is null
            ? null
            : ArmarMatrizIndividualDto(matriz, equipo, talleres.Count, nombresUsuarios);
        response.Talleres = talleres
            .Select(t => TallerDtoMapper.Armar(t, nombresHospitales, nombresUsuarios))
            .ToList();

        return response;
    }

    public async Task<TallerDto> CrearAsync(CrearTallerRequest request, int idUsuario, CancellationToken ct = default)
    {
        var hospitalSeleccion = await _context.SeleccionesHospitales
            .FirstOrDefaultAsync(h => h.IdSeleccionHospital == request.IdSeleccionHospital, ct)
            ?? throw new InvalidOperationException($"El hospital de la selección {request.IdSeleccionHospital} no existe.");

        var seleccion = await _context.SeleccionesMensuales
            .FirstOrDefaultAsync(s => s.IdSeleccionMensual == hospitalSeleccion.IdSeleccionMensual && s.Activo, ct)
            ?? throw new InvalidOperationException("La selección mensual del hospital no existe.");

        if (seleccion.IdTipoGerencia is null)
        {
            throw new InvalidOperationException(
                "La selección no tiene tipo de gerencia configurado; no se puede determinar la matriz general.");
        }

        // Elegibilidad: el usuario debe ser EV o EP del equipo asignado a la región del hospital
        var equipo = await ObtenerEquipoDelHospitalAsync(hospitalSeleccion, ct)
            ?? throw new InvalidOperationException(
                "El hospital no tiene equipo asignado en la selección (la región no fue asignada en el paso Reparto).");

        if (equipo.IdEjecutivo != idUsuario && equipo.IdEspecialista != idUsuario)
        {
            throw new InvalidOperationException(
                "Solo el Ejecutivo de Ventas o el Especialista de Producto del equipo asignado a la región del hospital puede capturar el taller.");
        }

        var periodo = new DateOnly(seleccion.FechaSeleccion.Year, seleccion.FechaSeleccion.Month, 1);

        var matrizGeneral = await GetOrCreateMatrizGeneralAsync(seleccion.IdTipoGerencia.Value, periodo, idUsuario, ct);
        await ValidarMatrizGeneralEditableAsync(matrizGeneral, "capturar talleres", ct);

        var matrizIndividual = await GetOrCreateMatrizIndividualAsync(equipo.IdEquipo, periodo, idUsuario, ct);
        if (matrizIndividual.Estado == MatrizIndividual.EstadoGenerada)
        {
            throw new InvalidOperationException(
                "La matriz individual del equipo ya fue generada (bloqueada). Pide al Gerente de Ventas que reabra la captura.");
        }

        var taller = new Taller
        {
            IdSeleccionHospital = hospitalSeleccion.IdSeleccionHospital,
            IdHospital = hospitalSeleccion.IdHospital,
            Region = hospitalSeleccion.Region,
            EntidadFederativa = hospitalSeleccion.EntidadFederativa,
            CiudadMunicipio = hospitalSeleccion.CiudadMunicipio,
            NumeroParticipantes = request.NumeroParticipantes,
            IdEjecutivo = equipo.IdEjecutivo,
            IdEspecialista = equipo.IdEspecialista,
            UnidadMedica = request.UnidadMedica,
            Lugar = request.Lugar,
            FechaTaller = request.FechaTaller,
            HoraTaller = request.HoraTaller,
            RequiereEquipoProyeccion = request.RequiereEquipoProyeccion,
            TipoEquipoProyeccion = request.TipoEquipoProyeccion,
            Estado = Taller.EstadoBorrador,
            Observaciones = request.Observaciones,
            Activo = true,
            IdMatrizIndividual = matrizIndividual.IdMatrizIndividual,
            IdMatrizGeneral = matrizGeneral.IdMatrizGeneral,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        };

        ReemplazarRecursos(taller, request.Recursos, idUsuario);

        _context.Talleres.Add(taller);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Taller {IdTaller} capturado por el usuario {IdUsuario} (equipo {IdEquipo}, matriz general {IdMatrizGeneral}).",
            taller.IdTaller, idUsuario, equipo.IdEquipo, matrizGeneral.IdMatrizGeneral);

        return await ArmarTallerDtoConNombresAsync(taller, ct);
    }

    public async Task<TallerDto> ActualizarAsync(int idTaller, ActualizarTallerRequest request, int idUsuario, CancellationToken ct = default)
    {
        var taller = await ObtenerTallerEditableAsync(idTaller, idUsuario, "editar", ct);

        taller.NumeroParticipantes = request.NumeroParticipantes;
        taller.UnidadMedica = request.UnidadMedica;
        taller.Lugar = request.Lugar;
        taller.FechaTaller = request.FechaTaller;
        taller.HoraTaller = request.HoraTaller;
        taller.RequiereEquipoProyeccion = request.RequiereEquipoProyeccion;
        taller.TipoEquipoProyeccion = request.TipoEquipoProyeccion;
        taller.Observaciones = request.Observaciones;
        taller.IdUsuarioModificacion = idUsuario;

        ReemplazarRecursos(taller, request.Recursos, idUsuario);

        await _context.SaveChangesAsync(ct);
        return await ArmarTallerDtoConNombresAsync(taller, ct);
    }

    public async Task EliminarAsync(int idTaller, int idUsuario, CancellationToken ct = default)
    {
        var taller = await ObtenerTallerEditableAsync(idTaller, idUsuario, "eliminar", ct);

        _context.TalleresRecursos.RemoveRange(taller.Recursos);
        _context.Talleres.Remove(taller);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Taller {IdTaller} eliminado por el usuario {IdUsuario}.", idTaller, idUsuario);
    }

    public async Task<MatrizIndividualDto> GenerarMatrizIndividualAsync(int idMatrizIndividual, int idUsuario, CancellationToken ct = default)
    {
        var matriz = await _context.MatricesIndividuales
            .Include(m => m.Equipo)
            .FirstOrDefaultAsync(m => m.IdMatrizIndividual == idMatrizIndividual, ct)
            ?? throw new InvalidOperationException($"La matriz individual {idMatrizIndividual} no existe.");

        ValidarMiembroEquipo(matriz.Equipo, idUsuario);

        if (matriz.Estado == MatrizIndividual.EstadoGenerada)
        {
            throw new InvalidOperationException("La matriz individual ya fue generada.");
        }

        var matrizGeneral = await ObtenerMatrizGeneralDeIndividualAsync(matriz, ct)
            ?? throw new InvalidOperationException(
                "La matriz individual no tiene talleres capturados; captura al menos un taller antes de generar.");

        await ValidarMatrizGeneralEditableAsync(matrizGeneral, "generar la matriz individual", ct);

        matriz.Estado = MatrizIndividual.EstadoGenerada;
        matriz.FechaGeneracion = DateTime.UtcNow;
        matriz.IdUsuarioModificacion = idUsuario;
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Matriz individual {IdMatrizIndividual} (equipo {IdEquipo}) generada por el usuario {IdUsuario}.",
            matriz.IdMatrizIndividual, matriz.IdEquipo, idUsuario);

        return await ArmarMatrizIndividualDtoConNombresAsync(matriz, ct);
    }

    public async Task<MatrizIndividualDto> ReabrirMatrizIndividualAsync(int idMatrizIndividual, int idUsuario, CancellationToken ct = default)
    {
        var matriz = await _context.MatricesIndividuales
            .Include(m => m.Equipo)
            .FirstOrDefaultAsync(m => m.IdMatrizIndividual == idMatrizIndividual, ct)
            ?? throw new InvalidOperationException($"La matriz individual {idMatrizIndividual} no existe.");

        if (matriz.Estado != MatrizIndividual.EstadoGenerada)
        {
            throw new InvalidOperationException("La matriz individual no está generada; no hay captura que reabrir.");
        }

        var matrizGeneral = await ObtenerMatrizGeneralDeIndividualAsync(matriz, ct)
            ?? throw new InvalidOperationException("La matriz individual no tiene matriz general asociada.");

        // Solo mientras la general sigue en el paso inicial (CREADA) se puede reabrir
        var pasoActual = await ObtenerPasoActualAsync(matrizGeneral, ct);
        if (pasoActual is null || !pasoActual.EsInicio)
        {
            throw new InvalidOperationException(
                "No se puede reabrir la captura: la matriz general ya está en autorización.");
        }

        // Solo el GV participante del paso (sin el atajo de creador: quien capturó fue el equipo)
        var participantes = pasoActual.Participantes.Where(p => p.Activo).ToList();
        var esParticipante = participantes.Any(p => p.IdUsuario == idUsuario);
        if (!esParticipante && participantes.Any(p => p.IdRol.HasValue))
        {
            var rolesUsuario = await _asokamContext.UsuariosRoles
                .Where(ur => ur.IdUsuario == idUsuario
                    && (ur.FechaExpiracion == null || ur.FechaExpiracion > DateTime.UtcNow))
                .Select(ur => ur.IdRol)
                .ToListAsync(ct);
            esParticipante = participantes.Any(p => p.IdRol.HasValue && rolesUsuario.Contains(p.IdRol.Value));
        }

        if (!esParticipante)
        {
            throw new InvalidOperationException(
                "Solo el Gerente de Ventas participante del paso puede reabrir la captura.");
        }

        matriz.Estado = MatrizIndividual.EstadoEnCaptura;
        matriz.FechaGeneracion = null;
        matriz.IdUsuarioModificacion = idUsuario;
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Matriz individual {IdMatrizIndividual} (equipo {IdEquipo}) reabierta por el usuario {IdUsuario} (GV).",
            matriz.IdMatrizIndividual, matriz.IdEquipo, idUsuario);

        return await ArmarMatrizIndividualDtoConNombresAsync(matriz, ct);
    }

    // ----- Helpers -----

    private static DateOnly ParsePeriodo(string? periodo)
    {
        if (string.IsNullOrWhiteSpace(periodo))
        {
            var hoy = DateTime.UtcNow.Date;
            return new DateOnly(hoy.Year, hoy.Month, 1);
        }

        var partes = periodo.Trim().Split('-');
        if (partes.Length != 2
            || !int.TryParse(partes[0], out var anio)
            || !int.TryParse(partes[1], out var mes)
            || mes is < 1 or > 12)
        {
            throw new InvalidOperationException("El periodo debe tener el formato YYYY-MM.");
        }

        return new DateOnly(anio, mes, 1);
    }

    private async Task<EquipoPareo?> ObtenerEquipoDelUsuarioAsync(int idUsuario, CancellationToken ct)
    {
        return await _context.EquiposPareo.AsNoTracking()
            .Include(e => e.Region)
            .FirstOrDefaultAsync(e => e.Activo
                && (e.IdEjecutivo == idUsuario || e.IdEspecialista == idUsuario), ct);
    }

    private async Task<EquipoPareo?> ObtenerEquipoDelHospitalAsync(SeleccionHospital hospital, CancellationToken ct)
    {
        if (hospital.IdRegion is null)
        {
            return null;
        }

        var region = await _context.SeleccionesRegiones.AsNoTracking()
            .FirstOrDefaultAsync(r => r.IdRegion == hospital.IdRegion.Value, ct);

        if (region?.IdEquipo is null)
        {
            return null;
        }

        return await _context.EquiposPareo.AsNoTracking()
            .FirstOrDefaultAsync(e => e.IdEquipo == region.IdEquipo.Value && e.Activo, ct);
    }

    private static void ValidarMiembroEquipo(EquipoPareo? equipo, int idUsuario)
    {
        if (equipo is null || (equipo.IdEjecutivo != idUsuario && equipo.IdEspecialista != idUsuario))
        {
            throw new InvalidOperationException(
                "Solo el Ejecutivo de Ventas o el Especialista de Producto del equipo puede ejecutar esta acción.");
        }
    }

    private async Task<MatrizIndividual> GetOrCreateMatrizIndividualAsync(int idEquipo, DateOnly periodo, int idUsuario, CancellationToken ct)
    {
        var matriz = await _context.MatricesIndividuales
            .FirstOrDefaultAsync(m => m.IdEquipo == idEquipo && m.Periodo == periodo, ct);

        if (matriz is not null)
        {
            return matriz;
        }

        matriz = new MatrizIndividual
        {
            IdEquipo = idEquipo,
            Periodo = periodo,
            Estado = MatrizIndividual.EstadoEnCaptura,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        };
        _context.MatricesIndividuales.Add(matriz);
        await _context.SaveChangesAsync(ct);
        return matriz;
    }

    private async Task<MatrizGeneral> GetOrCreateMatrizGeneralAsync(int idTipoGerencia, DateOnly periodo, int idUsuario, CancellationToken ct)
    {
        var matriz = await _context.MatricesGenerales
            .FirstOrDefaultAsync(m => m.IdTipoGerencia == idTipoGerencia && m.Periodo == periodo, ct);

        if (matriz is not null)
        {
            return matriz;
        }

        // La matriz general nace con el primer taller de la gerencia/mes, ya en el paso inicial
        var workflow = await _workflowResolver.ResolveWorkflowIdAsync(
            CodigoProceso.EDUCACION_MEDICA_MATRIZ,
            new Dictionary<string, int?> { [WorkflowScope.TIPO_GERENCIA] = idTipoGerencia })
            ?? throw new InvalidOperationException(
                "No hay workflow configurado para la matriz de talleres de esa gerencia. Aplica el script 0015 y crea el mapping (EDUCACION_MEDICA_MATRIZ + Tipo de gerencia) en el admin de workflows.");

        var pasoInicio = workflow.Pasos.FirstOrDefault(p => p.EsInicio)
            ?? throw new InvalidOperationException("El workflow de la matriz de talleres no tiene paso inicial configurado.");

        matriz = new MatrizGeneral
        {
            IdTipoGerencia = idTipoGerencia,
            Periodo = periodo,
            IdWorkflow = workflow.IdWorkflow,
            IdPasoActual = pasoInicio.IdPaso,
            IdEstado = pasoInicio.IdEstado,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        };
        _context.MatricesGenerales.Add(matriz);
        await _context.SaveChangesAsync(ct);
        return matriz;
    }

    /// <summary>Candado de edición estilo OC/Solicitudes: solo en el paso inicial (estado CREADA).</summary>
    private async Task ValidarMatrizGeneralEditableAsync(MatrizGeneral matrizGeneral, string accion, CancellationToken ct)
    {
        var pasoActual = await ObtenerPasoActualAsync(matrizGeneral, ct);
        if (pasoActual is null || !pasoActual.EsInicio)
        {
            throw new InvalidOperationException($"Solo se pueden {accion} en estado Creada.");
        }
    }

    private async Task<WorkflowPaso?> ObtenerPasoActualAsync(MatrizGeneral matrizGeneral, CancellationToken ct)
    {
        if (matrizGeneral.IdPasoActual is null)
        {
            return null;
        }

        return await _context.WorkflowPasos.AsNoTracking()
            .Include(p => p.Participantes)
            .FirstOrDefaultAsync(p => p.IdPaso == matrizGeneral.IdPasoActual.Value, ct);
    }

    private async Task<Taller> ObtenerTallerEditableAsync(int idTaller, int idUsuario, string accion, CancellationToken ct)
    {
        var taller = await _context.Talleres
            .Include(t => t.Recursos)
            .FirstOrDefaultAsync(t => t.IdTaller == idTaller && t.Activo, ct)
            ?? throw new InvalidOperationException($"El taller {idTaller} no existe.");

        if (taller.IdEjecutivo != idUsuario && taller.IdEspecialista != idUsuario)
        {
            throw new InvalidOperationException(
                "Solo el Ejecutivo de Ventas o el Especialista de Producto del equipo puede modificar el taller.");
        }

        if (taller.IdMatrizIndividual is not null)
        {
            var matrizIndividual = await _context.MatricesIndividuales.AsNoTracking()
                .FirstOrDefaultAsync(m => m.IdMatrizIndividual == taller.IdMatrizIndividual.Value, ct);
            if (matrizIndividual?.Estado == MatrizIndividual.EstadoGenerada)
            {
                throw new InvalidOperationException(
                    "La matriz individual del equipo ya fue generada (bloqueada). Pide al Gerente de Ventas que reabra la captura.");
            }
        }

        if (taller.IdMatrizGeneral is not null)
        {
            var matrizGeneral = await _context.MatricesGenerales.AsNoTracking()
                .FirstOrDefaultAsync(m => m.IdMatrizGeneral == taller.IdMatrizGeneral.Value, ct);
            if (matrizGeneral is not null)
            {
                await ValidarMatrizGeneralEditableAsync(matrizGeneral, $"{accion} talleres", ct);
            }
        }

        return taller;
    }

    private async Task<MatrizGeneral?> ObtenerMatrizGeneralDeIndividualAsync(MatrizIndividual matriz, CancellationToken ct)
    {
        var idMatrizGeneral = await _context.Talleres.AsNoTracking()
            .Where(t => t.IdMatrizIndividual == matriz.IdMatrizIndividual && t.IdMatrizGeneral != null)
            .Select(t => t.IdMatrizGeneral)
            .FirstOrDefaultAsync(ct);

        if (idMatrizGeneral is null or 0)
        {
            return null;
        }

        return await _context.MatricesGenerales
            .FirstOrDefaultAsync(m => m.IdMatrizGeneral == idMatrizGeneral.Value, ct);
    }

    private void ReemplazarRecursos(Taller taller, List<GuardarTallerRecursoRequest>? recursos, int idUsuario)
    {
        if (recursos is null)
        {
            return;
        }

        foreach (var request in recursos)
        {
            if (!TallerRecurso.TiposValidos.Contains(request.TipoRecurso))
            {
                throw new InvalidOperationException(
                    $"Tipo de recurso desconocido: '{request.TipoRecurso}'. Use {string.Join(", ", TallerRecurso.TiposValidos)}.");
            }
        }

        _context.TalleresRecursos.RemoveRange(taller.Recursos);
        taller.Recursos.Clear();

        foreach (var request in recursos)
        {
            taller.Recursos.Add(new TallerRecurso
            {
                TipoRecurso = request.TipoRecurso,
                IdProducto = request.IdProducto,
                Descripcion = request.Descripcion,
                TipoEnvio = request.TipoEnvio,
                Cantidad = request.Cantidad,
                Observaciones = request.Observaciones,
                IdUsuarioCreacion = idUsuario,
                IdUsuarioModificacion = idUsuario,
            });
        }
    }

    private async Task<(Dictionary<int, string> Hospitales, Dictionary<int, string> Usuarios)> ResolverNombresAsync(
        IEnumerable<int?> idsHospitales,
        IEnumerable<int?> idsUsuarios,
        CancellationToken ct)
    {
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

        return (nombresHospitales, nombresUsuarios);
    }

    private async Task<TallerDto> ArmarTallerDtoConNombresAsync(Taller taller, CancellationToken ct)
    {
        var (nombresHospitales, nombresUsuarios) = await ResolverNombresAsync(
            [taller.IdHospital],
            [taller.IdEjecutivo, taller.IdEspecialista],
            ct);
        return TallerDtoMapper.Armar(taller, nombresHospitales, nombresUsuarios);
    }

    private async Task<MatrizIndividualDto> ArmarMatrizIndividualDtoConNombresAsync(MatrizIndividual matriz, CancellationToken ct)
    {
        var equipo = matriz.Equipo ?? await _context.EquiposPareo.AsNoTracking()
            .FirstOrDefaultAsync(e => e.IdEquipo == matriz.IdEquipo, ct);

        var totalTalleres = await _context.Talleres.AsNoTracking()
            .CountAsync(t => t.IdMatrizIndividual == matriz.IdMatrizIndividual && t.Activo, ct);

        var (_, nombresUsuarios) = await ResolverNombresAsync(
            [],
            [equipo?.IdEjecutivo, equipo?.IdEspecialista],
            ct);

        return ArmarMatrizIndividualDto(matriz, equipo, totalTalleres, nombresUsuarios);
    }

    private static MatrizIndividualDto ArmarMatrizIndividualDto(
        MatrizIndividual matriz,
        EquipoPareo? equipo,
        int totalTalleres,
        IReadOnlyDictionary<int, string> nombresUsuarios)
    {
        return new MatrizIndividualDto
        {
            IdMatrizIndividual = matriz.IdMatrizIndividual,
            IdEquipo = matriz.IdEquipo,
            Periodo = matriz.Periodo,
            Estado = matriz.Estado,
            FechaGeneracion = matriz.FechaGeneracion,
            IdEjecutivo = equipo?.IdEjecutivo,
            NombreEjecutivo = equipo is not null ? nombresUsuarios.GetValueOrDefault(equipo.IdEjecutivo) : null,
            IdEspecialista = equipo?.IdEspecialista,
            NombreEspecialista = equipo is not null ? nombresUsuarios.GetValueOrDefault(equipo.IdEspecialista) : null,
            TotalTalleres = totalTalleres,
        };
    }
}
