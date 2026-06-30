using ErrorOr;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.SolicitudesPersonal;
using Lefarma.API.Features.Config.Workflows;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal;

public class SolicitudPersonalFirmasService : BaseService, ISolicitudPersonalFirmasService
{
    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly ISolicitudPersonalRepository _solicitudRepo;
    private readonly IWorkflowEngine _engine;
    private readonly IWorkflowRepository _workflowRepo;
    private readonly IWorkflowQueryService _queryService;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IJefeInmediatoResolver _jefeInmediatoResolver;
    protected override string EntityName => "SolicitudPersonalFirma";

    public SolicitudPersonalFirmasService(
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        ISolicitudPersonalRepository solicitudRepo,
        IWorkflowEngine engine,
        IWorkflowRepository workflowRepo,
        IWorkflowQueryService queryService,
        IServiceScopeFactory scopeFactory,
        IJefeInmediatoResolver jefeInmediatoResolver,
        IWideEventAccessor wideEventAccessor) : base(wideEventAccessor)
    {
        _context = context;
        _asokamContext = asokamContext;
        _solicitudRepo = solicitudRepo;
        _engine = engine;
        _workflowRepo = workflowRepo;
        _queryService = queryService;
        _scopeFactory = scopeFactory;
        _jefeInmediatoResolver = jefeInmediatoResolver;
    }

    public async Task<ErrorOr<FirmarResponse>> FirmarAsync(int idSolicitud, FirmarRequest request, int idUsuario)
    {
        try
        {
            // 1. Cargar solicitud con estado
            var solicitud = await _solicitudRepo.GetByIdAsync(idSolicitud);
            if (solicitud is null)
            {
                EnrichWideEvent("Firmar", entityId: idSolicitud, notFound: true);
                return CommonErrors.NotFound("SolicitudPersonal", idSolicitud.ToString());
            }

            // 2. Validar estado no terminal
            if (solicitud.Estado?.Codigo is "CERRADA" or "CANCELADA" or "RECHAZADA")
                return CommonErrors.Conflict("SolicitudPersonal",
                    $"La solicitud {solicitud.Folio} ya está en estado terminal.");

            // 3. Cargar workflow config
            var workflowConfig = await _workflowRepo.GetQueryable()
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                        .ThenInclude(a => a.Notificaciones)
                            .ThenInclude(n => n.Canales)
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.Participantes)
                .FirstOrDefaultAsync(w => w.IdWorkflow == solicitud.IdWorkflow);

            if (workflowConfig is null)
                return CommonErrors.NotFound("Workflow", solicitud.IdWorkflow.ToString());

            // Paso actual
            var pasoActual = workflowConfig.Pasos.FirstOrDefault(p => p.IdPaso == solicitud.IdPasoActual);
            if (pasoActual is null || !pasoActual.Activo)
                return CommonErrors.Conflict("solicitud", "La solicitud no tiene un paso activo válido.");

            // 4. Validar participante
            var validacion = await WorkflowFirmaHelper.ValidarParticipanteAsync(
                pasoActual, idUsuario, solicitud.IdUsuarioCreador, _asokamContext, _jefeInmediatoResolver);
            if (validacion.IsError)
                return validacion.Errors;

            // 5. Ejecutar motor
            var ctx = new WorkflowContext(
                IdWorkflow: solicitud.IdWorkflow,
                IdEntidad: solicitud.IdSolicitud,
                TipoEntidad: CodigoProceso.SOLICITUD_PERSONAL,
                Entidad: solicitud,
                IdAccion: request.IdAccion,
                IdUsuario: idUsuario,
                Orden: null,
                Comentario: request.Comentario,
                DatosAdicionales: request.DatosAdicionales);
            var resultado = await _engine.EjecutarAccionAsync(ctx);
            if (!resultado.Exitoso)
                return CommonErrors.Validation("Workflow", resultado.Error ?? "Error en el motor.");

            // 6. Actualizar estado y campos específicos
            solicitud.IdPasoActual = resultado.NuevoIdPaso;
            if (resultado.NuevoIdEstado.HasValue)
                solicitud.IdEstado = resultado.NuevoIdEstado.Value;

            // Lógica específica SP: setear FechaEnvio en acción ENVIAR
            var accion = workflowConfig.Pasos
                .SelectMany(p => p.AccionesOrigen)
                .FirstOrDefault(a => a.IdAccion == request.IdAccion);
            if (accion?.TipoAccion?.Codigo == "ENVIAR" && !solicitud.FechaEnvio.HasValue)
                solicitud.FechaEnvio = DateTime.UtcNow;

            solicitud.FechaModificacion = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // 7. Resolver notificación
            var notificacion = WorkflowFirmaHelper.ResolverNotificacion(
                workflowConfig, request.IdAccion, resultado.NuevoIdPaso);

            // 8. ★ Disparar notificación fire-and-forget (helper)
            var variables = await ConstruirVariablesNotificacionAsync(solicitud);
            WorkflowFirmaHelper.DispatchNotificacionFireAndForget(
                scopeFactory: _scopeFactory,
                notificacion: notificacion,
                tipoEntidad: CodigoProceso.SOLICITUD_PERSONAL,
                idEntidad: solicitud.IdSolicitud,
                folio: solicitud.Folio,
                idUsuarioCreador: solicitud.IdUsuarioCreador,
                variablesExtra: variables,
                idPasoDestino: resultado.NuevoIdPaso,
                idUsuarioActual: idUsuario,
                comentario: request.Comentario,
                contenidoAdicionalHtml: null);

            var nuevoEstado = await _context.WorkflowEstados.FindAsync(solicitud.IdEstado);
            EnrichWideEvent("Firmar", entityId: idSolicitud, nombre: solicitud.Folio,
                additionalContext: new Dictionary<string, object>
                {
                    ["estadoAnterior"] = solicitud.Estado?.Codigo,
                    ["nuevoEstado"] = nuevoEstado?.Codigo,
                    ["idAccion"] = request.IdAccion
                });

            return new FirmarResponse
            {
                Exitoso = true,
                Folio = solicitud.Folio,
                EstadoAnterior = solicitud.Estado?.Codigo,
                NuevoEstado = nuevoEstado?.Codigo,
                Mensaje = $"Acción ejecutada exitosamente. Estado: {nuevoEstado?.Codigo}"
            };
        }
        catch (Exception ex)
        {
            EnrichWideEvent("Firmar", entityId: idSolicitud, exception: ex);
            return CommonErrors.InternalServerError("Error inesperado al procesar la firma.");
        }
    }

    public async Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesDisponiblesAsync(
        int idSolicitud, int idUsuario)
    {
        var solicitud = await _solicitudRepo.GetByIdAsync(idSolicitud);
        if (solicitud is null)
            return CommonErrors.NotFound("SolicitudPersonal", idSolicitud.ToString());

        if (!solicitud.IdPasoActual.HasValue)
            return CommonErrors.Conflict("solicitud", "La solicitud no tiene paso actual.");

        return await _queryService.GetAccionesDisponiblesAsync(
            idWorkflow: solicitud.IdWorkflow,
            idEntidad: solicitud.IdSolicitud,
            idPasoActual: solicitud.IdPasoActual.Value,
            idUsuario: idUsuario,
            tipoEntidad: CodigoProceso.SOLICITUD_PERSONAL,
            entidadParaHandlers: solicitud);
    }

    public async Task<ErrorOr<AccionMetadataResponse>> GetAccionMetadataAsync(
        int idSolicitud, int idAccion, int idUsuario)
    {
        var solicitud = await _solicitudRepo.GetByIdAsync(idSolicitud);
        if (solicitud is null)
            return CommonErrors.NotFound("SolicitudPersonal", idSolicitud.ToString());

        if (!solicitud.IdPasoActual.HasValue)
            return CommonErrors.Conflict("solicitud", "La solicitud no tiene paso actual.");

        return await _queryService.GetAccionMetadataAsync(
            idWorkflow: solicitud.IdWorkflow,
            idPasoActual: solicitud.IdPasoActual.Value,
            idAccion: idAccion,
            idEntidad: solicitud.IdSolicitud);
    }

    public Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialAsync(int idSolicitud)
        => _queryService.GetHistorialWorkflowAsync(idSolicitud, CodigoProceso.SOLICITUD_PERSONAL);

    private async Task<Dictionary<string, string>> ConstruirVariablesNotificacionAsync(SolicitudPersonal solicitud)
    {
        var tipo = await _solicitudRepo.GetTipoSolicitudAsync(solicitud.IdTipoSolicitud);
        return new Dictionary<string, string>
        {
            ["TipoSolicitud"] = tipo?.Nombre ?? "",
            ["Categoria"] = tipo?.Categoria.ToString() ?? "",
            ["Motivo"] = solicitud.Motivo ?? "",
            ["FechaInicio"] = solicitud.FechaInicio?.ToString("yyyy-MM-dd") ?? "",
            ["FechaFin"] = solicitud.FechaFin?.ToString("yyyy-MM-dd") ?? "",
            ["DiasSolicitados"] = solicitud.DiasSolicitados?.ToString() ?? "",
            ["LugarComision"] = solicitud.LugarComision ?? ""
        };
    }
}