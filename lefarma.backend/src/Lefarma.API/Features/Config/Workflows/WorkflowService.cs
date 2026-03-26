using ErrorOr;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Config.Workflows
{
    public class WorkflowService : BaseService, IWorkflowService
    {
        private readonly IWorkflowRepository _repo;
        protected override string EntityName => "Workflow";

        public WorkflowService(IWorkflowRepository repo, IWideEventAccessor wideEventAccessor)
            : base(wideEventAccessor)
        {
            _repo = repo;
        }

        public async Task<ErrorOr<IEnumerable<WorkflowResponse>>> GetAllAsync(WorkflowRequest query)
        {
            try
            {
                var q = _repo.GetQueryable()
                    .Include(w => w.Pasos).ThenInclude(p => p.AccionesOrigen).ThenInclude(a => a.Notificaciones)
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
                    .Include(w => w.Pasos).ThenInclude(p => p.AccionesOrigen).ThenInclude(a => a.Notificaciones)
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
                    .Include(w => w.Pasos).ThenInclude(p => p.AccionesOrigen)
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

                // Actualizar propiedades del paso
                paso.NombrePaso = request.NombrePaso;
                paso.CodigoEstado = request.CodigoEstado;
                paso.DescripcionAyuda = request.DescripcionAyuda;
                paso.HandlerKey = request.HandlerKey;
                paso.EsInicio = request.EsInicio;
                paso.EsFinal = request.EsFinal;
                paso.RequiereFirma = request.RequiereFirma;
                paso.RequiereComentario = request.RequiereComentario;
                paso.RequiereAdjunto = request.RequiereAdjunto;

                await _repo.UpdateAsync(workflow);

                var response = new WorkflowPasoResponse
                {
                    IdPaso = paso.IdPaso,
                    Orden = paso.Orden,
                    NombrePaso = paso.NombrePaso,
                    CodigoEstado = paso.CodigoEstado,
                    DescripcionAyuda = paso.DescripcionAyuda,
                    HandlerKey = paso.HandlerKey,
                    EsInicio = paso.EsInicio,
                    EsFinal = paso.EsFinal,
                    RequiereFirma = paso.RequiereFirma,
                    RequiereComentario = paso.RequiereComentario,
                    RequiereAdjunto = paso.RequiereAdjunto,
                    Acciones = paso.AccionesOrigen.Select(a => new WorkflowAccionResponse
                    {
                        IdAccion = a.IdAccion,
                        NombreAccion = a.NombreAccion,
                        TipoAccion = a.TipoAccion,
                        ClaseEstetica = a.ClaseEstetica,
                        IdPasoDestino = a.IdPasoDestino
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

        // ============================================================================
        // ACCIONES
        // ============================================================================
        public async Task<ErrorOr<WorkflowAccionResponse>> CreateAccionAsync(int idWorkflow, int idPaso, CreateAccionRequest request)
        {
            try
            {
                var workflow = await _repo.GetQueryable()
                    .Include(w => w.Pasos).ThenInclude(p => p.AccionesOrigen)
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

                var accion = new WorkflowAccion
                {
                    IdPasoOrigen = idPaso,
                    NombreAccion = request.NombreAccion,
                    TipoAccion = request.TipoAccion,
                    ClaseEstetica = request.ClaseEstetica,
                    IdPasoDestino = request.IdPasoDestino
                };

                paso.AccionesOrigen.Add(accion);
                await _repo.UpdateAsync(workflow);

                var response = new WorkflowAccionResponse
                {
                    IdAccion = accion.IdAccion,
                    NombreAccion = accion.NombreAccion,
                    TipoAccion = accion.TipoAccion,
                    ClaseEstetica = accion.ClaseEstetica,
                    IdPasoDestino = accion.IdPasoDestino
                };

                EnrichWideEvent("CreateAccion", entityId: accion.IdAccion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["pasoId"] = idPaso });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("CreateAccion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("crear acción");
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
                    return CommonErrors.NotFound("Acción", idAccion.ToString());
                }

                accion.NombreAccion = request.NombreAccion;
                accion.TipoAccion = request.TipoAccion;
                accion.ClaseEstetica = request.ClaseEstetica;
                accion.IdPasoDestino = request.IdPasoDestino;

                await _repo.UpdateAsync(workflow);

                var response = new WorkflowAccionResponse
                {
                    IdAccion = accion.IdAccion,
                    NombreAccion = accion.NombreAccion,
                    TipoAccion = accion.TipoAccion,
                    ClaseEstetica = accion.ClaseEstetica,
                    IdPasoDestino = accion.IdPasoDestino
                };

                EnrichWideEvent("UpdateAccion", entityId: idAccion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["pasoId"] = idPaso });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("UpdateAccion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("actualizar acción");
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

                var accion = paso.AccionesOrigen.FirstOrDefault(a => a.IdAccion == idAccion);
                if (accion == null)
                {
                    EnrichWideEvent("DeleteAccion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["pasoId"] = idPaso, ["accionId"] = idAccion, ["notFound"] = true });
                    return CommonErrors.NotFound("Acción", idAccion.ToString());
                }

                paso.AccionesOrigen.Remove(accion);
                await _repo.UpdateAsync(workflow);

                EnrichWideEvent("DeleteAccion", entityId: idAccion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["pasoId"] = idPaso });
                return true;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("DeleteAccion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("eliminar acción");
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

                var condicion = new WorkflowCondicion
                {
                    IdPaso = idPaso,
                    CampoEvaluacion = request.CampoEvaluacion,
                    Operador = request.Operador,
                    ValorComparacion = request.ValorComparacion,
                    IdPasoSiCumple = request.IdPasoSiCumple
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
                    IdPasoSiCumple = condicion.IdPasoSiCumple
                };

                EnrichWideEvent("CreateCondicion", entityId: condicion.IdCondicion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["pasoId"] = idPaso });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("CreateCondicion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("crear condición");
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
                    return CommonErrors.NotFound("Condición", idCondicion.ToString());
                }

                condicion.CampoEvaluacion = request.CampoEvaluacion;
                condicion.Operador = request.Operador;
                condicion.ValorComparacion = request.ValorComparacion;
                condicion.IdPasoSiCumple = request.IdPasoSiCumple;

                await _repo.UpdateAsync(workflow);

                var response = new CondicionResponse
                {
                    IdCondicion = condicion.IdCondicion,
                    IdPaso = condicion.IdPaso,
                    CampoEvaluacion = condicion.CampoEvaluacion,
                    Operador = condicion.Operador,
                    ValorComparacion = condicion.ValorComparacion,
                    IdPasoSiCumple = condicion.IdPasoSiCumple
                };

                EnrichWideEvent("UpdateCondicion", entityId: idCondicion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["pasoId"] = idPaso });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("UpdateCondicion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("actualizar condición");
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
                    return CommonErrors.NotFound("Condición", idCondicion.ToString());
                }

                paso.Condiciones.Remove(condicion);
                await _repo.UpdateAsync(workflow);

                EnrichWideEvent("DeleteCondicion", entityId: idCondicion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["pasoId"] = idPaso });
                return true;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("DeleteCondicion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("eliminar condición");
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

                var participante = new WorkflowParticipante
                {
                    IdPaso = idPaso,
                    IdRol = request.IdRol,
                    IdUsuario = request.IdUsuario
                };

                paso.Participantes.Add(participante);
                await _repo.UpdateAsync(workflow);

                var response = new ParticipanteResponse
                {
                    IdParticipante = participante.IdParticipante,
                    IdPaso = participante.IdPaso,
                    IdRol = participante.IdRol,
                    IdUsuario = participante.IdUsuario
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

                participante.IdRol = request.IdRol;
                participante.IdUsuario = request.IdUsuario;

                await _repo.UpdateAsync(workflow);

                var response = new ParticipanteResponse
                {
                    IdParticipante = participante.IdParticipante,
                    IdPaso = participante.IdPaso,
                    IdRol = participante.IdRol,
                    IdUsuario = participante.IdUsuario
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

                paso.Participantes.Remove(participante);
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
                    return CommonErrors.NotFound("Acción", idAccion.ToString());
                }

                var notificacion = new WorkflowNotificacion
                {
                    IdAccion = idAccion,
                    IdPasoDestino = request.IdPasoDestino,
                    EnviarEmail = request.EnviarEmail,
                    EnviarWhatsapp = request.EnviarWhatsapp,
                    EnviarTelegram = request.EnviarTelegram,
                    AvisarAlCreador = request.AvisarAlCreador,
                    AvisarAlSiguiente = request.AvisarAlSiguiente,
                    AvisarAlAnterior = request.AvisarAlAnterior,
                    AsuntoTemplate = request.AsuntoTemplate,
                    CuerpoTemplate = request.CuerpoTemplate
                };

                accion.Notificaciones.Add(notificacion);
                await _repo.UpdateAsync(workflow);

                var response = new NotificacionResponse
                {
                    IdNotificacion = notificacion.IdNotificacion,
                    IdAccion = notificacion.IdAccion,
                    IdPasoDestino = notificacion.IdPasoDestino,
                    EnviarEmail = notificacion.EnviarEmail,
                    EnviarWhatsapp = notificacion.EnviarWhatsapp,
                    EnviarTelegram = notificacion.EnviarTelegram,
                    AvisarAlCreador = notificacion.AvisarAlCreador,
                    AvisarAlSiguiente = notificacion.AvisarAlSiguiente,
                    AvisarAlAnterior = notificacion.AvisarAlAnterior,
                    AsuntoTemplate = notificacion.AsuntoTemplate,
                    CuerpoTemplate = notificacion.CuerpoTemplate
                };

                EnrichWideEvent("CreateNotificacion", entityId: notificacion.IdNotificacion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["accionId"] = idAccion });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("CreateNotificacion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("crear notificación");
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
                    return CommonErrors.NotFound("Acción", idAccion.ToString());
                }

                var notificacion = accion.Notificaciones.FirstOrDefault(n => n.IdNotificacion == idNotificacion);
                if (notificacion == null)
                {
                    EnrichWideEvent("UpdateNotificacion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["accionId"] = idAccion, ["notificacionId"] = idNotificacion, ["notFound"] = true });
                    return CommonErrors.NotFound("Notificación", idNotificacion.ToString());
                }

                notificacion.EnviarEmail = request.EnviarEmail;
                notificacion.EnviarWhatsapp = request.EnviarWhatsapp;
                notificacion.EnviarTelegram = request.EnviarTelegram;
                notificacion.IdPasoDestino = request.IdPasoDestino;
                notificacion.AvisarAlCreador = request.AvisarAlCreador;
                notificacion.AvisarAlSiguiente = request.AvisarAlSiguiente;
                notificacion.AvisarAlAnterior = request.AvisarAlAnterior;
                notificacion.AsuntoTemplate = request.AsuntoTemplate;
                notificacion.CuerpoTemplate = request.CuerpoTemplate;

                await _repo.UpdateAsync(workflow);

                var response = new NotificacionResponse
                {
                    IdNotificacion = notificacion.IdNotificacion,
                    IdAccion = notificacion.IdAccion,
                    IdPasoDestino = notificacion.IdPasoDestino,
                    EnviarEmail = notificacion.EnviarEmail,
                    EnviarWhatsapp = notificacion.EnviarWhatsapp,
                    EnviarTelegram = notificacion.EnviarTelegram,
                    AvisarAlCreador = notificacion.AvisarAlCreador,
                    AvisarAlSiguiente = notificacion.AvisarAlSiguiente,
                    AvisarAlAnterior = notificacion.AvisarAlAnterior,
                    AsuntoTemplate = notificacion.AsuntoTemplate,
                    CuerpoTemplate = notificacion.CuerpoTemplate
                };

                EnrichWideEvent("UpdateNotificacion", entityId: idNotificacion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["accionId"] = idAccion });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("UpdateNotificacion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("actualizar notificación");
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
                    return CommonErrors.NotFound("Acción", idAccion.ToString());
                }

                var notificacion = accion.Notificaciones.FirstOrDefault(n => n.IdNotificacion == idNotificacion);
                if (notificacion == null)
                {
                    EnrichWideEvent("DeleteNotificacion", entityId: idWorkflow, additionalContext: new Dictionary<string, object> { ["accionId"] = idAccion, ["notificacionId"] = idNotificacion, ["notFound"] = true });
                    return CommonErrors.NotFound("Notificación", idNotificacion.ToString());
                }

                accion.Notificaciones.Remove(notificacion);
                await _repo.UpdateAsync(workflow);

                EnrichWideEvent("DeleteNotificacion", entityId: idNotificacion, additionalContext: new Dictionary<string, object> { ["workflowId"] = idWorkflow, ["accionId"] = idAccion });
                return true;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("DeleteNotificacion", entityId: idWorkflow, exception: ex);
                return CommonErrors.DatabaseError("eliminar notificación");
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
            Pasos = w.Pasos.OrderBy(p => p.Orden).Select(p => new WorkflowPasoResponse
            {
                IdPaso = p.IdPaso,
                Orden = p.Orden,
                NombrePaso = p.NombrePaso,
                CodigoEstado = p.CodigoEstado,
                DescripcionAyuda = p.DescripcionAyuda,
                HandlerKey = p.HandlerKey,
                EsInicio = p.EsInicio,
                EsFinal = p.EsFinal,
                RequiereFirma = p.RequiereFirma,
                RequiereComentario = p.RequiereComentario,
                RequiereAdjunto = p.RequiereAdjunto,
                Acciones = p.AccionesOrigen.Select(a => new WorkflowAccionResponse
                {
                    IdAccion = a.IdAccion,
                    NombreAccion = a.NombreAccion,
                    TipoAccion = a.TipoAccion,
                    ClaseEstetica = a.ClaseEstetica,
                    IdPasoDestino = a.IdPasoDestino,
                    Notificaciones = a.Notificaciones.Select(n => new NotificacionResponse
                    {
                        IdNotificacion = n.IdNotificacion,
                        IdAccion = n.IdAccion,
                        IdPasoDestino = n.IdPasoDestino,
                        EnviarEmail = n.EnviarEmail,
                        EnviarWhatsapp = n.EnviarWhatsapp,
                        EnviarTelegram = n.EnviarTelegram,
                        AvisarAlCreador = n.AvisarAlCreador,
                        AvisarAlSiguiente = n.AvisarAlSiguiente,
                        AvisarAlAnterior = n.AvisarAlAnterior,
                        AsuntoTemplate = n.AsuntoTemplate,
                        CuerpoTemplate = n.CuerpoTemplate
                    }).ToList()
                }).ToList(),
                Condiciones = p.Condiciones.Select(c => new CondicionResponse
                {
                    IdCondicion = c.IdCondicion,
                    IdPaso = c.IdPaso,
                    CampoEvaluacion = c.CampoEvaluacion,
                    Operador = c.Operador,
                    ValorComparacion = c.ValorComparacion,
                    IdPasoSiCumple = c.IdPasoSiCumple
                }).ToList(),
                Participantes = p.Participantes.Select(pt => new ParticipanteResponse
                {
                    IdParticipante = pt.IdParticipante,
                    IdPaso = pt.IdPaso,
                    IdRol = pt.IdRol,
                    IdUsuario = pt.IdUsuario
                }).ToList()
            }).ToList(),
            Stats = new WorkflowStatsResponse
            {
                TotalPasos = w.Pasos.Count,
                TotalAcciones = w.Pasos.SelectMany(p => p.AccionesOrigen).Count(),
                TotalCondiciones = w.Pasos.SelectMany(p => p.Condiciones).Count(),
                TotalNotificaciones = w.Pasos.SelectMany(p => p.AccionesOrigen)
                    .SelectMany(a => a.Notificaciones).Count()
            }
        };
    }
}
