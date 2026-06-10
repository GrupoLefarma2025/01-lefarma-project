using ErrorOr;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.Config.Workflows.Handlers;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Lefarma.API.Features.Config.Workflows;

public class WorkflowQueryService : BaseService, IWorkflowQueryService
{
    private readonly IWorkflowEngine _engine;
    private readonly IWorkflowRepository _workflowRepo;
    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly IServiceProvider _serviceProvider;
    protected override string EntityName => "WorkflowQuery";

    public WorkflowQueryService(
        IWorkflowEngine engine,
        IWorkflowRepository workflowRepo,
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        IServiceProvider serviceProvider,
        IWideEventAccessor wideEventAccessor) : base(wideEventAccessor)
    {
        _engine = engine;
        _workflowRepo = workflowRepo;
        _context = context;
        _asokamContext = asokamContext;
        _serviceProvider = serviceProvider;
    }

    public async Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesDisponiblesAsync(
        int idWorkflow,
        int idEntidad,
        int idPasoActual,
        int idUsuario,
        string tipoEntidad,
        IWorkflowEntity entidadParaHandlers,
        CancellationToken ct = default)
    {
        try
        {
            if (idWorkflow == 0)
                return CommonErrors.Conflict("Workflow", "La entidad no tiene workflow asignado.");

            // 1. Acciones que el motor permite (filtra por participante, estado, etc.)
            var acciones = await _engine.GetAccionesDisponiblesAsync(
                idWorkflow, idEntidad, idUsuario, tipoEntidad);

            // 2. Cargar paso actual para metadata (RequiereComentario, etc.)
            var pasoActual = await _context.WorkflowPasos
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.IdPaso == idPasoActual, ct);

            // 3. Cargar todos los campos del workflow una sola vez
            var camposWorkflow = (await _workflowRepo.GetCamposAsync()).ToList();

            // 4. Por cada acción, cargar sus handlers y construir DTO
            var result = new List<AccionDisponibleResponse>();
            foreach (var a in acciones)
            {
                var handlers = (await _workflowRepo.GetAccionHandlersAsync(a.IdAccion)).ToList();
                var camposRequeridos = handlers
                    .Where(h => h.Requerido && h.Campo != null)
                    .Select(h => h.Campo!.NombreTecnico)
                    .ToList();

                result.Add(new AccionDisponibleResponse
                {
                    IdAccion = a.IdAccion,
                    IdTipoAccion = a.IdTipoAccion,
                    TipoAccionCodigo = a.TipoAccion?.Codigo,
                    TipoAccionNombre = a.TipoAccion?.Nombre,
                    TipoAccionCambiaEstado = a.TipoAccion?.CambiaEstado,
                    EnviaConcentrado = a.EnviaConcentrado,
                    Handlers = handlers.Select(h => new AccionHandlerMetadataResponse
                    {
                        IdHandler = h.IdHandler,
                        HandlerKey = h.HandlerKey,
                        Requerido = h.Requerido,
                        ConfiguracionJson = h.ConfiguracionJson,
                        OrdenEjecucion = h.OrdenEjecucion,
                        Campo = h.Campo != null ? new WorkflowCampoMetadataResponse
                        {
                            IdWorkflowCampo = h.Campo.IdWorkflowCampo,
                            NombreTecnico = h.Campo.NombreTecnico,
                            EtiquetaUsuario = h.Campo.EtiquetaUsuario,
                            TipoControl = h.Campo.TipoControl,
                            SourceCatalog = h.Campo.SourceCatalog
                        } : null
                    }).ToList(),
                    CamposWorkflow = camposWorkflow.Select(c => new WorkflowCampoMetadataResponse
                    {
                        IdWorkflowCampo = c.IdWorkflowCampo,
                        NombreTecnico = c.NombreTecnico,
                        EtiquetaUsuario = c.EtiquetaUsuario,
                        TipoControl = c.TipoControl,
                        SourceCatalog = c.SourceCatalog
                    }).ToList(),
                    CamposRequeridos = camposRequeridos,
                    RequiereComentario = pasoActual?.RequiereComentario ?? false,
                    RequiereAdjunto = pasoActual?.RequiereAdjunto ?? false,
                    PermiteAdjunto = pasoActual?.PermiteAdjunto ?? false
                });
            }

            // 5. Pre-evaluar handlers que tengan "mensaje" en su configuracionJson
            await PreEvaluarHandlersAsync(result, entidadParaHandlers, idEntidad, tipoEntidad, idUsuario, ct);

            EnrichWideEvent("GetAccionesDisponibles", entityId: idEntidad, count: result.Count);
            return result;
        }
        catch (Exception ex)
        {
            EnrichWideEvent("GetAccionesDisponibles", entityId: idEntidad, exception: ex);
            return CommonErrors.DatabaseError("obtener las acciones disponibles");
        }
    }

    private async Task PreEvaluarHandlersAsync(
        List<AccionDisponibleResponse> acciones,
        IWorkflowEntity entidad,
        int idEntidad,
        string tipoEntidad,
        int idUsuario,
        CancellationToken ct)
    {
        foreach (var response in acciones)
        {
            foreach (var handlerMeta in response.Handlers)
            {
                if (string.IsNullOrWhiteSpace(handlerMeta.ConfiguracionJson))
                    continue;

                string? mensaje = null;
                try
                {
                    using var doc = JsonDocument.Parse(handlerMeta.ConfiguracionJson);
                    if (doc.RootElement.TryGetProperty("mensaje", out var m))
                        mensaje = m.GetString();
                }
                catch { }

                if (mensaje is null) continue;

                // Alerta: solo informativo, siempre exito
                if (handlerMeta.HandlerKey == "Alerta")
                {
                    handlerMeta.ValidacionExito = true;
                    handlerMeta.ValidacionMensaje = mensaje;
                    continue;
                }

                // Demás handlers: ejecutar el handler real
                try
                {
                    var actionHandler = _serviceProvider.GetKeyedService<IWorkflowActionHandler>(handlerMeta.HandlerKey);
                    if (actionHandler == null) continue;

                    var ctx = new WorkflowHandlerContext(
                        Entidad: entidad,
                        IdEntidad: idEntidad,
                        TipoEntidad: tipoEntidad,
                        IdAccion: response.IdAccion,
                        IdUsuario: idUsuario,
                        Comentario: null,
                        DatosAdicionales: null);

                    var vr = await actionHandler.ProcessAsync(ctx, handlerMeta.ConfiguracionJson);
                    handlerMeta.ValidacionExito = vr.Exitoso;
                    handlerMeta.ValidacionMensaje = vr.Exitoso ? mensaje : (vr.Error ?? mensaje);
                }
                catch
                {
                    handlerMeta.ValidacionExito = null;
                    handlerMeta.ValidacionMensaje = mensaje;
                }
            }
        }
    }

    public async Task<ErrorOr<AccionMetadataResponse>> GetAccionMetadataAsync(
        int idWorkflow,
        int idPasoActual,
        int idAccion,
        int idEntidad,
        CancellationToken ct = default)
    {
        try
        {
            var pasoActual = await _context.WorkflowPasos
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.IdPaso == idPasoActual && p.Activo, ct);
            if (pasoActual is null)
                return CommonErrors.NotFound("PasoWorkflow", idPasoActual.ToString());

            var accion = await _context.WorkflowAcciones
                .AsNoTracking()
                .Include(a => a.TipoAccion)
                .FirstOrDefaultAsync(a => a.IdAccion == idAccion && a.Activo, ct);
            if (accion is null)
                return CommonErrors.NotFound("Accion", idAccion.ToString());

            var handlers = (await _workflowRepo.GetAccionHandlersAsync(idAccion)).ToList();
            var campos = (await _workflowRepo.GetCamposAsync()).ToList();

            var camposRequeridos = handlers
                .Where(h => h.Requerido && h.Campo != null)
                .Select(h => h.Campo!.NombreTecnico)
                .ToList();

            return new AccionMetadataResponse
            {
                IdEntidad = idEntidad,
                IdAccion = accion.IdAccion,
                IdTipoAccion = accion.IdTipoAccion,
                TipoAccionCodigo = accion.TipoAccion?.Codigo,
                TipoAccionNombre = accion.TipoAccion?.Nombre,
                TipoAccionCambiaEstado = accion.TipoAccion?.CambiaEstado,
                RequiereComentario = pasoActual.RequiereComentario,
                RequiereAdjunto = pasoActual.RequiereAdjunto,
                PermiteAdjunto = pasoActual.PermiteAdjunto,
                Handlers = handlers.Select(h => new AccionHandlerMetadataResponse
                {
                    IdHandler = h.IdHandler,
                    HandlerKey = h.HandlerKey,
                    Requerido = h.Requerido,
                    ConfiguracionJson = h.ConfiguracionJson,
                    OrdenEjecucion = h.OrdenEjecucion
                }).ToList(),
                CamposWorkflow = campos.Select(c => new WorkflowCampoMetadataResponse
                {
                    IdWorkflowCampo = c.IdWorkflowCampo,
                    NombreTecnico = c.NombreTecnico,
                    EtiquetaUsuario = c.EtiquetaUsuario,
                    TipoControl = c.TipoControl,
                    SourceCatalog = c.SourceCatalog
                }).ToList(),
                CamposRequeridos = camposRequeridos
            };
        }
        catch (Exception ex)
        {
            EnrichWideEvent("GetAccionMetadata", entityId: idEntidad, exception: ex);
            return CommonErrors.DatabaseError("obtener metadatos de acción");
        }
    }

    public async Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialWorkflowAsync(
        int idEntidad,
        string tipoEntidad,
        CancellationToken ct = default)
    {
        try
        {
            var historial = await _context.WorkflowBitacoras
                .AsNoTracking()
                .Where(b => b.TipoEntidad == tipoEntidad && b.IdEntidad == idEntidad)
                .OrderByDescending(b => b.FechaEvento)
                .Select(b => new HistorialWorkflowItemResponse
                {
                    IdEvento = b.IdEvento,
                    IdEntidad = b.IdEntidad,
                    IdPaso = b.IdPaso,
                    NombrePaso = b.Paso != null ? b.Paso.NombrePaso : null,
                    IdAccion = b.IdAccion,
                    NombreAccion = b.Accion != null && b.Accion.TipoAccion != null ? b.Accion.TipoAccion.Nombre : null,
                    IdUsuario = b.IdUsuario,
                    NombreUsuario = null,
                    Comentario = b.Comentario,
                    DatosSnapshot = b.DatosSnapshot,
                    FechaEvento = b.FechaEvento
                })
                .ToListAsync(ct);

            if (historial.Count == 0)
            {
                EnrichWideEvent("GetHistorialWorkflow", entityId: idEntidad, count: 0);
                return new List<HistorialWorkflowItemResponse>();
            }

            var userIds = historial.Select(h => h.IdUsuario).Distinct().ToList();
            var userMap = await _asokamContext.Usuarios
                .AsNoTracking()
                .Where(u => userIds.Contains(u.IdUsuario))
                .Select(u => new { u.IdUsuario, u.NombreCompleto })
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto, ct);

            foreach (var item in historial)
            {
                if (userMap.TryGetValue(item.IdUsuario, out var nombre))
                    item.NombreUsuario = nombre;
            }

            EnrichWideEvent("GetHistorialWorkflow", entityId: idEntidad, count: historial.Count);
            return historial;
        }
        catch (Exception ex)
        {
            EnrichWideEvent("GetHistorialWorkflow", entityId: idEntidad, exception: ex);
            return CommonErrors.DatabaseError("obtener historial de workflow");
        }
    }
}