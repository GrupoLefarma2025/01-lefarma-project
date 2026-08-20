using ErrorOr;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Models;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Rh.IncidenciasChecado;

public class IncidenciasChecadoService : BaseService, IIncidenciasChecadoService
{
    private readonly IIncidenciasChecadoRepository _repository;
    private readonly IEmpleadoRepository _empleadoRepository;
    private readonly IIncidenciaChecadoConfigService _descuentoService;
    private readonly ApplicationDbContext _applicationDbContext;

    protected override string EntityName => "IncidenciasChecado";


    private const string TardanzaEntrada = "TARDANZA_ENTRADA";
    private const string TardanzaSalida = "TARDANZA_SALIDA";
    private const string SalidaAnticipada = "SALIDA_ANTICIPADA";
    private const string OmisionEntrada = "OMISION_ENTRADA";
    private const string OmisionSalida = "OMISION_SALIDA";

    public IncidenciasChecadoService(
        IIncidenciasChecadoRepository repository,
        IEmpleadoRepository empleadoRepository,
        IIncidenciaChecadoConfigService descuentoService,
        ApplicationDbContext applicationDbContext,
        IWideEventAccessor wideEventAccessor)
        : base(wideEventAccessor)
    {
        _repository = repository;
        _empleadoRepository = empleadoRepository;
        _descuentoService = descuentoService;
        _applicationDbContext = applicationDbContext;
    }

    public async Task<ErrorOr<List<IncidenciaChecadoResponse>>> GetMisIncidenciasAsync(
        IncidenciasChecadoRequest request,
        int idUsuario,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (request.Anio.HasValue && request.Mes.HasValue)
            {
                request.FechaDesde = new DateTime(request.Anio.Value, request.Mes.Value, 1);
                request.FechaHasta = request.FechaDesde.Value.AddMonths(1).AddDays(-1);
            }

            var nomina = await _empleadoRepository.ResolverNominaPorUsuarioAsync(idUsuario, cancellationToken);
            if (!nomina.HasValue)
                return new List<IncidenciaChecadoResponse>();

            var query = _repository.GetQueryable().Where(x => x.Nomina == nomina.Value);

            if (request.FechaDesde.HasValue)
                query = query.Where(x => x.Fecha >= request.FechaDesde.Value);

            if (request.FechaHasta.HasValue)
                query = query.Where(x => x.Fecha <= request.FechaHasta.Value);

            if (request.HoraEntradaDesde.HasValue)
                query = query.Where(x => x.Entrada >= request.HoraEntradaDesde.Value);

            if (request.HoraEntradaHasta.HasValue)
                query = query.Where(x => x.Entrada <= request.HoraEntradaHasta.Value);

            if (request.HoraSalidaDesde.HasValue)
                query = query.Where(x => x.Salida >= request.HoraSalidaDesde.Value);

            if (request.HoraSalidaHasta.HasValue)
                query = query.Where(x => x.Salida <= request.HoraSalidaHasta.Value);

            if (!string.IsNullOrWhiteSpace(request.Nombre))
                query = query.Where(x => x.Nombre.Contains(request.Nombre));

            var orderBy = string.IsNullOrWhiteSpace(request.OrderBy) ? "fecha" : request.OrderBy;
            var orderDirection = string.IsNullOrWhiteSpace(request.OrderDirection) ? "desc" : request.OrderDirection;
            query = (orderBy.ToLowerInvariant(), orderDirection.ToLowerInvariant()) switch
            {
                ("fecha", "asc") => query.OrderBy(x => x.Fecha),
                ("fecha", "desc") => query.OrderByDescending(x => x.Fecha).ThenBy(x => x.Nombre),
                ("nomina", "asc") => query.OrderBy(x => x.Nomina),
                ("nomina", "desc") => query.OrderByDescending(x => x.Nomina),
                ("nombre", "asc") => query.OrderBy(x => x.Nombre),
                ("nombre", "desc") => query.OrderByDescending(x => x.Nombre),
                ("empresa", "asc") => query.OrderBy(x => x.Empresa),
                ("empresa", "desc") => query.OrderByDescending(x => x.Empresa),
                ("departamento", "asc") => query.OrderBy(x => x.Departamento),
                ("departamento", "desc") => query.OrderByDescending(x => x.Departamento),
                _ => query.OrderByDescending(x => x.Fecha).ThenBy(x => x.Nombre)
            };

            var items = await query
                .Select(x => new IncidenciaChecadoResponse
                {
                    Fecha = x.Fecha,
                    Nomina = x.Nomina,
                    Nombre = x.Nombre,
                    Empresa = x.Empresa,
                    Departamento = x.Departamento,
                    Puesto = x.Puesto,
                    Checa = x.Checa,
                    NombreDiaSemana = x.NombreDiaSemana,
                    DiaSemana = x.DiaSemana,
                    Turno = x.Turno,
                    Horario = x.Horario,
                    Entrada = x.Entrada,
                    Salida = x.Salida,
                    Entro = x.Entro,
                    Salio = x.Salio,
                    MsgError = x.MsgError,
                    IncidenciaEntrada = x.IncidenciaEntrada,
                    IncidenciaSalida = x.IncidenciaSalida
                })
                .ToListAsync(cancellationToken);

            await EnriquecerJustificacionesAsync(items, cancellationToken);
            await _descuentoService.EnriquecerDescuentosAsync(items, cancellationToken);

            items = items
                .Where(i => i.IncidenciasCalculadas.Count > 0)
                .ToList();

            var context = new Dictionary<string, object>
            {
                ["idUsuario"] = idUsuario
            };
            if (request.FechaDesde.HasValue)
                context["fechaDesde"] = request.FechaDesde.Value;
            if (request.FechaHasta.HasValue)
                context["fechaHasta"] = request.FechaHasta.Value;

            EnrichWideEvent("GetMisIncidencias", count: items.Count, additionalContext: context);

            return items;
        }
        catch (OperationCanceledException)
        {
            return new List<IncidenciaChecadoResponse>();
        }
        catch (Exception ex)
        {
            EnrichWideEvent("GetMisIncidencias", exception: ex);
            return CommonErrors.DatabaseError("consultar las incidencias de checado");
        }
    }

    public async Task<ErrorOr<PagedResult<IncidenciaChecadoResponse>>> GetAllAsync(
        IncidenciasChecadoConsultaRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var query = _repository.GetQueryable();

            if (request.FechaInicio.HasValue && request.FechaFin.HasValue)
            {
                query = query.Where(x => x.Fecha >= request.FechaInicio.Value && x.Fecha <= request.FechaFin.Value);
            }
            else if (request.Anio.HasValue && request.Mes.HasValue)
            {
                var inicioMes = new DateTime(request.Anio.Value, request.Mes.Value, 1);
                var finMes = inicioMes.AddMonths(1).AddDays(-1);
                query = query.Where(x => x.Fecha >= inicioMes && x.Fecha <= finMes);
            }
            else if (request.Anio.HasValue)
            {
                var inicioAnio = new DateTime(request.Anio.Value, 1, 1);
                var finAnio = inicioAnio.AddYears(1).AddDays(-1);
                query = query.Where(x => x.Fecha >= inicioAnio && x.Fecha <= finAnio);
            }
            else if (request.Mes.HasValue)
            {
                query = query.Where(x => x.Fecha.Month == request.Mes.Value);
            }

            if (request.Dia.HasValue && request.Dia.Value > 0)
                query = query.Where(x => x.Fecha.Day == request.Dia.Value);

            if (request.Nomina.HasValue)
                query = query.Where(x => x.Nomina == request.Nomina.Value);

            if (!string.IsNullOrWhiteSpace(request.Nombre))
                query = query.Where(x => x.Nombre.Contains(request.Nombre));

            if (!string.IsNullOrWhiteSpace(request.Empresa))
                query = query.Where(x => x.Empresa != null && x.Empresa.Contains(request.Empresa));

            if (!string.IsNullOrWhiteSpace(request.Departamento))
                query = query.Where(x => x.Departamento != null && x.Departamento.Contains(request.Departamento));

            if (!string.IsNullOrWhiteSpace(request.Puesto))
                query = query.Where(x => x.Puesto != null && x.Puesto.Contains(request.Puesto));

            var incEntrada = request.TieneIncidenciaEntrada;
            var incSalida = request.TieneIncidenciaSalida;
            var incOmision = request.TieneIncidenciaOmision;

            var orderBy = string.IsNullOrWhiteSpace(request.OrderBy) ? "fecha" : request.OrderBy;
            var orderDirection = string.IsNullOrWhiteSpace(request.OrderDirection) ? "desc" : request.OrderDirection;
            query = (orderBy.ToLowerInvariant(), orderDirection.ToLowerInvariant()) switch
            {
                ("fecha", "asc") => query.OrderBy(x => x.Fecha),
                ("fecha", "desc") => query.OrderByDescending(x => x.Fecha).ThenBy(x => x.Nombre),
                ("nomina", "asc") => query.OrderBy(x => x.Nomina),
                ("nomina", "desc") => query.OrderByDescending(x => x.Nomina),
                ("nombre", "asc") => query.OrderBy(x => x.Nombre),
                ("nombre", "desc") => query.OrderByDescending(x => x.Nombre),
                ("empresa", "asc") => query.OrderBy(x => x.Empresa),
                ("empresa", "desc") => query.OrderByDescending(x => x.Empresa),
                ("departamento", "asc") => query.OrderBy(x => x.Departamento),
                ("departamento", "desc") => query.OrderByDescending(x => x.Departamento),
                _ => query.OrderByDescending(x => x.Fecha).ThenBy(x => x.Nombre)
            };

            var items = await query
                .Select(x => new IncidenciaChecadoResponse
                {
                    Fecha = x.Fecha,
                    Nomina = x.Nomina,
                    Nombre = x.Nombre,
                    Empresa = x.Empresa,
                    Departamento = x.Departamento,
                    Puesto = x.Puesto,
                    Checa = x.Checa,
                    NombreDiaSemana = x.NombreDiaSemana,
                    DiaSemana = x.DiaSemana,
                    Turno = x.Turno,
                    Horario = x.Horario,
                    Entrada = x.Entrada,
                    Salida = x.Salida,
                    Entro = x.Entro,
                    Salio = x.Salio,
                    MsgError = x.MsgError,
                    IncidenciaEntrada = x.IncidenciaEntrada,
                    IncidenciaSalida = x.IncidenciaSalida
                })
                .ToListAsync(cancellationToken);

            await EnriquecerJustificacionesAsync(items, cancellationToken);
            await _descuentoService.EnriquecerDescuentosAsync(items, cancellationToken);

            items = items
                .Where(i => CumpleFiltroTipos(i, incEntrada, incSalida, incOmision))
                .ToList();

            var ordered = OrdenarItems(items, request.OrderBy, request.OrderDirection);

            var page = request.Page > 0 ? request.Page : 1;
            var pageSize = request.PageSize > 0 ? request.PageSize : 10;
            var totalCount = ordered.Count();
            var pagedItems = ordered
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            EnrichWideEvent("GetAll", count: pagedItems.Count, additionalContext: new Dictionary<string, object>
            {
                ["page"] = page,
                ["pageSize"] = pageSize,
                ["totalCount"] = totalCount
            });

            return new PagedResult<IncidenciaChecadoResponse>
            {
                Items = pagedItems,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }
        catch (OperationCanceledException)
        {
            return new PagedResult<IncidenciaChecadoResponse>
            {
                Items = new List<IncidenciaChecadoResponse>(),
                TotalCount = 0,
                Page = request.Page > 0 ? request.Page : 1,
                PageSize = request.PageSize > 0 ? request.PageSize : 10
            };
        }
        catch (Exception ex)
        {
            EnrichWideEvent("GetAll", exception: ex);
            return CommonErrors.DatabaseError("consultar las incidencias de checado");
        }
    }

    public async Task<ErrorOr<List<IncidenciaChecadoResponse>>> GetIncidenciasPorEmpleadoAsync(
        long nomina,
        DateTime fechaInicio,
        DateTime fechaFin,
        int limite,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var query = _repository.GetQueryable()
                .Where(x => x.Nomina == nomina && x.Fecha >= fechaInicio && x.Fecha <= fechaFin);

            var items = await query
                .OrderByDescending(x => x.Fecha)
                .ThenBy(x => x.Nombre)
                .Select(x => new IncidenciaChecadoResponse
                {
                    Fecha = x.Fecha,
                    Nomina = x.Nomina,
                    Nombre = x.Nombre,
                    Empresa = x.Empresa,
                    Departamento = x.Departamento,
                    Puesto = x.Puesto,
                    Checa = x.Checa,
                    NombreDiaSemana = x.NombreDiaSemana,
                    DiaSemana = x.DiaSemana,
                    Turno = x.Turno,
                    Horario = x.Horario,
                    Entrada = x.Entrada,
                    Salida = x.Salida,
                    Entro = x.Entro,
                    Salio = x.Salio,
                    MsgError = x.MsgError,
                    IncidenciaEntrada = x.IncidenciaEntrada,
                    IncidenciaSalida = x.IncidenciaSalida
                })
                .ToListAsync(cancellationToken);

            await EnriquecerJustificacionesAsync(items, cancellationToken);
            await _descuentoService.EnriquecerDescuentosAsync(items, cancellationToken);

            items = items
                .Where(i => CumpleFiltroTipos(i, true, true, true))
                .Take(limite > 0 ? limite : 100)
                .ToList();

            EnrichWideEvent("GetIncidenciasPorEmpleado", count: items.Count, additionalContext: new Dictionary<string, object>
            {
                ["nomina"] = nomina,
                ["fechaInicio"] = fechaInicio,
                ["fechaFin"] = fechaFin,
                ["limite"] = limite
            });

            return items;
        }
        catch (OperationCanceledException)
        {
            return new List<IncidenciaChecadoResponse>();
        }
        catch (Exception ex)
        {
            EnrichWideEvent("GetIncidenciasPorEmpleado", exception: ex);
            return CommonErrors.DatabaseError("consultar las incidencias del empleado");
        }
    }

    public async Task<ErrorOr<PagedResult<IncidenciasChecadoResumenEmpleadoResponse>>> GetResumenPorEmpleadoAsync(
        IncidenciasChecadoResumenEmpleadoRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var (fechaInicio, fechaFin) = CalcularRangoPeriodo(request.Periodo, request.FechaInicio, request.FechaFin);

            var query = _repository.GetQueryable()
                .Where(x => x.Fecha >= fechaInicio && x.Fecha <= fechaFin);

            if (request.Nomina.HasValue)
                query = query.Where(x => x.Nomina == request.Nomina.Value);

            if (!string.IsNullOrWhiteSpace(request.Nombre))
                query = query.Where(x => x.Nombre.Contains(request.Nombre));

            if (!string.IsNullOrWhiteSpace(request.Empresa))
                query = query.Where(x => x.Empresa != null && x.Empresa.Contains(request.Empresa));

            if (!string.IsNullOrWhiteSpace(request.Departamento))
                query = query.Where(x => x.Departamento != null && x.Departamento.Contains(request.Departamento));

            if (!string.IsNullOrWhiteSpace(request.Puesto))
                query = query.Where(x => x.Puesto != null && x.Puesto.Contains(request.Puesto));

            var incEntrada = request.TieneIncidenciaEntrada;
            var incSalida = request.TieneIncidenciaSalida;
            var incOmision = request.TieneIncidenciaOmision;

            var rows = await query
                .Where(x => x.Nomina.HasValue)
                .Select(x => new IncidenciaChecadoResponse
                {
                    Fecha = x.Fecha,
                    Nomina = x.Nomina,
                    Nombre = x.Nombre,
                    Empresa = x.Empresa,
                    Departamento = x.Departamento,
                    Puesto = x.Puesto,
                    Checa = x.Checa,
                    NombreDiaSemana = x.NombreDiaSemana,
                    DiaSemana = x.DiaSemana,
                    Turno = x.Turno,
                    Horario = x.Horario,
                    Entrada = x.Entrada,
                    Salida = x.Salida,
                    Entro = x.Entro,
                    Salio = x.Salio,
                    MsgError = x.MsgError,
                    IncidenciaEntrada = x.IncidenciaEntrada,
                    IncidenciaSalida = x.IncidenciaSalida
                })
                .ToListAsync(cancellationToken);

            await EnriquecerJustificacionesAsync(rows, cancellationToken);
            await _descuentoService.EnriquecerDescuentosAsync(rows, cancellationToken);

            rows = rows
                .Where(r => CumpleFiltroTipos(r, incEntrada, incSalida, incOmision))
                .ToList();

            static int ContarIncidencias(IncidenciaChecadoResponse x) =>
                x.IncidenciasCalculadas.Count;

            var resumen = rows
                .GroupBy(x => new { x.Nomina, x.Nombre })
                .Select(g => new IncidenciasChecadoResumenEmpleadoResponse
                {
                    Nomina = g.Key.Nomina!.Value,
                    Nombre = g.Key.Nombre ?? string.Empty,
                    Empresa = g.FirstOrDefault(x => !string.IsNullOrEmpty(x.Empresa))?.Empresa,
                    Departamento = g.FirstOrDefault(x => !string.IsNullOrEmpty(x.Departamento))?.Departamento,
                    Puesto = g.FirstOrDefault(x => !string.IsNullOrEmpty(x.Puesto))?.Puesto,
                    TotalIncidencias = g.Sum(ContarIncidencias),
                    Tardanzas = g.Sum(x => x.IncidenciasCalculadas.Count(i => i.TipoIncidencia == TardanzaEntrada || i.TipoIncidencia == TardanzaSalida)),
                    SalidasAnticipadas = g.Sum(x => x.IncidenciasCalculadas.Count(i => i.TipoIncidencia == SalidaAnticipada)),
                    Omisiones = g.Sum(x => x.IncidenciasCalculadas.Count(i => i.TipoIncidencia == OmisionEntrada || i.TipoIncidencia == OmisionSalida)),
                    Justificadas = g.Where(x => x.Justificada).Sum(ContarIncidencias),
                    Pendientes = g.Sum(ContarIncidencias) - g.Where(x => x.Justificada).Sum(ContarIncidencias),
                    Descuento = g.Sum(x => x.IncidenciasCalculadas.Count(i => i.GeneraDescuento))
                });

            var orderBy = request.OrderBy?.ToLowerInvariant();
            var orderDirection = request.OrderDirection?.ToLowerInvariant();
            var ordered = (orderBy, orderDirection) switch
            {
                ("nomina", "asc") => resumen.OrderBy(x => x.Nomina),
                ("nomina", "desc") => resumen.OrderByDescending(x => x.Nomina),
                ("nombre", "asc") => resumen.OrderBy(x => x.Nombre),
                ("nombre", "desc") => resumen.OrderByDescending(x => x.Nombre),
                ("totalincidencias", "asc") => resumen.OrderBy(x => x.TotalIncidencias),
                ("totalincidencias", "desc") => resumen.OrderByDescending(x => x.TotalIncidencias),
                ("tardanzas", "asc") => resumen.OrderBy(x => x.Tardanzas),
                ("tardanzas", "desc") => resumen.OrderByDescending(x => x.Tardanzas),
                ("salidasanticipadas", "asc") => resumen.OrderBy(x => x.SalidasAnticipadas),
                ("salidasanticipadas", "desc") => resumen.OrderByDescending(x => x.SalidasAnticipadas),
                ("omisiones", "asc") => resumen.OrderBy(x => x.Omisiones),
                ("omisiones", "desc") => resumen.OrderByDescending(x => x.Omisiones),
                _ => resumen.OrderBy(x => x.Nombre)
            };

            var page = request.Page > 0 ? request.Page : 1;
            var pageSize = request.PageSize > 0 ? request.PageSize : 10;
            var items = ordered
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var totalCount = resumen.Count();

            EnrichWideEvent("GetResumenPorEmpleado", count: items.Count, additionalContext: new Dictionary<string, object>
            {
                ["page"] = page,
                ["pageSize"] = pageSize,
                ["totalCount"] = totalCount,
                ["periodo"] = request.Periodo ?? "default"
            });

            return new PagedResult<IncidenciasChecadoResumenEmpleadoResponse>
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };
        }
        catch (OperationCanceledException)
        {
            return new PagedResult<IncidenciasChecadoResumenEmpleadoResponse>
            {
                Items = new List<IncidenciasChecadoResumenEmpleadoResponse>(),
                TotalCount = 0,
                Page = request.Page > 0 ? request.Page : 1,
                PageSize = request.PageSize > 0 ? request.PageSize : 10
            };
        }
        catch (Exception ex)
        {
            EnrichWideEvent("GetResumenPorEmpleado", exception: ex);
            return CommonErrors.DatabaseError("consultar el resumen de incidencias por empleado");
        }
    }

    private async Task EnriquecerJustificacionesAsync(
        List<IncidenciaChecadoResponse> items,
        CancellationToken cancellationToken)
    {
        var nominas = items
            .Select(x => x.Nomina)
            .OfType<long>()
            .Distinct()
            .ToList();

        if (nominas.Count == 0)
            return;

        var nominaUsuario = await _empleadoRepository.ResolverIdsUsuarioPorNominasAsync(nominas, cancellationToken);
        var idUsuarios = nominaUsuario.Values.ToList();

        if (idUsuarios.Count == 0)
            return;

        var fechaMin = items.Min(x => x.Fecha);
        var fechaMax = items.Max(x => x.Fecha);

        var solicitudes = await _applicationDbContext.SolicitudesPersonal
            .AsNoTracking()
            .Include(s => s.Estado)
            .Include(s => s.TipoSolicitud)
            .Where(s =>
                idUsuarios.Contains(s.IdUsuarioSolicitante ?? s.IdUsuarioCreador)
                && s.FechaInicio.HasValue
                && s.Estado != null
                && s.Estado.Codigo == WorkflowEstadoCodigo.CERRADA
                && s.FechaInicio.Value.Date <= fechaMax.Date
                && (!s.FechaFin.HasValue || s.FechaFin.Value.Date >= fechaMin.Date))
            .Select(s => new
            {
                s.IdUsuarioCreador,
                s.IdUsuarioSolicitante,
                s.IdSolicitud,
                FechaInicio = s.FechaInicio!.Value,
                FechaFin = s.FechaFin,
                TipoSolicitudNombre = s.TipoSolicitud != null ? s.TipoSolicitud.Nombre : null
            })
            .ToListAsync(cancellationToken);

        var usuarioSolicitudes = solicitudes
            .Join(
                nominaUsuario,
                s => s.IdUsuarioSolicitante ?? s.IdUsuarioCreador,
                nu => nu.Value,
                (s, nu) => new { Nomina = nu.Key, Solicitud = s })
            .GroupBy(x => x.Nomina)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Solicitud).ToList());

        foreach (var item in items)
        {
            if (!item.Nomina.HasValue)
                continue;

            if (!usuarioSolicitudes.TryGetValue(item.Nomina.Value, out var solicitudesEmpleado))
                continue;

            var itemDate = item.Fecha.Date;
            var matching = solicitudesEmpleado
                .FirstOrDefault(s => s.FechaInicio.Date <= itemDate &&
                    (!s.FechaFin.HasValue || s.FechaFin.Value.Date >= itemDate));

            if (matching == null)
                continue;

            item.Justificada = true;
            item.IdSolicitud = matching.IdSolicitud;
            item.TipoSolicitudNombre = matching.TipoSolicitudNombre;
        }
    }

    private static (DateTime FechaInicio, DateTime FechaFin) CalcularRangoPeriodo(
        string? periodo,
        DateTime? fechaInicio,
        DateTime? fechaFin)
    {
        var hoy = DateTime.Today;

        return periodo?.ToLowerInvariant() switch
        {
            "hoy" => (hoy, hoy),
            "esta-semana" => CalcularSemana(hoy),
            "esta-quincena" => hoy.Day <= 15
                ? (new DateTime(hoy.Year, hoy.Month, 1), new DateTime(hoy.Year, hoy.Month, 15))
                : (new DateTime(hoy.Year, hoy.Month, 16), new DateTime(hoy.Year, hoy.Month, DateTime.DaysInMonth(hoy.Year, hoy.Month))),
            "quincena-anterior" => hoy.Day <= 15
                ? (new DateTime(hoy.Year, hoy.Month, 1).AddMonths(-1).AddDays(15), new DateTime(hoy.Year, hoy.Month, 1).AddDays(-1))
                : (new DateTime(hoy.Year, hoy.Month, 1), new DateTime(hoy.Year, hoy.Month, 15)),
            "este-mes" => (new DateTime(hoy.Year, hoy.Month, 1), new DateTime(hoy.Year, hoy.Month, DateTime.DaysInMonth(hoy.Year, hoy.Month))),
            "mes-anterior" => (new DateTime(hoy.Year, hoy.Month, 1).AddMonths(-1), new DateTime(hoy.Year, hoy.Month, 1).AddDays(-1)),
            "personalizado" => (fechaInicio ?? hoy, fechaFin ?? hoy),
            _ => (new DateTime(hoy.Year, hoy.Month, 1), new DateTime(hoy.Year, hoy.Month, DateTime.DaysInMonth(hoy.Year, hoy.Month)))
        };
    }

    private static bool CumpleFiltroTipos(
        IncidenciaChecadoResponse item,
        bool entrada,
        bool salida,
        bool omision)
    {
        var tipos = item.IncidenciasCalculadas;

        if (entrada && tipos.Any(i => i.TipoIncidencia == TardanzaEntrada))
            return true;
        if (salida && tipos.Any(i => i.TipoIncidencia == TardanzaSalida || i.TipoIncidencia == SalidaAnticipada))
            return true;
        if (omision && tipos.Any(i => i.TipoIncidencia == OmisionEntrada || i.TipoIncidencia == OmisionSalida))
            return true;

        return false;
    }

    private static IOrderedEnumerable<IncidenciaChecadoResponse> OrdenarItems(
        IEnumerable<IncidenciaChecadoResponse> items,
        string? orderBy,
        string? orderDirection)
    {
        var campo = orderBy?.ToLowerInvariant();
        var dir = orderDirection?.ToLowerInvariant();

        return (campo, dir) switch
        {
            ("nomina", "asc") => items.OrderBy(x => x.Nomina),
            ("nomina", "desc") => items.OrderByDescending(x => x.Nomina),
            ("nombre", "asc") => items.OrderBy(x => x.Nombre),
            ("nombre", "desc") => items.OrderByDescending(x => x.Nombre),
            ("empresa", "asc") => items.OrderBy(x => x.Empresa),
            ("empresa", "desc") => items.OrderByDescending(x => x.Empresa),
            ("departamento", "asc") => items.OrderBy(x => x.Departamento),
            ("departamento", "desc") => items.OrderByDescending(x => x.Departamento),
            ("fecha", "asc") => items.OrderBy(x => x.Fecha),
            ("fecha", "desc") => items.OrderByDescending(x => x.Fecha).ThenBy(x => x.Nombre),
            _ => items.OrderByDescending(x => x.Fecha).ThenBy(x => x.Nombre)
        };
    }

    private static (DateTime, DateTime) CalcularSemana(DateTime hoy)
    {
        var inicio = hoy.AddDays(-((int)hoy.DayOfWeek + 6) % 7);
        return (inicio, inicio.AddDays(6));
    }
}
