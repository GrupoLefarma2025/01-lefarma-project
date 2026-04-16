using ErrorOr;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Config.Workflows
{
public class WorkflowService : BaseService, IWorkflowService
    {
        private readonly IWorkflowRepository _repo;
        private readonly ApplicationDbContext _context;
        private readonly INotificationService _notificationService;
        protected override string EntityName => "Workflow";

        public WorkflowService(IWorkflowRepository repo, ApplicationDbContext context, IWideEventAccessor wideEventAccessor, INotificationService notificationService)
            : base(wideEventAccessor)
        {
            _repo = repo;
            _context = context;
            _notificationService = notificationService;
        }

        public async Task<ErrorOr<IEnumerable<WorkflowResponse>>> GetAllAsync(WorkflowRequest query)
        {
            try
            {
                var q = _repo.GetQueryable()
                    .Include(w => w.Campos)
                    .Include(w => w.Pasos).ThenInclude(p => p.AccionesOrigen).ThenInclude(a => a.Notificaciones).ThenInclude(n => n.Canales)
                    .Include(w => w.Pasos).ThenInclude(p => p.AccionesOrigen).ThenInclude(a => a.AccionHandlers).ThenInclude(h => h.Campo)
                    .Include(w => w.Pasos).ThenInclude(p => p.Condiciones)
                    .Include(w => w.Pasos).ThenInclude(p => p.Participantes)
                    .AsQueryable();

                if (!string.IsNullOrWhiteSpace(query.CodigoProceso))
                    q = q.Where(w => w.CodigoProceso.Contains(query.CodigoProceso));
                if (query.Activo.HasValue)
                    q = q.Where(w => w.Activo == query.Activo.Value);

                var items = await q.OrderBy(w => w.Nombre).ToListAsync();
                if (!items.Any())
                {
                    EnrichWideEvent("GetAll", count: 0);
                    return CommonErrors.NotFound("Workflows");
                }

                var response = items.Select(ToResponse).ToList();
                EnrichWideEvent("GetAll", count: response.Count);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetAll", exception: ex);
                return CommonErrors.DatabaseError("obtener los workflows");
            }
        }

        public async Task<ErrorOr<WorkflowResponse>> GetByIdAsync(int id)
        {
            try
            {
                var item = await _repo.GetQueryable()
                    .Include(w => w.Campos)
                    .Include(w => w.Pasos).ThenInclude(p => p.AccionesOrigen).ThenInclude(a => a.Notificaciones).ThenInclude(n => n.Canales)
                    .Include(w => w.Pasos).ThenInclude(p => p.AccionesOrigen).ThenInclude(a => a.AccionHandlers).ThenInclude(h => h.Campo)
                    .Include(w => w.Pasos).ThenInclude(p => p.Condiciones)
                    .Include(w => w.Pasos).ThenInclude(p => p.Participantes)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == id);

                if (item is null)
                {
                    EnrichWideEvent("GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("workflow", id.ToString());
                }

                EnrichWideEvent("GetById", entityId: id, nombre: item.Nombre);
                return ToResponse(item);
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetById", entityId: id, exception: ex);
                return CommonErrors.DatabaseError("obtener el workflow");
            }
        }

        public async Task<ErrorOr<WorkflowResponse>> GetByCodigoProcesoAsync(string codigoProceso)
        {
            try
            {
                var item = await _repo.GetByCodigoProcesoAsync(codigoProceso);
                if (item is null) return CommonErrors.NotFound("workflow", codigoProceso);
                return ToResponse(item);
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetByCodigo", exception: ex);
                return CommonErrors.DatabaseError("obtener el workflow");
            }
        }

        public async Task<ErrorOr<WorkflowResponse>> CreateAsync(CreateWorkflowRequest request)
        {
            try
            {
                if (await _repo.ExistsAsync(w => w.CodigoProceso == request.CodigoProceso.ToUpper()))
                {
                    EnrichWideEvent("Create", nombre: request.CodigoProceso, duplicate: true);
                    return CommonErrors.AlreadyExists("workflow", "codigo_proceso", request.CodigoProceso);
                }

                var entity = new Workflow
                {
                    Nombre = request.Nombre.Trim(),
                    Descripcion = request.Descripcion,
                    CodigoProceso = request.CodigoProceso.Trim().ToUpper(),
                    FechaCreacion = DateTime.UtcNow
                };

                var result = await _repo.AddAsync(entity);
                EnrichWideEvent("Create", entityId: result.IdWorkflow, nombre: result.Nombre);
                return ToResponse(result);
            }
            catch (Exception ex)
            {
                EnrichWideEvent("Create", nombre: request.Nombre, exception: ex);
                return CommonErrors.DatabaseError("guardar el workflow");
            }
        }

        public async Task<ErrorOr<WorkflowResponse>> UpdateAsync(int id, UpdateWorkflowRequest request)
        {
            try
            {
                var entity = await _repo.GetByIdAsync(id);
                if (entity is null)
                {
                    EnrichWideEvent("Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("workflow", id.ToString());
                }

                entity.Nombre = request.Nombre.Trim();
                entity.Descripcion = request.Descripcion;
                entity.Activo = request.Activo;

                var result = await _repo.UpdateAsync(entity);
                EnrichWideEvent("Update", entityId: id, nombre: result.Nombre);
                return ToResponse(result);
            }
            catch (Exception ex)
            {
                EnrichWideEvent("Update", entityId: id, exception: ex);
                return CommonErrors.DatabaseError("actualizar el workflow");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var entity = await _repo.GetByIdAsync(id);
                if (entity is null)
                {
                    EnrichWideEvent("Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("workflow", id.ToString());
                }

                var eliminado = await _repo.DeleteAsync(entity);
                if (!eliminado)
                {
                    EnrichWideEvent("Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("workflow");
                }

                EnrichWideEvent("Delete", entityId: id, nombre: entity.Nombre);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent("Delete", entityId: id, exception: ex);
                return CommonErrors.HasDependencies("workflow");
            }
            catch (Exception ex)
            {
                EnrichWideEvent("Delete", entityId: id, exception: ex);
                return CommonErrors.DatabaseError("eliminar el workflow");
            }
        }

        public async Task<ErrorOr<WorkflowPasoResponse>> UpdatePasoAsync(int idWorkflow, int idPaso, UpdatePasoRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos).ThenInclude(p => p.AccionesOrigen).ThenInclude(a => a.AccionHandlers).ThenInclude(h => h.Campo)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                {
                    EnrichWideEvent("UpdatePaso", entityId: idWorkflow, notFound: true);
                    return CommonErrors.NotFound($"Workflow con ID {idWorkflow}");
                }

                var paso = workflow.Pasos.FirstOrDefault(p => p.IdPaso == idPaso);
                if (paso == null)
                {
                    EnrichWideEvent("UpdatePaso", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["notFound"] = true });
                    return CommonErrors.NotFound($"Paso con ID {idPaso}");
                }

                if (!request.Activo)
                {
                    if (workflow.Pasos.Count(p => p.Activo) <= 1)
                        return CommonErrors.Conflict("paso", "No se puede inactivar el �ltimo paso activo del workflow.");

                    var tieneOrdenesEnPaso = await _context.OrdenesCompra.AnyAsync(o => o.IdPasoActual == idPaso);
                    if (tieneOrdenesEnPaso)
                        return CommonErrors.Conflict("paso", "No se puede inactivar un paso usado por �rdenes de compra.");

                var accionesQueApuntanAlPaso = workflow.Pasos
                    .Where(p => p.IdPaso != idPaso && p.Activo)
                    .SelectMany(p => p.AccionesOrigen)
                    .Any(a => a.Activo && a.IdPasoDestino == idPaso);
                    if (accionesQueApuntanAlPaso)
                        return CommonErrors.Conflict("paso", "No se puede inactivar el paso porque hay acciones activas que lo usan como destino.");

                var condicionesQueApuntanAlPaso = workflow.Pasos
                    .Where(p => p.IdPaso != idPaso && p.Activo)
                    .SelectMany(p => p.Condiciones)
                    .Any(c => c.Activo && c.IdPasoSiCumple == idPaso);
                    if (condicionesQueApuntanAlPaso)
                        return CommonErrors.Conflict("paso", "No se puede inactivar el paso porque hay condiciones activas que lo usan como destino.");
                }

                // Actualizar propiedades del paso
                paso.NombrePaso = request.NombrePaso;
                paso.Orden = request.Orden;
                paso.CodigoEstado = request.CodigoEstado;
                paso.DescripcionAyuda = request.DescripcionAyuda;
                paso.EsInicio = request.EsInicio;
                paso.EsFinal = request.EsFinal;
                paso.Activo = request.Activo;
                paso.RequiereFirma = request.RequiereFirma;
                paso.RequiereComentario = request.RequiereComentario;
                paso.RequiereAdjunto = request.RequiereAdjunto;
                paso.PermiteAdjunto = request.PermiteAdjunto;

                var response = new WorkflowPasoResponse
                {
                    IdPaso = paso.IdPaso,
                    Orden = paso.Orden,
                    NombrePaso = paso.NombrePaso,
                    CodigoEstado = paso.CodigoEstado,
                    DescripcionAyuda = paso.DescripcionAyuda,
                    EsInicio = paso.EsInicio,
                    EsFinal = paso.EsFinal,
                    Activo = paso.Activo,
                    RequiereFirma = paso.RequiereFirma,
                    RequiereComentario = paso.RequiereComentario,
                    RequiereAdjunto = paso.RequiereAdjunto,
                    PermiteAdjunto = paso.PermiteAdjunto,
                    Acciones = paso.AccionesOrigen.Select(a => new WorkflowAccionResponse
                    {
                        IdAccion = a.IdAccion,
                        NombreAccion = a.NombreAccion,
                        TipoAccion = a.TipoAccion,
                        ClaseEstetica = a.ClaseEstetica,
                        IdPasoDestino = a.IdPasoDestino,
                        Activo = a.Activo
                    }).ToList()
                };

                EnrichWideEvent("UpdatePaso", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("UpdatePaso", entityId: idWorkflow, exception: ex, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso });
                return CommonErrors.DatabaseError("actualizar paso");
            }
        }

        public async Task<ErrorOr<WorkflowPasoResponse>> CreatePasoAsync(int idWorkflow, CreatePasoRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos).ThenInclude(p => p.AccionesOrigen).ThenInclude(a => a.AccionHandlers)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                {
                    EnrichWideEvent("CreatePaso", entityId: idWorkflow, notFound: true);
                    return CommonErrors.NotFound($"Workflow con ID {idWorkflow}");
                }

                if (!string.IsNullOrWhiteSpace(request.CodigoEstado)
                    && workflow.Pasos.Any(p => p.CodigoEstado == request.CodigoEstado))
                {
                    return CommonErrors.AlreadyExists("paso", "codigo_estado", request.CodigoEstado);
                }

                var paso = new WorkflowPaso
                {
                    IdWorkflow = idWorkflow,
                    Orden = request.Orden,
                    NombrePaso = request.NombrePaso,
                    CodigoEstado = request.CodigoEstado,
                    DescripcionAyuda = request.DescripcionAyuda,
                    EsInicio = request.EsInicio,
                    EsFinal = request.EsFinal,
                    Activo = request.Activo,
                    RequiereFirma = request.RequiereFirma,
                    RequiereComentario = request.RequiereComentario,
                    RequiereAdjunto = request.RequiereAdjunto,
                    PermiteAdjunto = request.PermiteAdjunto
                };

                workflow.Pasos.Add(paso);
                await _repo.UpdateAsync(workflow);

                EnrichWideEvent("CreatePaso", entityId: idWorkflow, additionalContext: new Dictionary<string, object>
                {
                    ["pasoId"] = paso.IdPaso,
                    ["orden"] = paso.Orden
                });

                return new WorkflowPasoResponse
                {
                    IdPaso = paso.IdPaso,
                    Orden = paso.Orden,
                    NombrePaso = paso.NombrePaso,
                    CodigoEstado = paso.CodigoEstado,
                    DescripcionAyuda = paso.DescripcionAyuda,
                    EsInicio = paso.EsInicio,
                    EsFinal = paso.EsFinal,
                    Activo = paso.Activo,
                    RequiereFirma = paso.RequiereFirma,
                    RequiereComentario = paso.RequiereComentario,
                    RequiereAdjunto = paso.RequiereAdjunto,
                    PermiteAdjunto = paso.PermiteAdjunto,
                    Acciones = new List<WorkflowAccionResponse>()
                };
            }
            catch (Exception ex)
            {
                EnrichWideEvent("CreatePaso", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("crear paso");
            }
        }

        public async Task<ErrorOr<bool>> DeletePasoAsync(int idWorkflow, int idPaso)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos).ThenInclude(p => p.AccionesOrigen).ThenInclude(a => a.Notificaciones)
                    .Include(w => w.Pasos).ThenInclude(p => p.Condiciones)
                    .Include(w => w.Pasos).ThenInclude(p => p.Participantes)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow is null)
                    return CommonErrors.NotFound("workflow", idWorkflow.ToString());

                var paso = workflow.Pasos.FirstOrDefault(p => p.IdPaso == idPaso);
                if (paso is null)
                    return CommonErrors.NotFound("Paso", idPaso.ToString());

                var updateRequest = new UpdatePasoRequest
                {
                    NombrePaso = paso.NombrePaso,
                    Orden = paso.Orden,
                    CodigoEstado = paso.CodigoEstado,
                    DescripcionAyuda = paso.DescripcionAyuda,
                    EsInicio = paso.EsInicio,
                    EsFinal = paso.EsFinal,
                    Activo = false,
                    RequiereFirma = paso.RequiereFirma,
                    RequiereComentario = paso.RequiereComentario,
                    RequiereAdjunto = paso.RequiereAdjunto,
                    PermiteAdjunto = paso.PermiteAdjunto
                };

                var inactivarResult = await UpdatePasoAsync(idWorkflow, idPaso, updateRequest);
                if (inactivarResult.IsError)
                    return inactivarResult.FirstError;

                return true;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("DeletePaso", entityId: idWorkflow, exception: ex, additionalContext: new Dictionary<string, object>
                {
                    ["pasoId"] = idPaso
                });
                return CommonErrors.DatabaseError("inactivar paso");
            }
        }

        // ============================================================================
        // ACCIONES
        // ============================================================================
        public async Task<ErrorOr<WorkflowAccionResponse>> CreateAccionAsync(int idWorkflow, int idPaso, CreateAccionRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos).ThenInclude(p => p.AccionesOrigen).ThenInclude(a => a.AccionHandlers)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                {
                    EnrichWideEvent("CreateAccion", entityId: idWorkflow, notFound: true);
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());
                }

                var paso = workflow.Pasos.FirstOrDefault(p => p.IdPaso == idPaso);
                if (paso == null)
                {
                    EnrichWideEvent("CreateAccion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["notFound"] = true });
                    return CommonErrors.NotFound("Paso", idPaso.ToString());
                }
                if (!paso.Activo)
                    return CommonErrors.Conflict("paso", "No se pueden crear participantes en un paso inactivo.");
                if (!paso.Activo)
                    return CommonErrors.Conflict("paso", "No se pueden crear acciones en un paso inactivo.");

                var accion = new WorkflowAccion
                {
                    IdPasoOrigen = idPaso,
                    NombreAccion = request.NombreAccion,
                    TipoAccion = request.TipoAccion,
                    ClaseEstetica = request.ClaseEstetica,
                    IdPasoDestino = request.IdPasoDestino,
                    Activo = request.Activo
                };

                paso.AccionesOrigen.Add(accion);
                await _repo.UpdateAsync(workflow);

                var response = new WorkflowAccionResponse
                {
                    IdAccion = accion.IdAccion,
                    NombreAccion = accion.NombreAccion,
                    TipoAccion = accion.TipoAccion,
                    ClaseEstetica = accion.ClaseEstetica,
                    IdPasoDestino = accion.IdPasoDestino,
                    Activo = accion.Activo,
                    Handlers = new List<WorkflowAccionHandlerResponse>()
                };

                EnrichWideEvent("CreateAccion", entityId: accion.IdAccion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["pasoId"] = idPaso });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("CreateAccion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("crear acci�n");
            }
        }

        public async Task<ErrorOr<WorkflowAccionResponse>> UpdateAccionAsync(int idWorkflow, int idPaso, int idAccion, UpdateAccionRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos).ThenInclude(p => p.AccionesOrigen)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                {
                    EnrichWideEvent("UpdateAccion", entityId: idWorkflow, notFound: true);
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());
                }

                var paso = workflow.Pasos.FirstOrDefault(p => p.IdPaso == idPaso);
                if (paso == null)
                {
                    EnrichWideEvent("UpdateAccion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["notFound"] = true });
                    return CommonErrors.NotFound("Paso", idPaso.ToString());
                }

                var accion = paso.AccionesOrigen.FirstOrDefault(a => a.IdAccion == idAccion);
                if (accion == null)
                {
                    EnrichWideEvent("UpdateAccion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["accionId"] = idAccion, ["notFound"] = true });
                    return CommonErrors.NotFound("Acci�n", idAccion.ToString());
                }
                if (!request.Activo && accion.Bitacora.Any())
                    return CommonErrors.Conflict("accion", "No se puede inactivar una acci�n con eventos en bit�cora.");

                accion.NombreAccion = request.NombreAccion;
                accion.TipoAccion = request.TipoAccion;
                accion.ClaseEstetica = request.ClaseEstetica;
                accion.IdPasoDestino = request.IdPasoDestino;
                accion.Activo = request.Activo;

                await _repo.UpdateAsync(workflow);

                var response = new WorkflowAccionResponse
                {
                    IdAccion = accion.IdAccion,
                    NombreAccion = accion.NombreAccion,
                    TipoAccion = accion.TipoAccion,
                    ClaseEstetica = accion.ClaseEstetica,
                    IdPasoDestino = accion.IdPasoDestino,
                    Activo = accion.Activo,
                    Handlers = accion.AccionHandlers
                        .Where(h => h.Activo)
                        .OrderBy(h => h.OrdenEjecucion)
                        .Select(h => new WorkflowAccionHandlerResponse
                        {
                            IdHandler = h.IdHandler,
                            HandlerKey = h.HandlerKey,
                            ConfiguracionJson = h.ConfiguracionJson,
                            OrdenEjecucion = h.OrdenEjecucion,
                            Activo = h.Activo,
                            IdWorkflowCampo = h.IdWorkflowCampo,
                            Campo = h.Campo != null ? new WorkflowCampoResponse
                            {
                                IdWorkflowCampo = h.Campo.IdWorkflowCampo,
                                IdWorkflow = h.Campo.IdWorkflow,
                                NombreTecnico = h.Campo.NombreTecnico,
                                EtiquetaUsuario = h.Campo.EtiquetaUsuario,
                                TipoControl = h.Campo.TipoControl,
                                SourceCatalog = h.Campo.SourceCatalog,
                                Activo = h.Campo.Activo
                            } : null
                        })
                        .ToList()
                };

                EnrichWideEvent("UpdateAccion", entityId: idAccion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["pasoId"] = idPaso });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("UpdateAccion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("actualizar acci�n");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAccionAsync(int idWorkflow, int idPaso, int idAccion)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos).ThenInclude(p => p.AccionesOrigen)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                {
                    EnrichWideEvent("DeleteAccion", entityId: idWorkflow, notFound: true);
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());
                }

                var paso = workflow.Pasos.FirstOrDefault(p => p.IdPaso == idPaso);
                if (paso == null)
                {
                    EnrichWideEvent("DeleteAccion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["notFound"] = true });
                    return CommonErrors.NotFound("Paso", idPaso.ToString());
                }
                if (!paso.Activo)
                    return CommonErrors.Conflict("paso", "No se pueden cambiar acciones de un paso inactivo.");

                var accion = paso.AccionesOrigen.FirstOrDefault(a => a.IdAccion == idAccion);
                if (accion == null)
                {
                    EnrichWideEvent("DeleteAccion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["accionId"] = idAccion, ["notFound"] = true });
                    return CommonErrors.NotFound("Acci�n", idAccion.ToString());
                }
                if (accion.Bitacora.Any())
                    return CommonErrors.Conflict("accion", "No se puede inactivar una acci�n con eventos en bit�cora.");
                accion.Activo = false;
                await _repo.UpdateAsync(workflow);

                EnrichWideEvent("DeleteAccion", entityId: idAccion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["pasoId"] = idPaso });
                return true;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("DeleteAccion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("eliminar acci�n");
            }
        }

        public async Task<ErrorOr<WorkflowAccionHandlerResponse>> CreateAccionHandlerAsync(int idWorkflow, int idAccion, CreateAccionHandlerRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                    .ThenInclude(a => a.AccionHandlers)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());

                var accion = workflow.Pasos.SelectMany(p => p.AccionesOrigen).FirstOrDefault(a => a.IdAccion == idAccion);
                if (accion == null)
                    return CommonErrors.NotFound("Acción", idAccion.ToString());
                if (!accion.Activo)
                    return CommonErrors.Conflict("accion", "No se pueden configurar handlers en una acción inactiva.");

                var handler = new WorkflowAccionHandler
                {
                    IdAccion = idAccion,
                    HandlerKey = request.HandlerKey.Trim(),
                    ConfiguracionJson = request.ConfiguracionJson,
                    OrdenEjecucion = request.OrdenEjecucion,
                    IdWorkflowCampo = request.IdWorkflowCampo,
                    Activo = request.Activo
                };

                accion.AccionHandlers.Add(handler);
                await _repo.UpdateAsync(workflow);

                EnrichWideEvent("CreateAccionHandler", entityId: handler.IdHandler, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["accionId"] = idAccion });
                return new WorkflowAccionHandlerResponse
                {
                    IdHandler = handler.IdHandler,
                    HandlerKey = handler.HandlerKey,
                    ConfiguracionJson = handler.ConfiguracionJson,
                    OrdenEjecucion = handler.OrdenEjecucion,
                    IdWorkflowCampo = handler.IdWorkflowCampo,
                    Activo = handler.Activo
                };
            }
            catch (Exception ex)
            {
                EnrichWideEvent("CreateAccionHandler", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("crear handler de acción");
            }
        }

        public async Task<ErrorOr<WorkflowAccionHandlerResponse>> UpdateAccionHandlerAsync(int idWorkflow, int idAccion, int idHandler, UpdateAccionHandlerRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                    .ThenInclude(a => a.AccionHandlers)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());

                var accion = workflow.Pasos.SelectMany(p => p.AccionesOrigen).FirstOrDefault(a => a.IdAccion == idAccion);
                if (accion == null)
                    return CommonErrors.NotFound("Acción", idAccion.ToString());

                var handler = accion.AccionHandlers.FirstOrDefault(h => h.IdHandler == idHandler);
                if (handler == null)
                    return CommonErrors.NotFound("Handler", idHandler.ToString());

                handler.HandlerKey = request.HandlerKey.Trim();
                handler.ConfiguracionJson = request.ConfiguracionJson;
                handler.OrdenEjecucion = request.OrdenEjecucion;
                handler.IdWorkflowCampo = request.IdWorkflowCampo;
                handler.Activo = request.Activo;

                await _repo.UpdateAsync(workflow);

                EnrichWideEvent("UpdateAccionHandler", entityId: idHandler, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["accionId"] = idAccion });
                return new WorkflowAccionHandlerResponse
                {
                    IdHandler = handler.IdHandler,
                    HandlerKey = handler.HandlerKey,
                    ConfiguracionJson = handler.ConfiguracionJson,
                    OrdenEjecucion = handler.OrdenEjecucion,
                    IdWorkflowCampo = handler.IdWorkflowCampo,
                    Activo = handler.Activo
                };
            }
            catch (Exception ex)
            {
                EnrichWideEvent("UpdateAccionHandler", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("actualizar handler de acción");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAccionHandlerAsync(int idWorkflow, int idAccion, int idHandler)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                    .ThenInclude(a => a.AccionHandlers)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());

                var accion = workflow.Pasos.SelectMany(p => p.AccionesOrigen).FirstOrDefault(a => a.IdAccion == idAccion);
                if (accion == null)
                    return CommonErrors.NotFound("Acción", idAccion.ToString());

                var handler = accion.AccionHandlers.FirstOrDefault(h => h.IdHandler == idHandler);
                if (handler == null)
                    return CommonErrors.NotFound("Handler", idHandler.ToString());

                handler.Activo = false;
                await _repo.UpdateAsync(workflow);

                EnrichWideEvent("DeleteAccionHandler", entityId: idHandler, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["accionId"] = idAccion });
                return true;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("DeleteAccionHandler", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("eliminar handler de acción");
            }
        }

        // ============================================================================
        // CONDICIONES
        // ============================================================================
        public async Task<ErrorOr<CondicionResponse>> CreateCondicionAsync(int idWorkflow, int idPaso, CreateCondicionRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos).ThenInclude(p => p.Condiciones)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                {
                    EnrichWideEvent("CreateCondicion", entityId: idWorkflow, notFound: true);
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());
                }

                var paso = workflow.Pasos.FirstOrDefault(p => p.IdPaso == idPaso);
                if (paso == null)
                {
                    EnrichWideEvent("CreateCondicion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["notFound"] = true });
                    return CommonErrors.NotFound("Paso", idPaso.ToString());
                }
                if (!paso.Activo)
                    return CommonErrors.Conflict("paso", "No se pueden actualizar acciones en un paso inactivo.");
                if (!paso.Activo)
                    return CommonErrors.Conflict("paso", "No se pueden crear condiciones en un paso inactivo.");

                var condicion = new WorkflowCondicion
                {
                    IdPaso = idPaso,
                    CampoEvaluacion = request.CampoEvaluacion,
                    Operador = request.Operador,
                    ValorComparacion = request.ValorComparacion,
                    IdPasoSiCumple = request.IdPasoSiCumple,
                    Activo = request.Activo
                };

                paso.Condiciones.Add(condicion);
                await _repo.UpdateAsync(workflow);

                var response = new CondicionResponse
                {
                    IdCondicion = condicion.IdCondicion,
                    IdPaso = condicion.IdPaso,
                    CampoEvaluacion = condicion.CampoEvaluacion,
                    Operador = condicion.Operador,
                    ValorComparacion = condicion.ValorComparacion,
                    IdPasoSiCumple = condicion.IdPasoSiCumple,
                    Activo = condicion.Activo
                };

                EnrichWideEvent("CreateCondicion", entityId: condicion.IdCondicion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["pasoId"] = idPaso });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("CreateCondicion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("crear condici�n");
            }
        }

        public async Task<ErrorOr<CondicionResponse>> UpdateCondicionAsync(int idWorkflow, int idPaso, int idCondicion, UpdateCondicionRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos).ThenInclude(p => p.Condiciones)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                {
                    EnrichWideEvent("UpdateCondicion", entityId: idWorkflow, notFound: true);
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());
                }

                var paso = workflow.Pasos.FirstOrDefault(p => p.IdPaso == idPaso);
                if (paso == null)
                {
                    EnrichWideEvent("UpdateCondicion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["notFound"] = true });
                    return CommonErrors.NotFound("Paso", idPaso.ToString());
                }

                var condicion = paso.Condiciones.FirstOrDefault(c => c.IdCondicion == idCondicion);
                if (condicion == null)
                {
                    EnrichWideEvent("UpdateCondicion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["condicionId"] = idCondicion, ["notFound"] = true });
                    return CommonErrors.NotFound("Condici�n", idCondicion.ToString());
                }
                if (!paso.Activo && request.Activo)
                    return CommonErrors.Conflict("condicion", "No se puede reactivar una condici�n en un paso inactivo.");

                condicion.CampoEvaluacion = request.CampoEvaluacion;
                condicion.Operador = request.Operador;
                condicion.ValorComparacion = request.ValorComparacion;
                condicion.IdPasoSiCumple = request.IdPasoSiCumple;
                condicion.Activo = request.Activo;

                await _repo.UpdateAsync(workflow);

                var response = new CondicionResponse
                {
                    IdCondicion = condicion.IdCondicion,
                    IdPaso = condicion.IdPaso,
                    CampoEvaluacion = condicion.CampoEvaluacion,
                    Operador = condicion.Operador,
                    ValorComparacion = condicion.ValorComparacion,
                    IdPasoSiCumple = condicion.IdPasoSiCumple,
                    Activo = condicion.Activo
                };

                EnrichWideEvent("UpdateCondicion", entityId: idCondicion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["pasoId"] = idPaso });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("UpdateCondicion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("actualizar condici�n");
            }
        }

        public async Task<ErrorOr<bool>> DeleteCondicionAsync(int idWorkflow, int idPaso, int idCondicion)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos).ThenInclude(p => p.Condiciones)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                {
                    EnrichWideEvent("DeleteCondicion", entityId: idWorkflow, notFound: true);
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());
                }

                var paso = workflow.Pasos.FirstOrDefault(p => p.IdPaso == idPaso);
                if (paso == null)
                {
                    EnrichWideEvent("DeleteCondicion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["notFound"] = true });
                    return CommonErrors.NotFound("Paso", idPaso.ToString());
                }

                var condicion = paso.Condiciones.FirstOrDefault(c => c.IdCondicion == idCondicion);
                if (condicion == null)
                {
                    EnrichWideEvent("DeleteCondicion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["condicionId"] = idCondicion, ["notFound"] = true });
                    return CommonErrors.NotFound("Condici�n", idCondicion.ToString());
                }
                condicion.Activo = false;
                await _repo.UpdateAsync(workflow);

                EnrichWideEvent("DeleteCondicion", entityId: idCondicion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["pasoId"] = idPaso });
                return true;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("DeleteCondicion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("eliminar condici�n");
            }
        }

        // ============================================================================
        // PARTICIPANTES
        // ============================================================================
        public async Task<ErrorOr<ParticipanteResponse>> CreateParticipanteAsync(int idWorkflow, int idPaso, CreateParticipanteRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos).ThenInclude(p => p.Participantes)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                {
                    EnrichWideEvent("CreateParticipante", entityId: idWorkflow, notFound: true);
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());
                }

                var paso = workflow.Pasos.FirstOrDefault(p => p.IdPaso == idPaso);
                if (paso == null)
                {
                    EnrichWideEvent("CreateParticipante", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["notFound"] = true });
                    return CommonErrors.NotFound("Paso", idPaso.ToString());
                }
                if (!paso.Activo)
                    return CommonErrors.Conflict("paso", "No se pueden crear participantes en un paso inactivo.");

                var participante = new WorkflowParticipante
                {
                    IdPaso = idPaso,
                    IdRol = request.IdRol,
                    IdUsuario = request.IdUsuario,
                    Activo = request.Activo
                };

                paso.Participantes.Add(participante);
                await _repo.UpdateAsync(workflow);

                var response = new ParticipanteResponse
                {
                    IdParticipante = participante.IdParticipante,
                    IdPaso = participante.IdPaso,
                    IdRol = participante.IdRol,
                    IdUsuario = participante.IdUsuario,
                    Activo = participante.Activo
                };

                EnrichWideEvent("CreateParticipante", entityId: participante.IdParticipante, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["pasoId"] = idPaso });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("CreateParticipante", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("crear participante");
            }
        }

        public async Task<ErrorOr<ParticipanteResponse>> UpdateParticipanteAsync(int idWorkflow, int idPaso, int idParticipante, UpdateParticipanteRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos).ThenInclude(p => p.Participantes)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                {
                    EnrichWideEvent("UpdateParticipante", entityId: idWorkflow, notFound: true);
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());
                }

                var paso = workflow.Pasos.FirstOrDefault(p => p.IdPaso == idPaso);
                if (paso == null)
                {
                    EnrichWideEvent("UpdateParticipante", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["notFound"] = true });
                    return CommonErrors.NotFound("Paso", idPaso.ToString());
                }

                var participante = paso.Participantes.FirstOrDefault(p => p.IdParticipante == idParticipante);
                if (participante == null)
                {
                    EnrichWideEvent("UpdateParticipante", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["participanteId"] = idParticipante, ["notFound"] = true });
                    return CommonErrors.NotFound("Participante", idParticipante.ToString());
                }
                if (!paso.Activo && request.Activo)
                    return CommonErrors.Conflict("participante", "No se puede reactivar un participante en un paso inactivo.");
                var participantesActivos = paso.Participantes.Count(p => p.Activo);
                if (participante.Activo && !request.Activo && participantesActivos <= 1)
                    return CommonErrors.Conflict("participante", "Debe existir al menos un participante activo por paso.");

                participante.IdRol = request.IdRol;
                participante.IdUsuario = request.IdUsuario;
                participante.Activo = request.Activo;

                await _repo.UpdateAsync(workflow);

                var response = new ParticipanteResponse
                {
                    IdParticipante = participante.IdParticipante,
                    IdPaso = participante.IdPaso,
                    IdRol = participante.IdRol,
                    IdUsuario = participante.IdUsuario,
                    Activo = participante.Activo
                };

                EnrichWideEvent("UpdateParticipante", entityId: idParticipante, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["pasoId"] = idPaso });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("UpdateParticipante", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("actualizar participante");
            }
        }

        public async Task<ErrorOr<bool>> DeleteParticipanteAsync(int idWorkflow, int idPaso, int idParticipante)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos).ThenInclude(p => p.Participantes)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                {
                    EnrichWideEvent("DeleteParticipante", entityId: idWorkflow, notFound: true);
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());
                }

                var paso = workflow.Pasos.FirstOrDefault(p => p.IdPaso == idPaso);
                if (paso == null)
                {
                    EnrichWideEvent("DeleteParticipante", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["notFound"] = true });
                    return CommonErrors.NotFound("Paso", idPaso.ToString());
                }

                var participante = paso.Participantes.FirstOrDefault(p => p.IdParticipante == idParticipante);
                if (participante == null)
                {
                    EnrichWideEvent("DeleteParticipante", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["participanteId"] = idParticipante, ["notFound"] = true });
                    return CommonErrors.NotFound("Participante", idParticipante.ToString());
                }
                var participantesActivos = paso.Participantes.Count(p => p.Activo);
                if (participante.Activo && participantesActivos <= 1)
                    return CommonErrors.Conflict("participante", "Debe existir al menos un participante activo por paso.");
                participante.Activo = false;
                await _repo.UpdateAsync(workflow);

                EnrichWideEvent("DeleteParticipante", entityId: idParticipante, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["pasoId"] = idPaso });
                return true;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("DeleteParticipante", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("eliminar participante");
            }
        }

        // ============================================================================
        // NOTIFICACIONES
        // ============================================================================
        public async Task<ErrorOr<NotificacionResponse>> CreateNotificacionAsync(int idWorkflow, int idAccion, CreateNotificacionRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                    .ThenInclude(a => a.Notificaciones)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);
                
                if (workflow == null)
                {
                    EnrichWideEvent("CreateNotificacion", entityId: idWorkflow, notFound: true);
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());
                }

                var accion = workflow.Pasos
                    .SelectMany(p => p.AccionesOrigen)
                    .FirstOrDefault(a => a.IdAccion == idAccion);
                
                if (accion == null)
                {
                    EnrichWideEvent("CreateNotificacion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["accionId"] = idAccion, ["notFound"] = true });
                    return CommonErrors.NotFound("Acci�n", idAccion.ToString());
                }
                if (!accion.Activo)
                    return CommonErrors.Conflict("accion", "No se pueden crear notificaciones en una acci�n inactiva.");
                if (!accion.Activo)
                    return CommonErrors.Conflict("accion", "No se pueden crear notificaciones en una acci�n inactiva.");

                var notificacion = new WorkflowNotificacion
                {
                    IdAccion = idAccion,
                    IdPasoDestino = request.IdPasoDestino,
                    IdTipoNotificacion = request.IdTipoNotificacion,
                    EnviarEmail = request.EnviarEmail,
                    EnviarWhatsapp = request.EnviarWhatsapp,
                    EnviarTelegram = request.EnviarTelegram,
                    AvisarAlCreador = request.AvisarAlCreador,
                    AvisarAlSiguiente = request.AvisarAlSiguiente,
                    AvisarAlAnterior = request.AvisarAlAnterior,
                    AvisarAAutorizadoresPrevios = request.AvisarAAutorizadoresPrevios,
                    IncluirPartidas = request.IncluirPartidas,
                    Activo = request.Activo,
                    Canales = request.Canales.Select(c => new Domain.Entities.Config.WorkflowNotificacionCanal
                    {
                        CodigoCanal = c.CodigoCanal,
                        AsuntoTemplate = c.AsuntoTemplate,
                        CuerpoTemplate = c.CuerpoTemplate,
                        ListadoRowHtml = c.ListadoRowHtml,
                        Activo = c.Activo
                    }).ToList()
                };

                accion.Notificaciones.Add(notificacion);
                await _repo.UpdateAsync(workflow);

                var response = new NotificacionResponse
                {
                    IdNotificacion = notificacion.IdNotificacion,
                    IdAccion = notificacion.IdAccion,
                    IdPasoDestino = notificacion.IdPasoDestino,
                    IdTipoNotificacion = notificacion.IdTipoNotificacion,
                    EnviarEmail = notificacion.EnviarEmail,
                    EnviarWhatsapp = notificacion.EnviarWhatsapp,
                    EnviarTelegram = notificacion.EnviarTelegram,
                    AvisarAlCreador = notificacion.AvisarAlCreador,
                    AvisarAlSiguiente = notificacion.AvisarAlSiguiente,
                    AvisarAlAnterior = notificacion.AvisarAlAnterior,
                    AvisarAAutorizadoresPrevios = notificacion.AvisarAAutorizadoresPrevios,
                    IncluirPartidas = notificacion.IncluirPartidas,
                    Activo = notificacion.Activo,
                    Canales = notificacion.Canales.Select(c => new WorkflowNotificacionCanalDto
                    {
                        IdNotificacionCanal = c.IdNotificacionCanal,
                        CodigoCanal = c.CodigoCanal,
                        AsuntoTemplate = c.AsuntoTemplate,
                        CuerpoTemplate = c.CuerpoTemplate,
                        ListadoRowHtml = c.ListadoRowHtml,
                        Activo = c.Activo
                    }).ToList()
                };

                EnrichWideEvent("CreateNotificacion",entityId: notificacion.IdNotificacion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["accionId"] = idAccion });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("CreateNotificacion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("crear notificaci�n");
            }
        }

        public async Task<ErrorOr<NotificacionResponse>> UpdateNotificacionAsync(int idWorkflow, int idAccion, int idNotificacion, UpdateNotificacionRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                    .ThenInclude(a => a.Notificaciones)
                    .ThenInclude(n => n.Canales)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);
                
                if (workflow == null)
                {
                    EnrichWideEvent("UpdateNotificacion", entityId: idWorkflow, notFound: true);
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());
                }

                var accion = workflow.Pasos
                    .SelectMany(p => p.AccionesOrigen)
                    .FirstOrDefault(a => a.IdAccion == idAccion);
                
                if (accion == null)
                {
                    EnrichWideEvent("UpdateNotificacion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["accionId"] = idAccion, ["notFound"] = true });
                    return CommonErrors.NotFound("Acci�n", idAccion.ToString());
                }

                var notificacion = accion.Notificaciones.FirstOrDefault(n => n.IdNotificacion == idNotificacion);
                if (notificacion == null)
                {
                    EnrichWideEvent("UpdateNotificacion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["accionId"] = idAccion, ["notificacionId"] = idNotificacion, ["notFound"] = true });
                    return CommonErrors.NotFound("Notificaci�n", idNotificacion.ToString());
                }
                if (!accion.Activo && request.Activo)
                    return CommonErrors.Conflict("notificacion", "No se puede reactivar una notificaci�n en una acci�n inactiva.");

                notificacion.EnviarEmail = request.EnviarEmail;
                notificacion.EnviarWhatsapp = request.EnviarWhatsapp;
                notificacion.EnviarTelegram = request.EnviarTelegram;
                notificacion.IdPasoDestino = request.IdPasoDestino;
                notificacion.IdTipoNotificacion = request.IdTipoNotificacion;
                notificacion.AvisarAlCreador = request.AvisarAlCreador;
                notificacion.AvisarAlSiguiente = request.AvisarAlSiguiente;
                notificacion.AvisarAlAnterior = request.AvisarAlAnterior;
                notificacion.AvisarAAutorizadoresPrevios = request.AvisarAAutorizadoresPrevios;
                notificacion.IncluirPartidas = request.IncluirPartidas;
                notificacion.Activo = request.Activo;

                // Upsert canales
                var codigosEnRequest = request.Canales.Select(c => c.CodigoCanal).ToHashSet();
                var canalesAEliminar = notificacion.Canales
                    .Where(c => !codigosEnRequest.Contains(c.CodigoCanal))
                    .ToList();
                _context.WorkflowNotificacionCanales.RemoveRange(canalesAEliminar);

                foreach (var canalDto in request.Canales)
                {
                    var existing = notificacion.Canales.FirstOrDefault(c => c.CodigoCanal == canalDto.CodigoCanal);
                    if (existing != null)
                    {
                        existing.AsuntoTemplate = canalDto.AsuntoTemplate;
                        existing.CuerpoTemplate = canalDto.CuerpoTemplate;
                        existing.ListadoRowHtml = canalDto.ListadoRowHtml;
                        existing.Activo = canalDto.Activo;
                    }
                    else
                    {
                        notificacion.Canales.Add(new Domain.Entities.Config.WorkflowNotificacionCanal
                        {
                            CodigoCanal = canalDto.CodigoCanal,
                            AsuntoTemplate = canalDto.AsuntoTemplate,
                            CuerpoTemplate = canalDto.CuerpoTemplate,
                            ListadoRowHtml = canalDto.ListadoRowHtml,
                            Activo = canalDto.Activo
                        });
                    }
                }

                await _repo.UpdateAsync(workflow);

                var response = new NotificacionResponse
                {
                    IdNotificacion = notificacion.IdNotificacion,
                    IdAccion = notificacion.IdAccion,
                    IdPasoDestino = notificacion.IdPasoDestino,
                    IdTipoNotificacion = notificacion.IdTipoNotificacion,
                    EnviarEmail = notificacion.EnviarEmail,
                    EnviarWhatsapp = notificacion.EnviarWhatsapp,
                    EnviarTelegram = notificacion.EnviarTelegram,
                    AvisarAlCreador = notificacion.AvisarAlCreador,
                    AvisarAlSiguiente = notificacion.AvisarAlSiguiente,
                    AvisarAlAnterior = notificacion.AvisarAlAnterior,
                    AvisarAAutorizadoresPrevios = notificacion.AvisarAAutorizadoresPrevios,
                    IncluirPartidas = notificacion.IncluirPartidas,
                    Activo = notificacion.Activo,
                    Canales = notificacion.Canales.Select(c => new WorkflowNotificacionCanalDto
                    {
                        IdNotificacionCanal = c.IdNotificacionCanal,
                        CodigoCanal = c.CodigoCanal,
                        AsuntoTemplate = c.AsuntoTemplate,
                        CuerpoTemplate = c.CuerpoTemplate,
                        ListadoRowHtml = c.ListadoRowHtml,
                        Activo = c.Activo
                    }).ToList()
                };

                EnrichWideEvent("UpdateNotificacion",entityId: idNotificacion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["accionId"] = idAccion });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("UpdateNotificacion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("actualizar notificaci�n");
            }
        }

        public async Task<ErrorOr<bool>> DeleteNotificacionAsync(int idWorkflow, int idAccion, int idNotificacion)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                    .ThenInclude(a => a.Notificaciones)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);
                
                if (workflow == null)
                {
                    EnrichWideEvent("DeleteNotificacion", entityId: idWorkflow, notFound: true);
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());
                }

                var accion = workflow.Pasos
                    .SelectMany(p => p.AccionesOrigen)
                    .FirstOrDefault(a => a.IdAccion == idAccion);
                
                if (accion == null)
                {
                    EnrichWideEvent("DeleteNotificacion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["accionId"] = idAccion, ["notFound"] = true });
                    return CommonErrors.NotFound("Acci�n", idAccion.ToString());
                }

                var notificacion = accion.Notificaciones.FirstOrDefault(n => n.IdNotificacion == idNotificacion);
                if (notificacion == null)
                {
                    EnrichWideEvent("DeleteNotificacion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["accionId"] = idAccion, ["notificacionId"] = idNotificacion, ["notFound"] = true });
                    return CommonErrors.NotFound("Notificaci�n", idNotificacion.ToString());
                }
                notificacion.Activo = false;
                await _repo.UpdateAsync(workflow);

                EnrichWideEvent("DeleteNotificacion", entityId: idNotificacion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["accionId"] = idAccion });
                return true;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("DeleteNotificacion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("eliminar notificaci�n");
            }
        }

        public async Task<ErrorOr<WorkflowCampoResponse>> CreateCampoAsync(int idWorkflow, CreateWorkflowCampoRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Campos)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());

                if (workflow.Campos.Any(c => c.NombreTecnico == request.NombreTecnico))
                    return CommonErrors.AlreadyExists("campo", "nombre_tecnico", request.NombreTecnico);

                var campo = new WorkflowCampo
                {
                    IdWorkflow = idWorkflow,
                    NombreTecnico = request.NombreTecnico.Trim(),
                    EtiquetaUsuario = request.EtiquetaUsuario.Trim(),
                    TipoControl = request.TipoControl.Trim(),
                    SourceCatalog = request.SourceCatalog,
                    PropiedadEntidad = request.PropiedadEntidad?.Trim(),
                    ValidarFiscal = request.ValidarFiscal,
                    Activo = request.Activo
                };

                workflow.Campos.Add(campo);
                await _repo.UpdateAsync(workflow);

                EnrichWideEvent("CreateCampo", entityId: campo.IdWorkflowCampo, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow });
                return new WorkflowCampoResponse
                {
                    IdWorkflowCampo = campo.IdWorkflowCampo,
                    IdWorkflow = campo.IdWorkflow,
                    NombreTecnico = campo.NombreTecnico,
                    EtiquetaUsuario = campo.EtiquetaUsuario,
                    TipoControl = campo.TipoControl,
                    SourceCatalog = campo.SourceCatalog,
                    PropiedadEntidad = campo.PropiedadEntidad,
                    ValidarFiscal = campo.ValidarFiscal,
                    Activo = campo.Activo
                };
            }
            catch (Exception ex)
            {
                EnrichWideEvent("CreateCampo", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("crear campo de workflow");
            }
        }

        public async Task<ErrorOr<WorkflowCampoResponse>> UpdateCampoAsync(int idWorkflow, int idWorkflowCampo, UpdateWorkflowCampoRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Campos)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());

                var campo = workflow.Campos.FirstOrDefault(c => c.IdWorkflowCampo == idWorkflowCampo);
                if (campo == null)
                    return CommonErrors.NotFound("campo", idWorkflowCampo.ToString());

                campo.NombreTecnico = request.NombreTecnico.Trim();
                campo.EtiquetaUsuario = request.EtiquetaUsuario.Trim();
                campo.TipoControl = request.TipoControl.Trim();
                campo.SourceCatalog = request.SourceCatalog;
                campo.PropiedadEntidad = request.PropiedadEntidad?.Trim();
                campo.ValidarFiscal = request.ValidarFiscal;
                campo.Activo = request.Activo;
                await _repo.UpdateAsync(workflow);

                EnrichWideEvent("UpdateCampo", entityId: idWorkflowCampo, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow });
                return new WorkflowCampoResponse
                {
                    IdWorkflowCampo = campo.IdWorkflowCampo,
                    IdWorkflow = campo.IdWorkflow,
                    NombreTecnico = campo.NombreTecnico,
                    EtiquetaUsuario = campo.EtiquetaUsuario,
                    TipoControl = campo.TipoControl,
                    SourceCatalog = campo.SourceCatalog,
                    PropiedadEntidad = campo.PropiedadEntidad,
                    ValidarFiscal = campo.ValidarFiscal,
                    Activo = campo.Activo
                };
            }
            catch (Exception ex)
            {
                EnrichWideEvent("UpdateCampo", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("actualizar campo de workflow");
            }
        }

        public async Task<ErrorOr<bool>> DeleteCampoAsync(int idWorkflow, int idWorkflowCampo)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Campos)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);

                if (workflow == null)
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());

                var campo = workflow.Campos.FirstOrDefault(c => c.IdWorkflowCampo == idWorkflowCampo);
                if (campo == null)
                    return CommonErrors.NotFound("campo", idWorkflowCampo.ToString());

                campo.Activo = false;
                await _repo.UpdateAsync(workflow);

                EnrichWideEvent("DeleteCampo", entityId: idWorkflowCampo, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow });
                return true;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("DeleteCampo", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("eliminar campo de workflow");
            }
        }

        private static WorkflowResponse ToResponse(Workflow w) => new()
        {
            IdWorkflow = w.IdWorkflow,
            Nombre = w.Nombre,
            Descripcion = w.Descripcion,
            CodigoProceso = w.CodigoProceso,
            Version = w.Version,
            Activo = w.Activo,
            FechaCreacion = w.FechaCreacion,
            Campos = w.Campos
                .Where(c => c.Activo)
                .OrderBy(c => c.EtiquetaUsuario)
                .Select(c => new WorkflowCampoResponse
                {
                    IdWorkflowCampo = c.IdWorkflowCampo,
                    IdWorkflow = c.IdWorkflow,
                    NombreTecnico = c.NombreTecnico,
                    EtiquetaUsuario = c.EtiquetaUsuario,
                    TipoControl = c.TipoControl,
                    SourceCatalog = c.SourceCatalog,
                    PropiedadEntidad = c.PropiedadEntidad,
                    ValidarFiscal = c.ValidarFiscal,
                    Activo = c.Activo
                }).ToList(),
                Pasos = w.Pasos.Where(p => p.Activo).OrderBy(p => p.Orden).Select(p => new WorkflowPasoResponse
                {
                IdPaso = p.IdPaso,
                Orden = p.Orden,
                NombrePaso = p.NombrePaso,
                CodigoEstado = p.CodigoEstado,
                DescripcionAyuda = p.DescripcionAyuda,
                EsInicio = p.EsInicio,
                EsFinal = p.EsFinal,
                Activo = p.Activo,
                RequiereFirma = p.RequiereFirma,
                RequiereComentario = p.RequiereComentario,
                RequiereAdjunto = p.RequiereAdjunto,
                PermiteAdjunto = p.PermiteAdjunto,
                Acciones = p.AccionesOrigen.Where(a => a.Activo).Select(a => new WorkflowAccionResponse
                {
                    IdAccion = a.IdAccion,
                    NombreAccion = a.NombreAccion,
                    TipoAccion = a.TipoAccion,
                    ClaseEstetica = a.ClaseEstetica,
                    IdPasoDestino = a.IdPasoDestino,
                    Activo = a.Activo,
                    Handlers = a.AccionHandlers.Where(h => h.Activo).OrderBy(h => h.OrdenEjecucion).Select(h => new WorkflowAccionHandlerResponse
                    {
                        IdHandler = h.IdHandler,
                        HandlerKey = h.HandlerKey,
                        ConfiguracionJson = h.ConfiguracionJson,
                        OrdenEjecucion = h.OrdenEjecucion,
                        Activo = h.Activo,
                        IdWorkflowCampo = h.IdWorkflowCampo,
                        Campo = h.Campo != null ? new WorkflowCampoResponse
                        {
                            IdWorkflowCampo = h.Campo.IdWorkflowCampo,
                            IdWorkflow = h.Campo.IdWorkflow,
                            NombreTecnico = h.Campo.NombreTecnico,
                            EtiquetaUsuario = h.Campo.EtiquetaUsuario,
                            TipoControl = h.Campo.TipoControl,
                            SourceCatalog = h.Campo.SourceCatalog,
                            PropiedadEntidad = h.Campo.PropiedadEntidad,
                            ValidarFiscal = h.Campo.ValidarFiscal,
                            Activo = h.Campo.Activo
                        } : null
                    }).ToList(),
                    Notificaciones = a.Notificaciones.Where(n => n.Activo).Select(n => new NotificacionResponse
                    {
                        IdNotificacion = n.IdNotificacion,
                        IdAccion = n.IdAccion,
                        IdPasoDestino = n.IdPasoDestino,
                        IdTipoNotificacion = n.IdTipoNotificacion,
                        EnviarEmail = n.EnviarEmail,
                        EnviarWhatsapp = n.EnviarWhatsapp,
                        EnviarTelegram = n.EnviarTelegram,
                        AvisarAlCreador = n.AvisarAlCreador,
                        AvisarAlSiguiente = n.AvisarAlSiguiente,
                        AvisarAlAnterior = n.AvisarAlAnterior,
                        AvisarAAutorizadoresPrevios = n.AvisarAAutorizadoresPrevios,
                        IncluirPartidas = n.IncluirPartidas,
                        Activo = n.Activo,
                        Canales = n.Canales.Select(c => new WorkflowNotificacionCanalDto
                        {
                            IdNotificacionCanal = c.IdNotificacionCanal,
                            CodigoCanal = c.CodigoCanal,
                            AsuntoTemplate = c.AsuntoTemplate,
                            CuerpoTemplate = c.CuerpoTemplate,
                            ListadoRowHtml = c.ListadoRowHtml,
                            Activo = c.Activo
                        }).ToList()
                    }).ToList()
                }).ToList(),
                Condiciones = p.Condiciones.Where(c => c.Activo).Select(c => new CondicionResponse
                {
                    IdCondicion = c.IdCondicion,
                    IdPaso = c.IdPaso,
                    CampoEvaluacion = c.CampoEvaluacion,
                    Operador = c.Operador,
                    ValorComparacion = c.ValorComparacion,
                    IdPasoSiCumple = c.IdPasoSiCumple,
                    Activo = c.Activo
                }).ToList(),
                Participantes = p.Participantes.Where(pt => pt.Activo).Select(pt => new ParticipanteResponse
                {
                    IdParticipante = pt.IdParticipante,
                    IdPaso = pt.IdPaso,
                    IdRol = pt.IdRol,
                    IdUsuario = pt.IdUsuario,
                    Activo = pt.Activo
                }).ToList()
            }).ToList(),
            Stats = new WorkflowStatsResponse
            {
                TotalPasos = w.Pasos.Count(p => p.Activo),
                TotalAcciones = w.Pasos.Where(p => p.Activo).SelectMany(p => p.AccionesOrigen).Count(a => a.Activo),
                TotalCondiciones = w.Pasos.Where(p => p.Activo).SelectMany(p => p.Condiciones).Count(c => c.Activo),
                TotalNotificaciones = w.Pasos.Where(p => p.Activo).SelectMany(p => p.AccionesOrigen.Where(a => a.Activo))
                    .SelectMany(a => a.Notificaciones).Count(n => n.Activo)
            }
        };

        public async Task<ErrorOr<IEnumerable<WorkflowCanalTemplateResponse>>> GetCanalTemplatesAsync(int idWorkflow)
        {
            try
            {
                var templates = await _repo.GetCanalTemplatesAsync(idWorkflow);
                return templates.Select(t => new WorkflowCanalTemplateResponse
                {
                    IdTemplate = t.IdTemplate,
                    IdWorkflow = t.IdWorkflow,
                    CodigoCanal = t.CodigoCanal,
                    Nombre = t.Nombre,
                    LayoutHtml = t.LayoutHtml,
                    Activo = t.Activo,
                    FechaModificacion = t.FechaModificacion
                }).ToList();
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetCanalTemplates", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("obtener las plantillas de canal");
            }
        }

        public async Task<ErrorOr<WorkflowCanalTemplateResponse>> CreateCanalTemplateAsync(int idWorkflow, CreateCanalTemplateRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable().FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);
                if (workflow == null)
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());

                var codigoCanal = request.CodigoCanal.ToLowerInvariant();
                var existing = await _repo.GetCanalTemplateAsync(idWorkflow, codigoCanal);
                if (existing != null)
                    return Error.Conflict("CanalTemplate.AlreadyExists", $"Ya existe una plantilla para el canal '{codigoCanal}' en este workflow.");

                var template = new WorkflowCanalTemplate
                {
                    IdWorkflow = idWorkflow,
                    CodigoCanal = codigoCanal,
                    Nombre = request.Nombre,
                    LayoutHtml = request.LayoutHtml,
                    Activo = request.Activo,
                    FechaModificacion = DateTime.UtcNow
                };
                _context.WorkflowCanalTemplates.Add(template);
                await _context.SaveChangesAsync();
                return new WorkflowCanalTemplateResponse
                {
                    IdTemplate = template.IdTemplate,
                    IdWorkflow = template.IdWorkflow,
                    CodigoCanal = template.CodigoCanal,
                    Nombre = template.Nombre,
                    LayoutHtml = template.LayoutHtml,
                    Activo = template.Activo,
                    FechaModificacion = template.FechaModificacion
                };
            }
            catch (Exception ex)
            {
                EnrichWideEvent("CreateCanalTemplate", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("crear la plantilla de canal");
            }
        }

        public async Task<ErrorOr<WorkflowCanalTemplateResponse>> UpsertCanalTemplateAsync(int idWorkflow, string codigoCanal, UpsertCanalTemplateRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable().FirstOrDefaultAsync(w => w.IdWorkflow == idWorkflow);
                if (workflow == null)
                    return CommonErrors.NotFound(EntityName, idWorkflow.ToString());

                var existing = await _repo.GetCanalTemplateAsync(idWorkflow, codigoCanal);
                if (existing != null)
                {
                    existing.Nombre = request.Nombre;
                    existing.LayoutHtml = request.LayoutHtml;
                    existing.Activo = request.Activo;
                    existing.FechaModificacion = DateTime.UtcNow;
                    _context.WorkflowCanalTemplates.Update(existing);
                    await _context.SaveChangesAsync();
                    return new WorkflowCanalTemplateResponse
                    {
                        IdTemplate = existing.IdTemplate,
                        IdWorkflow = existing.IdWorkflow,
                        CodigoCanal = existing.CodigoCanal,
                        Nombre = existing.Nombre,
                        LayoutHtml = existing.LayoutHtml,
                        Activo = existing.Activo,
                        FechaModificacion = existing.FechaModificacion
                    };
                }

                var template = new WorkflowCanalTemplate
                {
                    IdWorkflow = idWorkflow,
                    CodigoCanal = codigoCanal.ToLowerInvariant(),
                    Nombre = request.Nombre,
                    LayoutHtml = request.LayoutHtml,
                    Activo = request.Activo,
                    FechaModificacion = DateTime.UtcNow
                };
                _context.WorkflowCanalTemplates.Add(template);
                await _context.SaveChangesAsync();
                return new WorkflowCanalTemplateResponse
                {
                    IdTemplate = template.IdTemplate,
                    IdWorkflow = template.IdWorkflow,
                    CodigoCanal = template.CodigoCanal,
                    Nombre = template.Nombre,
                    LayoutHtml = template.LayoutHtml,
                    Activo = template.Activo,
                    FechaModificacion = template.FechaModificacion
                };
            }
            catch (Exception ex)
            {
                EnrichWideEvent("UpsertCanalTemplate", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("guardar la plantilla de canal");
            }
        }
        public async Task<ErrorOr<IEnumerable<WorkflowTipoNotificacionResponse>>> GetTiposNotificacionAsync()
        {
            try
            {
                var tipos = await _context.WorkflowTiposNotificacion
                    .Where(t => t.Activo)
                    .OrderBy(t => t.IdTipo)
                    .Select(t => new WorkflowTipoNotificacionResponse
                    {
                        IdTipo = t.IdTipo,
                        Codigo = t.Codigo,
                        Nombre = t.Nombre,
                        ColorTema = t.ColorTema,
                        ColorClaro = t.ColorClaro,
                        Icono = t.Icono,
                        Activo = t.Activo
                    })
                    .ToListAsync();
                return tipos;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetTiposNotificacion", exception: ex);
                return CommonErrors.DatabaseError("obtener tipos de notificacion");
            }
        }

        public async Task<ErrorOr<IEnumerable<WorkflowNotificacionesPlantillaResponse>>> GetPlantillasBaseAsync(string? tipoNotificacion, string? canal)
        {
            try
            {
                var query = _context.WorkflowNotificacionesPlantillas
                    .Where(p => p.Activo);

                if (!string.IsNullOrEmpty(tipoNotificacion))
                    query = query.Where(p => p.CodigoTipoNotificacion == null || p.CodigoTipoNotificacion == tipoNotificacion);

                if (!string.IsNullOrEmpty(canal))
                    query = query.Where(p => p.CodigoCanal == canal);

                var result = await query
                    .OrderBy(p => p.CodigoTipoNotificacion)
                    .ThenBy(p => p.Nombre)
                    .Select(p => new WorkflowNotificacionesPlantillaResponse
                    {
                        IdPlantilla = p.IdPlantilla,
                        Nombre = p.Nombre,
                        CodigoTipoNotificacion = p.CodigoTipoNotificacion,
                        CodigoCanal = p.CodigoCanal,
                        AsuntoTemplate = p.AsuntoTemplate,
                        CuerpoTemplate = p.CuerpoTemplate,
                        ListadoRowHtml = p.ListadoRowHtml,
                        Activo = p.Activo
                    })
                    .ToListAsync();

                return result;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetPlantillasBase", exception: ex);
                return CommonErrors.DatabaseError("obtener plantillas base");
            }
        }

        // ============================================================================
        // Recordatorios
        // ============================================================================

        private static WorkflowRecordatorioResponse ToRecordatorioResponse(Domain.Entities.Config.WorkflowRecordatorio r) => new()
        {
            IdRecordatorio = r.IdRecordatorio,
            IdWorkflow = r.IdWorkflow,
            IdPaso = r.IdPaso,
            Nombre = r.Nombre,
            Activo = r.Activo,
            TipoTrigger = r.TipoTrigger,
            HoraEnvio = r.HoraEnvio,
            DiasSemana = r.DiasSemana,
            IntervaloHoras = r.IntervaloHoras,
            FechaEspecifica = r.FechaEspecifica,
            MinOrdenesPendientes = r.MinOrdenesPendientes,
            MinDiasEnPaso = r.MinDiasEnPaso,
            MontoMinimo = r.MontoMinimo,
            MontoMaximo = r.MontoMaximo,
            EscalarAJerarquia = r.EscalarAJerarquia,
            DiasParaEscalar = r.DiasParaEscalar,
            EnviarAlResponsable = r.EnviarAlResponsable,
            EnviarEmail = r.EnviarEmail,
            EnviarWhatsapp = r.EnviarWhatsapp,
            EnviarTelegram = r.EnviarTelegram,
            FechaCreacion = r.FechaCreacion,
            Canales = r.Canales.Select(c => new WorkflowRecordatorioCanalDto
            {
                IdRecordatorioCanal = c.IdRecordatorioCanal,
                CodigoCanal = c.CodigoCanal,
                AsuntoTemplate = c.AsuntoTemplate,
                CuerpoTemplate = c.CuerpoTemplate,
                ListadoRowHtml = c.ListadoRowHtml,
                Activo = c.Activo
            }).ToList()
        };

        public async Task<ErrorOr<IEnumerable<WorkflowRecordatorioResponse>>> GetRecordatoriosAsync(int idWorkflow)
        {
            try
            {
                var lista = await _context.WorkflowRecordatorios
                    .Where(r => r.IdWorkflow == idWorkflow)
                    .Include(r => r.Canales)
                    .OrderBy(r => r.IdRecordatorio)
                    .ToListAsync();
                return lista.Select(ToRecordatorioResponse).ToList();
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetRecordatorios", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("obtener recordatorios");
            }
        }

        public async Task<ErrorOr<WorkflowRecordatorioResponse>> CreateRecordatorioAsync(int idWorkflow, CreateRecordatorioRequest request)
        {
            try
            {
                var existe = await _context.Workflows.AnyAsync(w => w.IdWorkflow == idWorkflow);
                if (!existe)
                    return Error.NotFound("Workflow.NotFound", $"No se encontró el workflow {idWorkflow}.");

                var recordatorio = new WorkflowRecordatorio
                {
                    IdWorkflow = idWorkflow,
                    IdPaso = request.IdPaso,
                    Nombre = request.Nombre,
                    Activo = request.Activo,
                    TipoTrigger = request.TipoTrigger,
                    HoraEnvio = request.HoraEnvio,
                    DiasSemana = request.DiasSemana,
                    IntervaloHoras = request.IntervaloHoras,
                    FechaEspecifica = request.FechaEspecifica,
                    MinOrdenesPendientes = request.MinOrdenesPendientes,
                    MinDiasEnPaso = request.MinDiasEnPaso,
                    MontoMinimo = request.MontoMinimo,
                    MontoMaximo = request.MontoMaximo,
                    EscalarAJerarquia = request.EscalarAJerarquia,
                    DiasParaEscalar = request.DiasParaEscalar,
                    EnviarAlResponsable = request.EnviarAlResponsable,
                    EnviarEmail = request.EnviarEmail,
                    EnviarWhatsapp = request.EnviarWhatsapp,
                    EnviarTelegram = request.EnviarTelegram,
                    FechaCreacion = DateTime.UtcNow,
                    Canales = request.Canales.Select(c => new Domain.Entities.Config.WorkflowRecordatorioCanal
                    {
                        CodigoCanal = c.CodigoCanal,
                        AsuntoTemplate = c.AsuntoTemplate,
                        CuerpoTemplate = c.CuerpoTemplate,
                        ListadoRowHtml = c.ListadoRowHtml,
                        Activo = c.Activo
                    }).ToList()
                };

                _context.WorkflowRecordatorios.Add(recordatorio);
                await _context.SaveChangesAsync();
                return ToRecordatorioResponse(recordatorio);
            }
            catch (Exception ex)
            {
                EnrichWideEvent("CreateRecordatorio", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("crear recordatorio");
            }
        }

        public async Task<ErrorOr<WorkflowRecordatorioResponse>> UpdateRecordatorioAsync(int idWorkflow, int idRecordatorio, UpdateRecordatorioRequest request)
        {
            try
            {
                var recordatorio = await _context.WorkflowRecordatorios
                    .Include(r => r.Canales)
                    .FirstOrDefaultAsync(r => r.IdRecordatorio == idRecordatorio && r.IdWorkflow == idWorkflow);

                if (recordatorio is null)
                    return Error.NotFound("Recordatorio.NotFound", $"No se encontró el recordatorio {idRecordatorio}.");

                recordatorio.IdPaso = request.IdPaso;
                recordatorio.Nombre = request.Nombre;
                recordatorio.Activo = request.Activo;
                recordatorio.TipoTrigger = request.TipoTrigger;
                recordatorio.HoraEnvio = request.HoraEnvio;
                recordatorio.DiasSemana = request.DiasSemana;
                recordatorio.IntervaloHoras = request.IntervaloHoras;
                recordatorio.FechaEspecifica = request.FechaEspecifica;
                recordatorio.MinOrdenesPendientes = request.MinOrdenesPendientes;
                recordatorio.MinDiasEnPaso = request.MinDiasEnPaso;
                recordatorio.MontoMinimo = request.MontoMinimo;
                recordatorio.MontoMaximo = request.MontoMaximo;
                recordatorio.EscalarAJerarquia = request.EscalarAJerarquia;
                recordatorio.DiasParaEscalar = request.DiasParaEscalar;
                recordatorio.EnviarAlResponsable = request.EnviarAlResponsable;
                recordatorio.EnviarEmail = request.EnviarEmail;
                recordatorio.EnviarWhatsapp = request.EnviarWhatsapp;
                recordatorio.EnviarTelegram = request.EnviarTelegram;

                // Upsert canales: eliminar los que ya no vienen, actualizar o insertar los nuevos
                var codigosEnRequest = request.Canales.Select(c => c.CodigoCanal).ToHashSet();
                var canalesAEliminar = recordatorio.Canales
                    .Where(c => !codigosEnRequest.Contains(c.CodigoCanal))
                    .ToList();
                _context.WorkflowRecordatorioCanales.RemoveRange(canalesAEliminar);

                foreach (var canalDto in request.Canales)
                {
                    var existing = recordatorio.Canales.FirstOrDefault(c => c.CodigoCanal == canalDto.CodigoCanal);
                    if (existing != null)
                    {
                        existing.AsuntoTemplate = canalDto.AsuntoTemplate;
                        existing.CuerpoTemplate = canalDto.CuerpoTemplate;
                        existing.ListadoRowHtml = canalDto.ListadoRowHtml;
                        existing.Activo = canalDto.Activo;
                    }
                    else
                    {
                        recordatorio.Canales.Add(new Domain.Entities.Config.WorkflowRecordatorioCanal
                        {
                            CodigoCanal = canalDto.CodigoCanal,
                            AsuntoTemplate = canalDto.AsuntoTemplate,
                            CuerpoTemplate = canalDto.CuerpoTemplate,
                            ListadoRowHtml = canalDto.ListadoRowHtml,
                            Activo = canalDto.Activo
                        });
                    }
                }

                await _context.SaveChangesAsync();
                return ToRecordatorioResponse(recordatorio);
            }
            catch (Exception ex)
            {
                EnrichWideEvent("UpdateRecordatorio", entityId: idRecordatorio, exception: ex);
                return CommonErrors.DatabaseError("actualizar recordatorio");
            }
        }

        public async Task<ErrorOr<bool>> DeleteRecordatorioAsync(int idWorkflow, int idRecordatorio)
        {
            try
            {
                var recordatorio = await _context.WorkflowRecordatorios
                    .FirstOrDefaultAsync(r => r.IdRecordatorio == idRecordatorio && r.IdWorkflow == idWorkflow);

                if (recordatorio is null)
                    return Error.NotFound("Recordatorio.NotFound", $"No se encontró el recordatorio {idRecordatorio}.");

                _context.WorkflowRecordatorios.Remove(recordatorio);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("DeleteRecordatorio", entityId: idRecordatorio, exception: ex);
                return CommonErrors.DatabaseError("eliminar recordatorio");
            }
        }

        public async Task<ErrorOr<bool>> TestRecordatorioAsync(int idWorkflow, int idRecordatorio, int idUsuarioActual)
        {
            try
            {
                var recordatorio = await _context.WorkflowRecordatorios
                    .Include(r => r.Canales)
                    .FirstOrDefaultAsync(r => r.IdRecordatorio == idRecordatorio && r.IdWorkflow == idWorkflow);

                if (recordatorio is null)
                    return Error.NotFound("Recordatorio.NotFound", $"No se encontró el recordatorio {idRecordatorio}.");

                var ctx = new Dictionary<string, string>
                {
                    ["NombreResponsable"] = $"Usuario {idUsuarioActual}",
                    ["CantidadPendientes"] = "1",
                    ["DiasEspera"] = "0",
                    ["ListadoPendientes"] = "<p>(prueba de recordatorio)</p>",
                    ["Folio"] = "TEST",
                    ["Total"] = "$0.00",
                };

                var canalInApp = recordatorio.Canales.FirstOrDefault(c => c.CodigoCanal == "in_app" && c.Activo);
                var canalEmail = recordatorio.Canales.FirstOrDefault(c => c.CodigoCanal == "email" && c.Activo);

                var asunto = Interpolate(canalInApp?.AsuntoTemplate ?? canalEmail?.AsuntoTemplate ?? "Recordatorio", ctx);
                var cuerpo = Interpolate(canalInApp?.CuerpoTemplate ?? canalEmail?.CuerpoTemplate ?? "(sin contenido)", ctx);

                var channels = new List<NotificationChannelRequest>
                {
                    new NotificationChannelRequest { ChannelType = "in-app", UserIds = new List<int> { idUsuarioActual } }
                };
                if (recordatorio.EnviarEmail && canalEmail != null)
                    channels.Add(new NotificationChannelRequest { ChannelType = "email", UserIds = new List<int> { idUsuarioActual } });
                if (recordatorio.EnviarTelegram)
                    channels.Add(new NotificationChannelRequest { ChannelType = "telegram", UserIds = new List<int> { idUsuarioActual } });

                await _notificationService.SendAsync(new SendNotificationRequest
                {
                    Title = asunto,
                    Message = cuerpo,
                    Type = "info",
                    Priority = "normal",
                    Category = "order",
                    Channels = channels
                });

                var log = new WorkflowRecordatorioLog
                {
                    IdRecordatorio = idRecordatorio,
                    IdUsuario = idUsuarioActual,
                    OrdenesIncluidas = 0,
                    FechaEnvio = DateTime.UtcNow,
                    Canal = "test",
                    Estado = "enviado"
                };
                _context.WorkflowRecordatorioLogs.Add(log);
                await _context.SaveChangesAsync();

                return true;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("TestRecordatorio", entityId: idRecordatorio, exception: ex);
                return CommonErrors.DatabaseError("probar recordatorio");
            }
        }

        private static string Interpolate(string template, Dictionary<string, string> ctx)
        {
            foreach (var (key, value) in ctx)
                template = template.Replace($"{{{{{key}}}}}", value, StringComparison.OrdinalIgnoreCase);
            return template;
        }
    }
}
