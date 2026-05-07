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

                /*
                 tengo que enviar esto 
        // 📤 SUBIR PDF
        app.MapPost("/subir-documento", SubirPDF)
            .DisableAntiforgery()
            .AllowAnonymous()
            .Accepts<SubirPdfDto>("multipart/form-data")
            .Produces<object>(200)
            .Produces<object>(400)
            .WithName("SubirPDF")
            .WithOpenApi();
  
                que vendria a ser esto public async Task<IResult> SubirPDF(IConfiguration configuration, HttpContext httpContext, IDbService db, [FromForm] SubirPdfDto dto)
    {
        var startTime = DateTime.Now;

        try
        {   
            if (dto.Archivo == null || dto.Archivo.Length == 0)
                return ApiResponseFactory.BadRequest<string>("", 0, startTime, new[] { "No se recibió ningún archivo" });

            if (!dto.Archivo.ContentType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase))
                return ApiResponseFactory.BadRequest<string>("", 0, startTime, new[] { "El archivo debe ser un PDF" });

            // Convertir PDF a binario
            byte[] pdfBytes;
            using (var ms = new MemoryStream())
            {
                await dto.Archivo.CopyToAsync(ms);
                pdfBytes = ms.ToArray();
            }
            byte[]? pdfBytesSoporte = null;
            if (dto.TieneDocumentoSoporte)
            {
                if (dto.ArchivoSoporte == null || dto.ArchivoSoporte.Length == 0)
                    return ApiResponseFactory.BadRequest<string>("", 0, startTime, new[] { "No se recibió ningún archivo" });

                if (!dto.ArchivoSoporte.ContentType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase))
                    return ApiResponseFactory.BadRequest<string>("", 0, startTime, new[] { "El archivo debe ser un PDF" });

                using (var ms = new MemoryStream())
                {
                    await dto.ArchivoSoporte.CopyToAsync(ms);
                    pdfBytesSoporte = ms.ToArray();
                }
            }

            // Parámetros para SP (Operación 1: Subida)
            // Construir MetadataJSON con correos (to y cc). Los valores vienen separados por punto y coma.
            string? metadataJson = null;
            try
            {
                var toRaw = string.IsNullOrWhiteSpace(dto.Correo) ? string.Empty : dto.Correo.Trim();
                var ccRaw = string.IsNullOrWhiteSpace(dto.CorreoCC) ? string.Empty : dto.CorreoCC.Trim();

                // Si no vienen valores, dejamos metadataJson en null para que se guarde NULL en BD
                var metadata = new Dictionary<string, string>();
                if (!string.IsNullOrEmpty(toRaw)) metadata["to"] = toRaw;
                if (!string.IsNullOrEmpty(ccRaw)) metadata["cc"] = ccRaw;

                if (metadata.Count > 0)
                {
                    metadataJson = JsonSerializer.Serialize(metadata);
                }
            }
            catch
            {
                // No detener el flujo por un fallo en construir metadata; quedará null
                metadataJson = null;
            }

            var parametros = new
            {
                Operacion = 1,
                NombreArchivo = dto.Nombre + Path.GetExtension(dto.Archivo.FileName), //pegarle la extension del archvio ,
                MimeType = dto.Archivo.ContentType,
                TamanoBytes = pdfBytes.Length,
                PDFBinario = pdfBytes,
                SubidoPorUsuario = dto.Usuario,
                ComentariosSubida = dto.Comentario,
                IpOrigen = httpContext.Connection.RemoteIpAddress?.ToString(),
                TieneDocumentoLigado = dto.TieneDocumentoSoporte ? 1 : 0,
                PDFBinarioAdicional = dto.TieneDocumentoSoporte ? pdfBytesSoporte : null,
                MetadataJSON = metadataJson
            };
            var objParams = DtoTransform.ToParams(parametros);

            var result = await db.ExecuteStoredProcedureQueryableAsync<dynamic>(
                "cnnAsokam", "app.sp_GestionarDocumento", objParams);
            //SELECT @CodigoResultado AS Codigo, @MensajeError AS Mensaje, @IdDocumentoGenerado AS IdDocumento;
            string baseScriptDirectory = configuration["PythonConfig:ScriptPath"] ?? "";
            const string scriptFileName = "pdf_signature_replacer.py";

            string scriptPath = Path.Combine(baseScriptDirectory, scriptFileName);
            string venvPath = configuration["PythonConfig:VenvPathPDF"] ?? "";


            var firstRow = result.FirstOrDefault();
            if (firstRow == null)
                throw new Exception("No se devolvieron resultados del procedimiento almacenado.");

            string idDocumento = Convert.ToString(firstRow.IdDocumento);
            var resultado = PythonRunner.RunScriptFromFile(
                    scriptPath,
                    new { id_pdf = idDocumento, scan_only = 1 },
                    venvPath // Se pasa la ruta del VENV  //el script ya toma 
                );

            if (!string.IsNullOrEmpty(resultado) && resultado.Contains("ERROR_KEYWORD_NOT_FOUND"))
            {
                return ApiResponseFactory.BadRequest<object>(
                    new
                    {
                        IdDocumento = idDocumento,
                        Usuario = dto.Usuario,
                        ErrorCode = "KEYWORD_NOT_FOUND"
                    },
                    0,
                    startTime,
                    new[] { "El documento no contiene la palabra clave requerida para firma" }
                );
            }

            return ApiResponseFactory.Ok(
                new
                {
                    Archivo = dto.Archivo.FileName,
                    Usuario = dto.Usuario,
                    Comentario = dto.Comentario,
                    Tamaño = pdfBytes.Length,
                    Estado = "Pendiente"
                },
                0, startTime, null, "PDF subido correctamente");
        }
        catch (Exception ex)
        {
            return ApiResponseFactory.BadRequest<string>("", 0, startTime, new[] { ex.Message });
        }
    }  


                necesito enviar este dto namespace Core.API.DTOs.Asokam.PdfSignatureApp
{
    public class SubirPdfDto
    {
        public string Nombre { get; set; } = string.Empty;
        public string Usuario { get; set; } = string.Empty;
        public string Comentario { get; set; } = string.Empty;
        // Correos separados por punto y coma. Ej: "to1@mail.com;to2@mail.com"
        public string Correo { get; set; } = string.Empty;
        // Correos CC separados por punto y coma. Puede venir vacío.
        public string CorreoCC { get; set; } = string.Empty;
        public IFormFile? Archivo { get; set; }
        public bool TieneDocumentoSoporte { get; set; } = false; // 0 = Ninguna, 1 = no requiere firma, 2 = no rquiere firma pero se subio otro documento para firmar
        public IFormFile? ArchivoSoporte { get; set; }
    }
}
asi yo lo subia en otro sistema 
                
  // Subir un nuevo documento
  async upload(
    file: File,
    customName: string,
    observations: string
  ): Promise<Document> {
    const user = localStorage.getItem("auth_user") || "sistemas";
    const apiUrl = import.meta.env.VITE_URL_API;

    if (!apiUrl) {
      throw new Error("VITE_URL_API no está configurada en el archivo .env");
    }

    // Crear FormData para el envío multipart/form-data
    const formData = new FormData();
    formData.append("nombre", customName || file.name);
    formData.append("usuario", user);
    formData.append("comentario", observations || "");
    formData.append("archivo", file);

    try {
      // Llamar a la API real
      const response = await fetch(
        `${apiUrl}/asokam/pdf-signature/subir-documento`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Error al subir archivo: ${response.status} - ${errorText}`
        );
      }

      const result = await response.json();

      // Crear objeto Document para retornar
      const newDoc: Document = {
        id:
          result.id ||
          `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: file.name,
        type: file.type || "application/pdf",
        size: file.size,
        uploadedBy: user,
        uploadDate: new Date(),
        status: "pending",
        customName: customName || file.name,
        observations: observations || "",
        fileUrl: result.fileUrl || getRandomMockPDF(),
      };

      // Guardar en localStorage para persistencia local
      const docs = await this.getAll();
      docs.push(newDoc);

      if (typeof window !== "undefined") {
        localStorage.setItem("documents", JSON.stringify(docs));
      }

      return newDoc;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  },

  // Actualizar el estado de un documento
  async updateStatus(id: string, status: DocumentStatus): Promise<void> {
    await delay(API_DELAY);

    const docs = await this.getAll();
    const doc = docs.find((d) => d.id === id);

    if (doc) {
      doc.status = status;

      if (typeof window !== "undefined") {
        localStorage.setItem("documents", JSON.stringify(docs));
      }
    }
  },

                const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (files.length === 0) {
      alert("Por favor selecciona al menos un archivo");
      return;
    }

    setUploading(true);

    try {
      const fullUser = auth.getFullUser();
      const apiUrl = import.meta.env.VITE_URL_API;
      if (!apiUrl) {
        throw new Error("VITE_URL_API no está configurada");
      }

      const filesWithKeywordError: string[] = [];
      const filesWithOtherErrors: Array<{name: string, error: string}> = [];
      let successCount = 0;

      // Subir cada archivo a la API
      for (const fileWithMeta of files) {
        try {
          const formData = new FormData();
          formData.append(
            "nombre",
            fileWithMeta.customName || fileWithMeta.file.name
          );
          const userIdentifier =
            auth.getUserWithDomain() || fullUser?.usuario || "anonimo";

          formData.append("usuario", userIdentifier);
          formData.append("comentario", fileWithMeta.observations || "");
          formData.append("archivo", fileWithMeta.file);

          // Agregar correo del usuario autenticado (campo principal)
          const userEmail = useAuthStore.getState().user?.correo || "";
          if (userEmail) {
            formData.append("correo", userEmail);
          }

          // Agregar correos en copia (CC) si existen
          if (fileWithMeta.correoCC) {
            formData.append("correoCC", fileWithMeta.correoCC);
          }

          // Agregar documento de soporte si existe
          formData.append("tieneDocumentoSoporte", fileWithMeta.tieneDocumentoSoporte.toString());
          if (fileWithMeta.tieneDocumentoSoporte && fileWithMeta.archivoSoporte) {
            formData.append("archivoSoporte", fileWithMeta.archivoSoporte);
          }

          const response = await fetch(
            `${apiUrl}/asokam/pdf-signature/subir-documento`,
            {
              method: "POST",
              headers: {
                accept: "application/json",
              },
              body: formData,
            }
          );

          if (!response.ok) {
            // Intentar parsear como JSON siempre, independientemente del content-type
            let errorData;
            try {
              const responseText = await response.text();
              console.log("Response error text:", responseText); // Debug

              // Intentar parsear como JSON
              try {
                errorData = JSON.parse(responseText);
                console.log("Parsed error data:", errorData); // Debug
              } catch {
                // No es JSON válido, usar el texto como mensaje de error
                throw new Error(
                  `Error al subir archivo: ${response.status}${responseText ? ` - ${responseText}` : ""}`
                );
              }

              // Verificar si es error de palabra clave no encontrada
              // Buscar ErrorCode en diferentes ubicaciones posibles
              const errorCode =
                errorData?.data?.ErrorCode ||
                errorData?.data?.errorCode ||
                errorData?.ErrorCode ||
                errorData?.errorCode;

              // También buscar por el mensaje de error en el array de errores
              const errorMessages =
                errorData?.status?.errors || errorData?.errors || [];
              const hasKeywordError = errorMessages.some(
                (msg: string) => msg && msg.includes("palabra clave requerida")
              );

              console.log("Error code found:", errorCode); // Debug
              console.log("Error messages:", errorMessages); // Debug
              console.log("Has keyword error:", hasKeywordError); // Debug

              if (errorCode === "KEYWORD_NOT_FOUND" || hasKeywordError) {
                console.log("KEYWORD_NOT_FOUND error detected"); // Debug
                filesWithKeywordError.push(
                  fileWithMeta.customName || fileWithMeta.file.name
                );
                // Continuar con el siguiente archivo
                continue;
              }

              // Otro tipo de error
              const errorMsg = errorData?.messages?.[0] ||
                errorData?.message ||
                `Error al subir archivo: ${response.status}`;
              filesWithOtherErrors.push({
                name: fileWithMeta.customName || fileWithMeta.file.name,
                error: errorMsg
              });
              // Continuar con el siguiente archivo
              continue;
            } catch (error) {
              // Si no pudimos manejar el error específicamente, agregarlo a la lista
              filesWithOtherErrors.push({
                name: fileWithMeta.customName || fileWithMeta.file.name,
                error: error instanceof Error ? error.message : "Error desconocido"
              });
              // Continuar con el siguiente archivo
              continue;
            }
          }

          // Archivo subido exitosamente
          successCount++;

          // Obtener el ID del documento de la respuesta
          try {
            const result = await response.json();
            const documentId = result?.data?.Id || result?.data?.id;

            // Enviar notificación por email si hay correos CC y se obtuvo el ID del documento
            if (documentId && fileWithMeta.correoCC) {
              console.log(`Enviando notificación para documento ${documentId} con CC: ${fileWithMeta.correoCC}`);
              sendEmailNotificationInBackground(documentId, true);
            }
          } catch (error) {
            // Si no se puede obtener el ID, solo registrar el error sin afectar el flujo
            console.error("Error al obtener ID del documento para notificación:", error);
          }
        } catch (error) {
          console.error(`Error uploading file ${fileWithMeta.file.name}:`, error);
          filesWithOtherErrors.push({
            name: fileWithMeta.customName || fileWithMeta.file.name,
            error: error instanceof Error ? error.message : "Error desconocido"
          });
        }
      }

      // Recargar documentos
      await loadDocuments();

      // Limpiar archivos seleccionados
      setFiles([]);

      // Limpiar el input de archivos
      const fileInput = document.getElementById("files") as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }

      // Mostrar resultados
      if (filesWithKeywordError.length > 0) {
        setKeywordErrorFiles(filesWithKeywordError);
        setShowKeywordErrorDialog(true);
      }

      if (filesWithOtherErrors.length > 0) {
        const errorList = filesWithOtherErrors.map(f => `- ${f.name}: ${f.error}`).join('\n');
        setErrorMessage(`Los siguientes archivos tuvieron errores:\n\n${errorList}`);
        setShowErrorDialog(true);
      }

      if (successCount > 0) {
        alert(`${successCount} archivo(s) subido(s) exitosamente`);
      }

      if (successCount === 0 && filesWithKeywordError.length === 0 && filesWithOtherErrors.length === 0) {
        throw new Error("No se pudo subir ningún archivo");
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Error al subir los archivos"
      );
      setShowErrorDialog(true);
    } finally {
      setUploading(false);
    }
  };

                 * 
                 */



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
                        IdUsuario: request.IdUsuario,
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
