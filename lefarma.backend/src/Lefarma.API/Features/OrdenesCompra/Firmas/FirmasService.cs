using ErrorOr;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.Operaciones;
using Lefarma.API.Features.OrdenesCompra.Firmas.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Lefarma.API.Features.OrdenesCompra.Firmas
{
    public class FirmasService : BaseService, IFirmasService
    {
        private readonly IOrdenCompraRepository _ordenRepo;
        private readonly IWorkflowEngine _engine;
        private readonly IWorkflowRepository _workflowRepo;
        private readonly ApplicationDbContext _context;
        private readonly AsokamDbContext _asokamContext;
        private readonly IServiceScopeFactory _scopeFactory;
        protected override string EntityName => "Firma";

        public FirmasService(
            IOrdenCompraRepository ordenRepo,
            IWorkflowEngine engine,
            IWorkflowRepository workflowRepo,
            ApplicationDbContext context,
            AsokamDbContext asokamContext,
            IServiceScopeFactory scopeFactory,
            IWideEventAccessor wideEventAccessor)
            : base(wideEventAccessor)
        {
            _ordenRepo = ordenRepo;
            _engine = engine;
            _workflowRepo = workflowRepo;
            _context = context;
            _asokamContext = asokamContext;
            _scopeFactory = scopeFactory;
        }

        public async Task<ErrorOr<FirmarResponse>> FirmarAsync(int idOrden, FirmarRequest request, int idUsuario)
        {
            try
            {
                var orden = await _ordenRepo.GetWithPartidasAsync(idOrden);
                if (orden is null)
                {
                    EnrichWideEvent("Firmar", entityId: idOrden, notFound: true);
                    return CommonErrors.NotFound("OrdenCompra", idOrden.ToString());
                }

                if (orden.IdEstado == 7 || orden.IdEstado == 9) // 7 = CERRADA, 9 = CANCELADA
                    return CommonErrors.Conflict("OrdenCompra", $"La orden {orden.Folio} ya está cerrada o cancelada.");

                var workflowConfig = await _workflowRepo.GetQueryable()
                    .Include(w => w.Pasos)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == orden.IdWorkflow);

                var estadoAnterior = orden.Estado?.Codigo;

                // Construir contexto pasando el Total para que las condiciones puedan evaluarlo
                var datosAdicionales = request.DatosAdicionales ?? new Dictionary<string, object>();
                datosAdicionales["Total"] = orden.Total;

                // Ejecutar el motor de workflow
                var ctx = new WorkflowContext(
                    IdWorkflow: orden.IdWorkflow,
                    IdOrden: idOrden,
                    IdAccion: request.IdAccion,
                    IdUsuario: idUsuario,
                    Orden: orden,
                    Comentario: request.Comentario,
                    DatosAdicionales: datosAdicionales
                );

                var resultado = await _engine.EjecutarAccionAsync(ctx);
                if (!resultado.Exitoso)
                    return CommonErrors.Validation("Workflow", resultado.Error ?? "Error en el motor de workflow.");

                // Actualizar estado de la orden
                var nuevoIdEstado = resultado.NuevoIdEstado; //MapEstadoId(resultado.NuevoIdEstado);
                if (nuevoIdEstado.HasValue)
                {
                    orden.IdEstado = nuevoIdEstado.Value;
                    if (nuevoIdEstado == 3) // 3 = AUTORIZADA
                        orden.FechaAutorizacion = DateTime.UtcNow;
                }

                orden.IdPasoActual = resultado.NuevoIdPaso;
                orden.FechaModificacion = DateTime.UtcNow;
                await _ordenRepo.UpdateAsync(orden);

                // Selección de plantilla por destino: (id_accion + id_paso_destino) con fallback genérico.
                var notificacionSeleccionada = ResolveWorkflowNotification(workflowConfig, request.IdAccion, resultado.NuevoIdPaso);

                // Dispatch notificación como fire-and-forget con scope propio:
                // los DbContext son scoped y el scope HTTP termina antes de que este task corra.
                var notifSnapshot = notificacionSeleccionada;
                var ordenId = orden.IdOrden;
                var folioSnapshot = orden.Folio;
                var pasoDestino = resultado.NuevoIdPaso;
                var comentarioSnapshot = request.Comentario;
                _ = Task.Run(async () =>
                {
                    using var scope = _scopeFactory.CreateScope();
                    var dispatcher = scope.ServiceProvider.GetRequiredService<IWorkflowNotificationDispatcher>();
                    // Necesitamos la orden completa: la recargamos dentro del scope nuevo
                    var ordenRepo = scope.ServiceProvider.GetRequiredService<IOrdenCompraRepository>();
                    var ordenFresh = await ordenRepo.GetWithPartidasAsync(ordenId);
                    if (ordenFresh is null) return;
                    await dispatcher.DispatchAsync(notifSnapshot, ordenFresh, pasoDestino, idUsuario, comentarioSnapshot);
                });

                EnrichWideEvent("Firmar", entityId: idOrden, nombre: orden.Folio,
                    additionalContext: new Dictionary<string, object>
                    {
                        ["estadoAnterior"] = estadoAnterior,
                        ["nuevoEstado"] = orden.IdEstado,
                        ["idAccion"] = request.IdAccion,
                        ["idPasoDestino"] = resultado.NuevoIdPaso,
                        ["idNotificacionSeleccionada"] = notificacionSeleccionada?.IdNotificacion
                    });

                return new FirmarResponse
                {
                    Exitoso = true,
                    Folio = orden.Folio,
                    EstadoAnterior = estadoAnterior,
                    NuevoEstado = orden.IdEstado.ToString(),
                    Mensaje = $"Acción ejecutada exitosamente. Estado: {orden.Estado}"
                };
            }
            catch (Exception ex)
            {
                EnrichWideEvent("Firmar", entityId: idOrden, exception: ex);
                return CommonErrors.InternalServerError("Error inesperado al procesar la firma.");
            }
        }

        public async Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesAsync(int idOrden, int idUsuario)
        {
            try
            {
                var orden = await _ordenRepo.GetWithPartidasAsync(idOrden);
                if (orden is null)
                    return CommonErrors.NotFound("OrdenCompra", idOrden.ToString());
                
                if (orden.IdWorkflow == 0)
                    return CommonErrors.Conflict("orden", "La orden no tiene workflow asignado.");

                var acciones = await _engine.GetAccionesDisponiblesAsync(orden.IdWorkflow, idOrden, idUsuario);
                if (!acciones.Any())
                    return CommonErrors.NotFound("Accion");

                var workflow = await _workflowRepo.GetQueryable()
                    .Include(w => w.Pasos)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == orden.IdWorkflow);
                var pasoActual = workflow?.Pasos.FirstOrDefault(p => p.IdPaso == orden.IdPasoActual);
                
                // Obtener campos del workflow una sola vez
                var camposWorkflow = (await _workflowRepo.GetCamposByWorkflowAsync(orden.IdWorkflow)).ToList();

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
                        TipoAccionCodigo = a.TipoAccion != null ? a.TipoAccion.Codigo : null,
                        TipoAccionNombre = a.TipoAccion != null ? a.TipoAccion.Nombre : null,
                        TipoAccionCambiaEstado = a.TipoAccion != null ? a.TipoAccion.CambiaEstado : null,
                        Handlers = handlers.Select(h => new AccionHandlerMetadataResponse
                        {
                            IdHandler = h.IdHandler,
                            HandlerKey = h.HandlerKey,
                            Requerido = h.Requerido,
                            ConfiguracionJson = h.ConfiguracionJson,
                            OrdenEjecucion = h.OrdenEjecucion
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

                return result;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetAcciones", entityId: idOrden, exception: ex);
                return CommonErrors.DatabaseError("obtener las acciones disponibles");
            }
        }

        public async Task<ErrorOr<AccionMetadataResponse>> GetAccionMetadataAsync(int idOrden, int idAccion, int idUsuario)
        {
            try
            {
                var orden = await _ordenRepo.GetWithPartidasAsync(idOrden);
                if (orden is null)
                    return CommonErrors.NotFound("OrdenCompra", idOrden.ToString());

                var workflow = await _workflowRepo.GetQueryable()
                    .Include(w => w.Pasos)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == orden.IdWorkflow);
                if (workflow is null)
                    return CommonErrors.NotFound("workflow", orden.IdWorkflow.ToString());

                if (!orden.IdPasoActual.HasValue)
                    return CommonErrors.Conflict("orden", "La orden no tiene paso actual configurado.");

                var pasoActual = workflow.Pasos.FirstOrDefault(p => p.IdPaso == orden.IdPasoActual.Value && p.Activo);
                if (pasoActual is null)
                    return CommonErrors.NotFound("PasoWorkflow", orden.IdPasoActual.Value.ToString());

                var accion = pasoActual.AccionesOrigen.FirstOrDefault(a => a.IdAccion == idAccion && a.Activo);
                if (accion is null)
                    return CommonErrors.NotFound("acción", idAccion.ToString());

                var handlers = (await _workflowRepo.GetAccionHandlersAsync(idAccion)).ToList();
                var campos = (await _workflowRepo.GetCamposByWorkflowAsync(workflow.IdWorkflow)).ToList();

                // CamposRequeridos: nombres técnicos de campos vinculados a handlers requeridos activos
                var camposRequeridos = handlers
                    .Where(h => h.Requerido && h.Campo != null)
                    .Select(h => h.Campo!.NombreTecnico)
                    .ToList();

                return new AccionMetadataResponse
                {
                    IdOrden = idOrden,
                    IdAccion = accion.IdAccion,
                    IdTipoAccion = accion.IdTipoAccion,
                    TipoAccionCodigo = accion.TipoAccion != null ? accion.TipoAccion.Codigo : null,
                    TipoAccionNombre = accion.TipoAccion != null ? accion.TipoAccion.Nombre : null,
                    TipoAccionCambiaEstado = accion.TipoAccion != null ? accion.TipoAccion.CambiaEstado : null,
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
                    CamposRequeridos = camposRequeridos.ToList()
                };
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetAccionMetadata", entityId: idOrden, exception: ex, additionalContext: new Dictionary<string, object> { ["idAccion"] = idAccion });
                return CommonErrors.DatabaseError("obtener metadatos de acción");
            }
        }

        public async Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialWorkflowAsync(int idOrden)
        {
            try
            {
                var orden = await _ordenRepo.GetWithPartidasAsync(idOrden);
                if (orden is null)
                {
                    EnrichWideEvent("GetHistorialWorkflow", entityId: idOrden, notFound: true);
                    return CommonErrors.NotFound("OrdenCompra", idOrden.ToString());
                }

                var historial = await _context.WorkflowBitacoras
                    .AsNoTracking()
                    .Where(b => b.IdOrden == idOrden)
                    .OrderByDescending(b => b.FechaEvento)
                    .Select(b => new HistorialWorkflowItemResponse
                    {
                        IdEvento = b.IdEvento,
                        IdOrden = b.IdOrden,
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
                    .ToListAsync();

                if (!historial.Any())
                {
                    EnrichWideEvent("GetHistorialWorkflow", entityId: idOrden, count: 0);
                    return CommonErrors.NotFound("HistorialWorkflow");
                }

                var userIds = historial.Select(h => h.IdUsuario).Distinct().ToList();
                var userMap = await _asokamContext.Usuarios
                    .AsNoTracking()
                    .Where(u => userIds.Contains(u.IdUsuario))
                    .Select(u => new { u.IdUsuario, u.NombreCompleto })
                    .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto);

                foreach (var item in historial)
                {
                    if (userMap.TryGetValue(item.IdUsuario, out var nombre))
                        item.NombreUsuario = nombre;
                }

                EnrichWideEvent("GetHistorialWorkflow", entityId: idOrden, count: historial.Count);
                return historial;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetHistorialWorkflow", entityId: idOrden, exception: ex);
                return CommonErrors.DatabaseError("obtener historial de workflow");
            }
        }

        // Acción de Autorizar desde paso 4 (GAF → Director / Tesorería según condiciones)
        private const int ACCION_AUTORIZAR_PASO4 = 8;

        public async Task<ErrorOr<EnvioConcentradoResponse>> EnvioConcentradoAsync(EnvioConcentradoRequest request, int idUsuario)
        {
            try
            {
                var resultados = new List<EnvioConcentradoItemResult>();

                foreach (var idOrden in request.IdsOrdenes)
                {
                    var firmarReq = new FirmarRequest
                    {
                        IdAccion = ACCION_AUTORIZAR_PASO4,
                        Comentario = request.Comentario ?? "Enviado en lote desde Concentrado de Órdenes"
                    };

                    var resultado = await FirmarAsync(idOrden, firmarReq, idUsuario);

                    if (resultado.IsError)
                    {
                        var firstError = resultado.FirstError;
                        resultados.Add(new EnvioConcentradoItemResult
                        {
                            IdOrden = idOrden,
                            Folio = $"OC-{idOrden}",
                            Exitoso = false,
                            Error = firstError.Description
                        });
                    }
                    else
                    {
                        resultados.Add(new EnvioConcentradoItemResult
                        {
                            IdOrden = idOrden,
                            Folio = resultado.Value.Folio,
                            Exitoso = true,
                            NuevoEstado = resultado.Value.NuevoEstado
                        });
                    }
                }

                var exitosas = resultados.Count(r => r.Exitoso);
                EnrichWideEvent("EnvioConcentrado", additionalContext: new Dictionary<string, object>
                {
                    ["total"] = request.IdsOrdenes.Count,
                    ["exitosas"] = exitosas,
                    ["fallidas"] = resultados.Count - exitosas
                });

                return new EnvioConcentradoResponse
                {
                    Total = request.IdsOrdenes.Count,
                    Exitosas = exitosas,
                    Fallidas = resultados.Count - exitosas,
                    Resultados = resultados
                };
            }
            catch (Exception ex)
            {
                EnrichWideEvent("EnvioConcentrado", exception: ex);
                return CommonErrors.InternalServerError("Error inesperado al procesar el envío concentrado.");
            }
        }

        private async Task<int?> GetEstadoIdByCodigoAsync(string codigo)
        {
            var estado = await _context.WorkflowEstados
                .FirstOrDefaultAsync(e => e.Codigo == codigo.ToUpper());
            return estado?.IdEstado;
        }

        private static Domain.Entities.Config.WorkflowNotificacion? ResolveWorkflowNotification(
            Domain.Entities.Config.Workflow? workflow,
            int idAccion,
            int? idPasoDestino)
        {
            var accion = workflow?.Pasos
                .SelectMany(p => p.AccionesOrigen)
                .FirstOrDefault(a => a.IdAccion == idAccion && a.Activo);

            if (accion is null)
                return null;

            return accion.Notificaciones.FirstOrDefault(n => n.Activo && n.IdPasoDestino == idPasoDestino)
                ?? accion.Notificaciones.FirstOrDefault(n => n.Activo && n.IdPasoDestino == null);
        }
    }
}
