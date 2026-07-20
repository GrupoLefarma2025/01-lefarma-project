using ErrorOr;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.Operaciones;
using Lefarma.API.Features.Config.Workflows;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.Config.Workflows.Handlers;
using Lefarma.API.Features.Config.Workflows.Notification;
using Lefarma.API.Features.OrdenesCompra.Firmas.DTOs;
using Lefarma.API.Features.Profile;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Net.Http.Json;
using System.Text.Json;

namespace Lefarma.API.Features.OrdenesCompra.Firmas
{
    public class OrdenCompraFirmasService : BaseService, IOrdenCompraFirmasService
    {
    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly IOrdenCompraRepository _ordenRepo;
    private readonly IWorkflowEngine _engine;
    private readonly IWorkflowRepository _workflowRepo;
    private readonly IWorkflowQueryService _queryService;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IJefeInmediatoResolver _jefeInmediatoResolver;
    private readonly IProfileService _profileService;
    protected override string EntityName => "Firma";

    public OrdenCompraFirmasService(
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        IOrdenCompraRepository ordenRepo,
        IWorkflowEngine engine,
        IWorkflowRepository workflowRepo,
        IWorkflowQueryService queryService,
        IServiceScopeFactory scopeFactory,
        IJefeInmediatoResolver jefeInmediatoResolver,
        IProfileService profileService,
        IWideEventAccessor wideEventAccessor)
        : base(wideEventAccessor)
    {
        _context = context;
        _asokamContext = asokamContext;
        _ordenRepo = ordenRepo;
        _engine = engine;
        _workflowRepo = workflowRepo;
        _queryService = queryService;
        _scopeFactory = scopeFactory;
        _jefeInmediatoResolver = jefeInmediatoResolver;
        _profileService = profileService;
    }

        public async Task<ErrorOr<FirmarResponse>> FirmarAsync(int idOrden, FirmarRequest request, int idUsuario)
        {
            try
            {
                var firmaValidacion = await ValidarFirmaUsuarioAsync(idUsuario);
                if (firmaValidacion.IsError)
                    return firmaValidacion.Errors;

                // Cargar orden con partidas
                var orden = await _ordenRepo.GetWithPartidasAsync(idOrden);
                if (orden is null)
                {
                    EnrichWideEvent("Firmar", entityId: idOrden, notFound: true);
                    return CommonErrors.NotFound("OrdenCompra", idOrden.ToString());
                }

                // Validar estado no terminal
                if (orden.IdEstado == 7 || orden.IdEstado == 9)
                    return CommonErrors.Conflict("OrdenCompra", $"La orden {orden.Folio} ya está cerrada o cancelada.");

                // Cargar workflow config con todas las navegaciones necesarias
                var workflowConfig = await _workflowRepo.GetQueryable()
                    .Include(w => w.Pasos)
                        .ThenInclude(p => p.AccionesOrigen)
                            .ThenInclude(a => a.Notificaciones)
                                .ThenInclude(n => n.Canales)
                    .Include(w => w.Pasos)
                        .ThenInclude(p => p.Participantes)
                    .FirstOrDefaultAsync(w => w.IdWorkflow == orden.IdWorkflow);

                if (workflowConfig is null)
                    return CommonErrors.NotFound("Workflow", orden.IdWorkflow.ToString());

                // Validar paso actual
                var pasoActual = workflowConfig.Pasos.FirstOrDefault(p => p.IdPaso == orden.IdPasoActual);
                if (pasoActual is null || !pasoActual.Activo)
                    return CommonErrors.Conflict("orden", "La orden no tiene un paso activo válido.");

                // Validar participante (USANDO HELPER)
                var validacion = await WorkflowFirmaHelper.ValidarParticipanteAsync(
                    pasoActual, idUsuario, orden.IdUsuarioCreador, _asokamContext, _jefeInmediatoResolver);
                if (validacion.IsError)
                    return validacion.Errors;

                var estadoAnterior = orden.Estado?.Codigo;

                // Construir contexto con datos adicionales (Total para condiciones)
                var datosAdicionales = request.DatosAdicionales ?? new Dictionary<string, object>();
                datosAdicionales["Total"] = orden.Total;

                // Ejecutar motor de workflow
                var ctx = new WorkflowContext(
                    IdWorkflow: orden.IdWorkflow,
                    IdEntidad: orden.IdOrden,
                    TipoEntidad: CodigoProceso.ORDEN_COMPRA,
                    Entidad: orden,
                    IdAccion: request.IdAccion,
                    IdUsuario: idUsuario,
                    Orden: orden,
                    Comentario: request.Comentario,
                    DatosAdicionales: datosAdicionales);
                var resultado = await _engine.EjecutarAccionAsync(ctx);
                if (!resultado.Exitoso)
                    return CommonErrors.Validation("Workflow", resultado.Error ?? "Error en el motor de workflow.");

                // Lógica específica OC: reset facturación en DEVOLVER
                await ProcesarDevolucionAsync(workflowConfig, request.IdAccion, idOrden);

                // Actualizar estado de la orden + fechas de ciclo de vida
                await ActualizarEstadoYFechasAsync(orden, resultado);

                // Resolver notificación a disparar
                var notificacion = WorkflowFirmaHelper.ResolverNotificacion(
                    workflowConfig, request.IdAccion, resultado.NuevoIdPaso);

                // Disparar notificación fire-and-forget (USANDO HELPER)
                var variables = ConstruirVariablesNotificacion(orden);
                var partidasHtml = notificacion.IncluirPartidas
                    ? BuildPartidasTable(orden.Partidas,
                        orden.Moneda?.Simbolo, orden.Moneda?.PosicionIzquierda ?? true,
                        notificacion.Canales.FirstOrDefault(c => c.Activo && !string.IsNullOrWhiteSpace(c.ListadoRowHtml))?.ListadoRowHtml)
                    : "";
                WorkflowFirmaHelper.DispatchNotificacionFireAndForget(
                    scopeFactory: _scopeFactory,
                    notificacion: notificacion,
                    tipoEntidad: CodigoProceso.ORDEN_COMPRA,
                    idEntidad: orden.IdOrden,
                    folio: orden.Folio,
                    idUsuarioCreador: orden.IdUsuarioCreador,
                    variablesExtra: variables,
                    idPasoDestino: resultado.NuevoIdPaso,
                    idUsuarioActual: idUsuario,
                    comentario: request.Comentario,
                    contenidoAdicionalHtml: partidasHtml);

                EnrichWideEvent("Firmar", entityId: idOrden, nombre: orden.Folio,
                    additionalContext: new Dictionary<string, object>
                    {
                        ["estadoAnterior"] = estadoAnterior,
                        ["nuevoEstado"] = orden.IdEstado,
                        ["idAccion"] = request.IdAccion,
                        ["idPasoDestino"] = resultado.NuevoIdPaso
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
                    FechaCreacion = DateTime.Now,    
                    Ordenes = ordenesExitosas
                };

                _context.EnviosConcentrado.Add(envioConcentrado);
                await _context.SaveChangesAsync();

                string? metadataJson = null;
                try
                {
                    var metadata = new Dictionary<string, string>();
                    if (metadata.Count > 0)
                    {
                        metadataJson = System.Text.Json.JsonSerializer.Serialize(metadata);
                    }
                }
                catch
                {
                    metadataJson = null;
                }

                var documento = new Domain.Entities.Asokam.Documento
                {
                    Id = Guid.NewGuid(),
                    NombreArchivo = $"Concentrado-{envioConcentrado.IdEnvioConcentrado}.pdf",
                    MimeType = "application/pdf",
                    TamanoBytes = 0,
                    PDFBinario = Array.Empty<byte>(),
                    PDFBinarioAutorizado = null,
                    Estatus = 1,
                    FechaSubida = DateTime.Now,
                    SubidoPorUsuario = idUsuario.ToString(),
                    FechaAutorizacion = null,
                    AutorizadoPorUsuario = null,
                    FechaRechazo = null,
                    RechazadoPorUsuario = null,
                    ComentariosSubida = request.Comentario,
                    ComentariosDecision = null,
                    Activo = true,
                    IpOrigen = "189.206.67.214",
                    HashSHA256Autorizado = null,
                    EnviadoParaAutorizacion = false,
                    NotificacionEnviada = false,
                    MetadataJSON = metadataJson,
                    TieneDocumentoLigado = false,
                    PDFBinarioAdicional = null
                };

                _asokamContext.Documentos.Add(documento);
                await _asokamContext.SaveChangesAsync();



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

        public async Task<ErrorOr<EnvioConcentradoResponse>> EnvioConcentradoConPdfAsync(EnvioConcentradoConPdfRequest request, int idUsuario)
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
                            Error = "La orden no tiene una acción de envío concentrado disponible."
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

                var ordenesExitosas = await _context.OrdenesCompra
                    .Where(o => idsExitosas.Contains(o.IdOrden))
                    .ToListAsync();
                var total = ordenesExitosas.Sum(o => o.Total);

                var token = Guid.NewGuid().ToString("N");
                var envioConcentrado = new EnvioConcentrado
                {
                    IdUsuarioEnvio = idUsuario,
                    Estado = "PENDIENTE",
                    TokenSeguridad = token,
                    Total = total,
                    CantidadOrdenes = ordenesExitosas.Count,
                    FechaCreacion = DateTime.Now,
                    Ordenes = ordenesExitosas
                };

                _context.EnviosConcentrado.Add(envioConcentrado);
                await _context.SaveChangesAsync();

                if (request.Archivo != null)
                {
                    using var ms = new MemoryStream();
                    await request.Archivo.CopyToAsync(ms);
                    var pdfBytes = ms.ToArray();

                    byte[]? soporteBytes = null;
                    if (request.TieneDocumentoSoporte && request.ArchivoSoporte != null)
                    {
                        using var msSoporte = new MemoryStream();
                        await request.ArchivoSoporte.CopyToAsync(msSoporte);
                        soporteBytes = msSoporte.ToArray();
                    }

                    string? metadataJson = null;
                    try
                    {
                        var toRaw = string.IsNullOrWhiteSpace(request.Correo) ? string.Empty : request.Correo.Trim();
                        var ccRaw = string.IsNullOrWhiteSpace(request.CorreoCC) ? string.Empty : request.CorreoCC.Trim();

                        var metadata = new Dictionary<string, string>();
                        if (!string.IsNullOrEmpty(toRaw)) metadata["to"] = toRaw;
                        if (!string.IsNullOrEmpty(ccRaw)) metadata["cc"] = ccRaw;

                        if (metadata.Count > 0)
                        {
                            metadataJson = System.Text.Json.JsonSerializer.Serialize(metadata);
                        }
                    }
                    catch
                    {
                        metadataJson = null;
                    }

                    var documento = new Domain.Entities.Asokam.Documento
                    {
                        Id = Guid.NewGuid(),
                        NombreArchivo = request.Nombre + ".pdf",
                        MimeType = "application/pdf",
                        TamanoBytes = pdfBytes.Length,
                        PDFBinario = pdfBytes,
                        PDFBinarioAutorizado = null,
                        Estatus = 1,
                        FechaSubida = DateTime.Now,
                        SubidoPorUsuario = request.Usuario ?? idUsuario.ToString(),
                        FechaAutorizacion = null,
                        AutorizadoPorUsuario = null,
                        FechaRechazo = null,
                        RechazadoPorUsuario = null,
                        ComentariosSubida = request.Comentario,
                        ComentariosDecision = null,
                        Activo = true,
                        IpOrigen = "189.206.67.214",
                        HashSHA256Autorizado = null,
                        EnviadoParaAutorizacion = false,
                        NotificacionEnviada = false,
                        MetadataJSON = metadataJson,
                        TieneDocumentoLigado = request.TieneDocumentoSoporte,
                        PDFBinarioAdicional = soporteBytes
                    };

                    _asokamContext.Documentos.Add(documento);
                    await _asokamContext.SaveChangesAsync();

                    var documentoInterfase = new Domain.Entities.Asokam.DocumentoInterfaseOC
                    {
                        IdDocumentoFirmar = documento.Id,
                        IdEnvioConcentrado = envioConcentrado.IdEnvioConcentrado
                    };
                    _asokamContext.DocumentosInterfaseOC.Add(documentoInterfase);
                    await _asokamContext.SaveChangesAsync();
                }

                await transaction.CommitAsync();

                EnrichWideEvent("EnvioConcentradoConPdf", additionalContext: new Dictionary<string, object>
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
                EnrichWideEvent("EnvioConcentradoConPdf", exception: ex);
                return CommonErrors.InternalServerError("Error inesperado al procesar el envío concentrado con PDF.");
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
                var esAprobar = request.Accion.ToUpper() == "AUTORIZAR";

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
                        ? accionesPaso.FirstOrDefault(a => a.TipoAccion?.Codigo == "AUTORIZAR" && a.Activo)
                        : accionesPaso.FirstOrDefault(a => a.TipoAccion?.Codigo == "DEVOLVER" && a.Activo);

                    if (accion is null)
                    {
                        resultados.Add(new EnvioConcentradoItemResult
                        {
                            IdOrden = orden.IdOrden,
                            Folio = orden.Folio,
                            Exitoso = false,
                            Error = $"No hay acción {(esAprobar ? "AUTORIZAR" : "DEVOLVER")} disponible."
                        });
                        continue;
                    }

                    var ctx = new WorkflowContext(
                        IdWorkflow: orden.IdWorkflow,
                        IdEntidad: orden.IdOrden,
                        TipoEntidad: CodigoProceso.ORDEN_COMPRA,
                        Entidad: orden,
                        IdAccion: accion.IdAccion,
                        IdUsuario: request.IdUsuario,
                        Orden: orden,
                        Comentario: request.Comentario
                    );

                    var resultado = await FirmarAsync(orden.IdOrden, new FirmarRequest { IdAccion = accion.IdAccion, Comentario = request.Comentario }, request.IdUsuario);


                    //var resultado = await _engine.EjecutarAccionAsync(ctx);

                    resultados.Add(new EnvioConcentradoItemResult
                    {
                        IdOrden = orden.IdOrden,
                        Folio = orden.Folio,
                        Exitoso = resultado.Value.Exitoso,
                        Error = resultado.Value.Mensaje,
                        NuevoEstado = resultado.Value.NuevoEstado?.ToString()
                    });
                }

                // Actualizar concentrado

                concentrado.Estado = esAprobar ? "APROBADO" : "DEVUELTO";
                concentrado.FechaRespuesta = DateTime.Now;
                concentrado.ComentarioRespuesta = request.Comentario;
                concentrado.FechaModificacion = DateTime.Now;
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
        
        public async Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesDisponiblesAsync(
            int idOrden, int idUsuario)
        {
            var orden = await _ordenRepo.GetByIdAsync(idOrden);
            if (orden is null)
                return CommonErrors.NotFound("OrdenCompra", idOrden.ToString());

            if (!orden.IdPasoActual.HasValue)
                return CommonErrors.Conflict("OrdenCompra", "La orden no tiene paso actual.");

            return await _queryService.GetAccionesDisponiblesAsync(
                idWorkflow: orden.IdWorkflow,
                idEntidad: orden.IdOrden,
                idPasoActual: orden.IdPasoActual.Value,
                idUsuario: idUsuario,
                tipoEntidad: CodigoProceso.ORDEN_COMPRA,
                entidadParaHandlers: orden);
        }

        public async Task<ErrorOr<AccionMetadataResponse>> GetAccionMetadataAsync(
            int idOrden, int idAccion, int idUsuario)
        {
            var orden = await _ordenRepo.GetByIdAsync(idOrden);
            if (orden is null)
                return CommonErrors.NotFound("OrdenCompra", idOrden.ToString());

            if (!orden.IdPasoActual.HasValue)
                return CommonErrors.Conflict("OrdenCompra", "La orden no tiene paso actual.");

            return await _queryService.GetAccionMetadataAsync(
                idWorkflow: orden.IdWorkflow,
                idPasoActual: orden.IdPasoActual.Value,
                idAccion: idAccion,
                idEntidad: orden.IdOrden);
        }

        public Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialAsync(int idOrden)
            => _queryService.GetHistorialWorkflowAsync(idOrden, CodigoProceso.ORDEN_COMPRA);


        private async Task<ErrorOr<Success>> ValidarFirmaUsuarioAsync(int idUsuario)
        {
            var tieneFirma = await _profileService.HasFirmaAsync(idUsuario);
            if (tieneFirma.IsError)
                return tieneFirma.Errors;

            if (!tieneFirma.Value)
                return CommonErrors.Validation("Firma", "El usuario no tiene una firma digital registrada. Cárguela en Configuración > Perfil para continuar.");

            return Result.Success;
        }

        private async Task<int?> GetEstadoIdByCodigoAsync(string codigo)
        {
            var estado = await _context.WorkflowEstados
                .FirstOrDefaultAsync(e => e.Codigo == codigo.ToUpper());
            return estado?.IdEstado;
        }
        private async Task ProcesarDevolucionAsync(Workflow workflow, int idAccion, int idOrden)
        {
            var accionEntity = workflow.Pasos
                .SelectMany(p => p.AccionesOrigen)
                .FirstOrDefault(a => a.IdAccion == idAccion);
            if (accionEntity?.TipoAccion?.Codigo != "DEVOLVER") return;

            var idPartidas = await _context.OrdenesCompraPartidas
                .Where(p => p.IdOrden == idOrden)
                .Select(p => p.IdPartida)
                .ToListAsync();

            if (idPartidas.Count == 0) return;

            await _context.OrdenesCompraPartidas
                .Where(p => idPartidas.Contains(p.IdPartida))
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.CantidadFacturada, 0m)
                    .SetProperty(p => p.ImporteFacturado, 0m)
                    .SetProperty(p => p.EstadoFacturacion, (byte)0));

            var idsComprobantes = await _context.ComprobantesPartidas
                .Where(cp => idPartidas.Contains(cp.IdPartida))
                .Select(cp => cp.IdComprobante)
                .Distinct()
                .ToListAsync();

            if (idsComprobantes.Count > 0)
            {
                await _context.Comprobantes
                    .Where(c => idsComprobantes.Contains(c.IdComprobante))
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(c => c.Estado, (byte)3)
                        .SetProperty(c => c.FechaModificacion, DateTime.Now));
            }
        }
        private async Task ActualizarEstadoYFechasAsync(OrdenCompra orden, WorkflowEjecucionResult resultado)
        {
            var nuevoIdEstado = resultado.NuevoIdEstado;
            if (nuevoIdEstado.HasValue)
            {
                orden.IdEstado = nuevoIdEstado.Value;

                var estados = await _context.WorkflowEstados
                    .Where(e => e.Activo)
                    .ToDictionaryAsync(e => e.Codigo!, e => e.IdEstado);

                var idAprobacion = estados.GetValueOrDefault(WorkflowEstadoCodigo.APROBACION);
                var idTesoreria = estados.GetValueOrDefault(WorkflowEstadoCodigo.TESORERIA);
                var idPagada = estados.GetValueOrDefault(WorkflowEstadoCodigo.PAGADA);
                var idCerrada = estados.GetValueOrDefault(WorkflowEstadoCodigo.CERRADA);
                var idRechazada = estados.GetValueOrDefault(WorkflowEstadoCodigo.RECHAZADA);
                var idCancelada = estados.GetValueOrDefault(WorkflowEstadoCodigo.CANCELADA);

                if (nuevoIdEstado == idAprobacion) orden.FechaSolicitud = DateTime.Now;
                if (nuevoIdEstado == idTesoreria) orden.FechaAutorizacion = DateTime.Now;
                if (nuevoIdEstado == idPagada || (nuevoIdEstado == idCerrada && orden.IdEstado == idTesoreria))
                    orden.FechaPago = DateTime.Now;
                if (nuevoIdEstado == idCerrada) orden.FechaCierre = DateTime.Now;
                if (nuevoIdEstado == idRechazada) orden.FechaRechazo = DateTime.Now;
                if (nuevoIdEstado == idCancelada) orden.FechaCancelacion = DateTime.Now;
            }

            orden.IdPasoActual = resultado.NuevoIdPaso;
            orden.FechaModificacion = DateTime.Now;
            await _ordenRepo.UpdateAsync(orden);
        }
        private static Dictionary<string, string> ConstruirVariablesNotificacion(OrdenCompra orden) => new()
        {
            ["Total"] = FormatearDinero(orden.Total, orden.Moneda?.Simbolo, orden.Moneda?.PosicionIzquierda ?? true),
            ["Proveedor"] = orden.Proveedor?.RazonSocial ?? "",
            ["CentroCosto"] = orden.CentroCosto?.Nombre ?? orden.IdCentroCosto?.ToString() ?? "",
            ["CuentaContable"] = orden.CuentaContable?.Cuenta ?? orden.IdCuentaContable?.ToString() ?? "",
            ["ImportePagado"] = ""
        };
        private static string BuildPartidasTable(ICollection<OrdenCompraPartida> partidas, string? simboloMoneda, bool posicionIzquierda, string? rowTemplate = null)
        {
            if (partidas == null || partidas.Count == 0)
                return "<p style=\"color:#6b7280;font-size:13px\">Sin partidas registradas.</p>";

            string BuildRow(OrdenCompraPartida p)
            {
                if (!string.IsNullOrWhiteSpace(rowTemplate))
                {
                    return rowTemplate
                        .Replace("{{NumeroPartida}}", p.NumeroPartida.ToString())
                        .Replace("{{Descripcion}}", p.Descripcion ?? "")
                        .Replace("{{Cantidad}}", p.Cantidad.ToString("G"))
                        .Replace("{{PrecioUnitario}}", FormatearDinero(p.PrecioUnitario, simboloMoneda, posicionIzquierda))
                        .Replace("{{Total}}", FormatearDinero(p.Total, simboloMoneda, posicionIzquierda));
                }
                return $"""
                <tr>
                  <td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:13px;color:#374151">{p.NumeroPartida}</td>
                  <td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:13px;color:#374151">{p.Descripcion}</td>
                  <td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:13px;color:#374151;text-align:right">{p.Cantidad:G}</td>
                  <td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:13px;color:#374151;text-align:right">{FormatearDinero(p.PrecioUnitario, simboloMoneda, posicionIzquierda)}</td>
                  <td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:13px;color:#374151;text-align:right;font-weight:600">{FormatearDinero(p.Total, simboloMoneda, posicionIzquierda)}</td>
                </tr>
                """;
            }

            var rows = string.Concat(partidas.OrderBy(p => p.NumeroPartida).Select(BuildRow));

            return $"""
            <table style="width:100%;border-collapse:collapse;margin:12px 0;font-family:inherit">
              <thead>
                <tr style="background-color:#f3f4f6">
                  <th style="padding:8px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:left;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">#</th>
                  <th style="padding:8px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:left;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Descripción</th>
                  <th style="padding:8px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:right;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Cant.</th>
                  <th style="padding:8px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:right;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Precio Unit.</th>
                  <th style="padding:8px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:right;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows}
              </tbody>
            </table>
            """;
        }

        private static string FormatearDinero(decimal value, string? simboloMoneda, bool posicionIzquierda = true)
        {
            return
            string.IsNullOrEmpty(simboloMoneda)
            ? value.ToString("N2")
            : posicionIzquierda
                ? $"{simboloMoneda} {value:N2}"
                : $"{value:N2} {simboloMoneda}";
        }


    }
}
