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
using Microsoft.Extensions.Configuration;
using System.Net.Http.Json;

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
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        protected override string EntityName => "Firma";

        public FirmasService(
            IOrdenCompraRepository ordenRepo,
            IWorkflowEngine engine,
            IWorkflowRepository workflowRepo,
            ApplicationDbContext context,
            AsokamDbContext asokamContext,
            IServiceScopeFactory scopeFactory,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            IWideEventAccessor wideEventAccessor)
            : base(wideEventAccessor)
        {
            _ordenRepo = ordenRepo;
            _engine = engine;
            _workflowRepo = workflowRepo;
            _context = context;
            _asokamContext = asokamContext;
            _scopeFactory = scopeFactory;
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
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
                        .ThenInclude(p => p.AccionesOrigen)
                    .Include(w => w.Pasos)
                        .ThenInclude(p => p.Participantes)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == orden.IdWorkflow);

                if (workflowConfig is null)
                    return CommonErrors.NotFound("Workflow", orden.IdWorkflow.ToString());

                var pasoActual = workflowConfig.Pasos.FirstOrDefault(p => p.IdPaso == orden.IdPasoActual);
                if (pasoActual is null || !pasoActual.Activo)
                    return CommonErrors.Conflict("orden", "La orden no tiene un paso activo válido.");

                // Validar que el usuario es participante del paso actual
                var participantes = pasoActual.Participantes.Where(p => p.Activo).ToList();
                if (participantes.Any())
                {
                    var esParticipante = participantes.Any(p => p.IdUsuario == idUsuario);
                    if (!esParticipante)
                    {
                        var rolesUsuario = await _context.UsuariosRoles
                            .Where(ur => ur.IdUsuario == idUsuario && (ur.FechaExpiracion == null || ur.FechaExpiracion > DateTime.UtcNow))
                            .Select(ur => ur.IdRol)
                            .ToListAsync();
                        esParticipante = participantes.Any(p => p.IdRol.HasValue && rolesUsuario.Contains(p.IdRol.Value));
                    }
                    if (!esParticipante)
                        return CommonErrors.Validation("Autorizacion", "No eres participante de este paso del workflow.");
                }

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
                        EnviaConcentrado = a.EnviaConcentrado,
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
                        .ThenInclude(p => p.AccionesOrigen)
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

        public async Task<ErrorOr<EnvioConcentradoResponse>> EnvioConcentradoAsync(EnvioConcentradoRequest request, int idUsuario)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            
            try
            {
                var resultados = new List<EnvioConcentradoItemResult>();

                foreach (var idOrden in request.IdsOrdenes)
                {
                    var orden = await _ordenRepo.GetWithPartidasAsync(idOrden);
                    if (orden is null)
                    {
                        resultados.Add(new EnvioConcentradoItemResult
                        {
                            IdOrden = idOrden,
                            Folio = $"OC-{idOrden}",
                            Exitoso = false,
                            Error = "Orden no encontrada."
                        });
                        continue;
                    }

                    if (!orden.IdPasoActual.HasValue)
                    {
                        resultados.Add(new EnvioConcentradoItemResult
                        {
                            IdOrden = idOrden,
                            Folio = orden.Folio,
                            Exitoso = false,
                            Error = "La orden no tiene paso actual."
                        });
                        continue;
                    }

                    var accionesPaso = await _workflowRepo.GetAccionesDisponiblesAsync(orden.IdPasoActual.Value);
                    var accionEnviar = accionesPaso.FirstOrDefault(a => a.EnviaConcentrado && a.Activo);

                    if (accionEnviar is null)
                    {
                        resultados.Add(new EnvioConcentradoItemResult
                        {
                            IdOrden = idOrden,
                            Folio = orden.Folio,
                            Exitoso = false,
                            Error = "La orden no tiene una acción de envío concentrado disponible en su paso actual."
                        });
                        continue;
                    }

                    var firmarReq = new FirmarRequest
                    {
                        IdAccion = accionEnviar.IdAccion,
                        Comentario = request.Comentario ?? "Enviado en lote desde Concentrado de Órdenes"
                    };

                    var resultado = await FirmarAsync(idOrden, firmarReq, idUsuario);

                    if (resultado.IsError)
                    {
                        resultados.Add(new EnvioConcentradoItemResult
                        {
                            IdOrden = idOrden,
                            Folio = orden.Folio,
                            Exitoso = false,
                            Error = resultado.FirstError.Description
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
                var idsExitosas = resultados.Where(r => r.Exitoso).Select(r => r.IdOrden).ToList();
                
                if (exitosas == 0)
                {
                    await transaction.RollbackAsync();
                    return new EnvioConcentradoResponse
                    {
                        Total = request.IdsOrdenes.Count,
                        Exitosas = 0,
                        Fallidas = request.IdsOrdenes.Count,
                        Resultados = resultados
                    };
                }

                // Obtener ordenes exitosas para calcular total
                var ordenesExitosas = await _context.OrdenesCompra
                    .Where(o => idsExitosas.Contains(o.IdOrden))
                    .ToListAsync();
                var total = ordenesExitosas.Sum(o => o.Total);

                // Crear registro de envio concentrado
                var token = Guid.NewGuid().ToString("N");
                var envioConcentrado = new EnvioConcentrado
                {
                    IdUsuarioEnvio = idUsuario,
                    Estado = "PENDIENTE",
                    TokenSeguridad = token,
                    Total = total,
                    CantidadOrdenes = ordenesExitosas.Count,
                    FechaCreacion = DateTime.UtcNow,
                    Ordenes = ordenesExitosas
                };

                _context.EnviosConcentrado.Add(envioConcentrado);
                await _context.SaveChangesAsync();

                // Enviar al sistema externo
                var endpointExterno = _configuration["Integraciones:EnvioConcentrado:EndpointExterno"];
                if (!string.IsNullOrEmpty(endpointExterno))
                {
                    try
                    {
                        var httpClient = _httpClientFactory.CreateClient();
                        await httpClient.PostAsJsonAsync(endpointExterno, new
                        {
                            IdConcentrado = envioConcentrado.IdEnvioConcentrado,
                            TokenSeguridad = token,
                            IdsOrdenes = idsExitosas,
                            Total = total,
                            CantidadOrdenes = ordenesExitosas.Count,
                            FechaEnvio = envioConcentrado.FechaEnvio
                        });
                    }
                    catch (HttpRequestException)
                    {
                        // El envio queda en PENDIENTE, se puede reintentar manualmente
                        // Loggear error
                    }
                }

                await transaction.CommitAsync();

                EnrichWideEvent("EnvioConcentrado", additionalContext: new Dictionary<string, object>
                {
                    ["idConcentrado"] = envioConcentrado.IdEnvioConcentrado,
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
                await transaction.RollbackAsync();
                EnrichWideEvent("EnvioConcentrado", exception: ex);
                return CommonErrors.InternalServerError("Error inesperado al procesar el envío concentrado.");
            }
        }

        public async Task<ErrorOr<RespuestaConcentradoResponse>> ProcesarRespuestaConcentradoAsync(RespuestaConcentradoExternoRequest request)
        {
            try
            {
                var concentrado = await _context.EnviosConcentrado
                    .Include(e => e.Ordenes)
                    .FirstOrDefaultAsync(e => e.IdEnvioConcentrado == request.IdConcentrado 
                        && e.TokenSeguridad == request.TokenSeguridad);

                if (concentrado is null)
                    return CommonErrors.NotFound("Concentrado", $"ID: {request.IdConcentrado}");

                if (concentrado.Estado != "PENDIENTE")
                    return CommonErrors.Conflict("Concentrado", $"El concentrado ya fue {concentrado.Estado}.");

                var resultados = new List<EnvioConcentradoItemResult>();
                var esAprobar = request.Accion.ToUpper() == "APROBAR";

                foreach (var orden in concentrado.Ordenes)
                {
                    if (!orden.IdPasoActual.HasValue)
                    {
                        resultados.Add(new EnvioConcentradoItemResult
                        {
                            IdOrden = orden.IdOrden,
                            Folio = orden.Folio,
                            Exitoso = false,
                            Error = "La orden no tiene paso actual."
                        });
                        continue;
                    }

                    var accionesPaso = await _workflowRepo.GetAccionesDisponiblesAsync(orden.IdPasoActual.Value);
                    var accion = esAprobar
                        ? accionesPaso.FirstOrDefault(a => a.TipoAccion?.Codigo == "APROBAR" && a.Activo)
                        : accionesPaso.FirstOrDefault(a => a.TipoAccion?.Codigo == "DEVOLVER" && a.Activo);

                    if (accion is null)
                    {
                        resultados.Add(new EnvioConcentradoItemResult
                        {
                            IdOrden = orden.IdOrden,
                            Folio = orden.Folio,
                            Exitoso = false,
                            Error = $"No hay acción {(esAprobar ? "APROBAR" : "DEVOLVER")} disponible."
                        });
                        continue;
                    }

                    var ctx = new WorkflowContext(
                        IdWorkflow: orden.IdWorkflow,
                        IdOrden: orden.IdOrden,
                        IdAccion: accion.IdAccion,
                        IdUsuario: 0, // Sistema externo
                        Orden: orden,
                        Comentario: request.Comentario
                    );

                    var resultado = await _engine.EjecutarAccionAsync(ctx);

                    resultados.Add(new EnvioConcentradoItemResult
                    {
                        IdOrden = orden.IdOrden,
                        Folio = orden.Folio,
                        Exitoso = resultado.Exitoso,
                        Error = resultado.Error,
                        NuevoEstado = resultado.NuevoIdEstado?.ToString()
                    });
                }

                // Actualizar concentrado
                concentrado.Estado = esAprobar ? "APROBADO" : "DEVUELTO";
                concentrado.FechaRespuesta = DateTime.UtcNow;
                concentrado.ComentarioRespuesta = request.Comentario;
                concentrado.FechaModificacion = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return new RespuestaConcentradoResponse
                {
                    Total = concentrado.Ordenes.Count,
                    Exitosas = resultados.Count(r => r.Exitoso),
                    Fallidas = resultados.Count - resultados.Count(r => r.Exitoso),
                    Resultados = resultados
                };
            }
            catch (Exception ex)
            {
                EnrichWideEvent("RespuestaConcentrado", exception: ex);
                return CommonErrors.InternalServerError("Error inesperado al procesar respuesta del concentrado.");
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
