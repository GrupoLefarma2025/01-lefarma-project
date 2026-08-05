using ErrorOr;
using Lefarma.API.Domain.Entities.Archivos;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Config.Workflows;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.Profile;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using System.Data;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal;

public class SolicitudPersonalFirmasService : BaseService, ISolicitudPersonalFirmasService
{
    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly ISolicitudPersonalRepository _solicitudRepo;
    private readonly ITipoSolicitudRepository _tipoRepository;
    private readonly IWorkflowEngine _engine;
    private readonly IWorkflowRepository _workflowRepo;
    private readonly IWorkflowQueryService _queryService;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IJefeInmediatoResolver _jefeInmediatoResolver;
    private readonly IProfileService _profileService;
    protected override string EntityName => "SolicitudPersonalFirma";

    public SolicitudPersonalFirmasService(
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        ISolicitudPersonalRepository solicitudRepo,
        ITipoSolicitudRepository tipoRepository,
        IWorkflowEngine engine,
        IWorkflowRepository workflowRepo,
        IWorkflowQueryService queryService,
        IServiceScopeFactory scopeFactory,
        IJefeInmediatoResolver jefeInmediatoResolver,
        IProfileService profileService,
        IWideEventAccessor wideEventAccessor) : base(wideEventAccessor)
    {
        _context = context;
        _asokamContext = asokamContext;
        _solicitudRepo = solicitudRepo;
        _tipoRepository = tipoRepository;
        _engine = engine;
        _workflowRepo = workflowRepo;
        _queryService = queryService;
        _scopeFactory = scopeFactory;
        _jefeInmediatoResolver = jefeInmediatoResolver;
        _profileService = profileService;
    }

    public async Task<ErrorOr<FirmarResponse>> FirmarAsync(int idSolicitud, FirmarRequest request, int idUsuario)
    {
        IDbContextTransaction? transaction = null;
        try
        {
            // 0. Validar que el usuario tenga firma digital registrada
            var firmaValidacion = await ValidarFirmaUsuarioAsync(idUsuario);
            if (firmaValidacion.IsError)
                return firmaValidacion.Errors;

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

            // Guardar estado anterior
            var estadoAnterior = solicitud.Estado?.Codigo;

            // Solo iniciar una transacción si no hay una activa (p.ej. cuando FirmarAsync es llamada desde EnviarDirectorAsync)
            transaction = _context.Database.CurrentTransaction == null
                ? await _context.Database.BeginTransactionAsync()
                : null;

            // 3. Cargar workflow config
            var workflowConfig = await _workflowRepo.GetQueryable()
                .Include(w => w.Pasos)
                    .ThenInclude(p => p.AccionesOrigen)
                        .ThenInclude(a => a.TipoAccion)
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

            // 4. Validar participante (el creador puede ejecutar CANCELAR aunque no sea participante)
            var accionSolicitada = pasoActual.AccionesOrigen
                .FirstOrDefault(a => a.IdAccion == request.IdAccion && a.Activo);
            var codigoAccionSolicitada = accionSolicitada?.TipoAccion?.Codigo;

                var validacion = await WorkflowFirmaHelper.ValidarParticipanteAsync(
                    pasoActual, solicitud.IdWorkflow, idUsuario, solicitud.IdUsuarioCreador, _asokamContext, _jefeInmediatoResolver,
                    codigoAccion: codigoAccionSolicitada,
                    idUsuarioSolicitante: solicitud.IdUsuarioSolicitante ?? solicitud.IdUsuarioCreador);
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

            // 7. Lógica específica de vacaciones: al cerrar solicitud tipo vacaciones, consumir saldo
            var nuevoEstado = await _context.WorkflowEstados.FindAsync(solicitud.IdEstado);
            if (nuevoEstado?.Codigo == WorkflowEstadoCodigo.CERRADA)
            {
                var vacacionProcesada = await ProcesarVacacionesAprobadasAsync(solicitud);
                if (vacacionProcesada.IsError)
                {
                    if (transaction != null) await transaction.RollbackAsync();
                    return vacacionProcesada.Errors;
                }
            }

            if (transaction != null) await transaction.CommitAsync();

            // 8. Resolver notificación
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
                contenidoAdicionalHtml: null,
                idUsuarioSolicitante: solicitud.IdUsuarioSolicitante ?? solicitud.IdUsuarioCreador);

            EnrichWideEvent("Firmar", entityId: idSolicitud, nombre: solicitud.Folio,
                additionalContext: new Dictionary<string, object>
                {
                    ["estadoAnterior"] = estadoAnterior,
                    ["nuevoEstado"] = nuevoEstado?.Codigo,
                    ["idAccion"] = request.IdAccion
                });

            return new FirmarResponse
            {
                Exitoso = true,
                Folio = solicitud.Folio,
                EstadoAnterior = estadoAnterior,
                NuevoEstado = nuevoEstado?.Codigo,
                Mensaje = $"Acción ejecutada exitosamente. Estado: {nuevoEstado?.Codigo}"
            };
        }
        catch (Exception ex)
        {
            if (transaction != null) await transaction.RollbackAsync();
            EnrichWideEvent("Firmar", entityId: idSolicitud, exception: ex);
            return CommonErrors.InternalServerError("Error inesperado al procesar la firma.");
        }
        finally
        {
            if (transaction != null) await transaction.DisposeAsync();
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

    private async Task<ErrorOr<Success>> ValidarFirmaUsuarioAsync(int idUsuario)
    {
        var tieneFirma = await _profileService.HasFirmaAsync(idUsuario);
        if (tieneFirma.IsError)
            return tieneFirma.Errors;

        if (!tieneFirma.Value)
            return CommonErrors.Validation("Firma", "El usuario no tiene una firma digital registrada. Cárguela en Configuración > Perfil para continuar.");

        return Result.Success;
    }

    private async Task<Dictionary<string, string>> ConstruirVariablesNotificacionAsync(SolicitudPersonal solicitud)
    {
        var tipo = await _tipoRepository.GetByIdAsync(solicitud.IdTipoSolicitud);
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

    private async Task<ErrorOr<bool>> ProcesarVacacionesAprobadasAsync(SolicitudPersonal solicitud)
    {
        try
        {
            var tipo = await _tipoRepository.GetByIdAsync(solicitud.IdTipoSolicitud);
            if (tipo is null || !string.Equals(tipo.Clave, "vacaciones", StringComparison.OrdinalIgnoreCase))
                return true;

            if (!solicitud.FechaInicio.HasValue || !solicitud.FechaFin.HasValue)
                return CommonErrors.Validation("fecha", "La solicitud de vacaciones no tiene fechas definidas.");

            if (solicitud.FechaInicio.Value > solicitud.FechaFin.Value)
                return CommonErrors.Validation("fecha", "La fecha de inicio no puede ser mayor que la fecha de fin.");

            var tipoVacacion = await _context.TiposDia
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Activo && t.Clave == "VACACION");

            if (tipoVacacion is null)
                return CommonErrors.NotFound("TipoDia", "VACACION");

            var idUsuarioSolicitante = solicitud.IdUsuarioSolicitante ?? solicitud.IdUsuarioCreador;

            var anio = solicitud.FechaInicio.Value.Year;
            var saldo = await _context.SaldosVacacionesAnuales
                .FirstOrDefaultAsync(s => s.IdUsuario == idUsuarioSolicitante && s.Anio == anio && s.Activo);

            if (saldo is null)
                return CommonErrors.NotFound("SaldoVacacionesAnual", $"usuario {idUsuarioSolicitante} / año {anio}");

            var fechas = Enumerable
                .Range(0, (solicitud.FechaFin.Value - solicitud.FechaInicio.Value).Days + 1)
                .Select(d => solicitud.FechaInicio.Value.AddDays(d))
                .ToList();

            var diasSolicitados = fechas.Count;

            if (saldo.DiasPendientes < diasSolicitados)
                return CommonErrors.Validation("saldo", $"Saldo insuficiente. Disponible: {saldo.DiasPendientes}, Solicitado: {diasSolicitados}");

            var diasUsuario = new List<DiaUsuario>();

            foreach (var fecha in fechas)
            {
                var alreadyExists = await _context.DiasUsuarios
                    .AsNoTracking()
                    .AnyAsync(d => d.IdUsuario == idUsuarioSolicitante && d.Fecha == fecha && d.Activo);

                if (alreadyExists)
                    continue;

                diasUsuario.Add(new DiaUsuario
                {
                    IdUsuario = idUsuarioSolicitante,
                    IdEmpresa = solicitud.IdEmpresa,
                    IdSucursal = solicitud.IdSucursal == 0 ? null : solicitud.IdSucursal,
                    Anio = fecha.Year,
                    Mes = fecha.Month,
                    Dia = fecha.Day,
                    Fecha = fecha,
                    IdTipoDia = tipoVacacion.IdTipoDia,
                    Origen = "SOLICITUD",
                    ConsumeSaldo = true,
                    Estado = null,
                    Comentarios = solicitud.Motivo
                });
            }

            saldo.DiasTomados += diasUsuario.Count;
            if (diasUsuario.Count > 0)
                await _context.DiasUsuarios.AddRangeAsync(diasUsuario);

            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            EnrichWideEvent("ProcesarVacacionesAprobadas", exception: ex);
            return CommonErrors.InternalServerError("Error al procesar vacaciones aprobadas.");
        }
    }

    //Tablas que se usan EnvioSolicitud, DocumentoInterfaseSolicitud
    /*DROP TABLE rh.envios_solicitudes
        DROP TABLE rh.envios_solicitudes

        CREATE TABLE rh.envios_solicitudes
        (
            id_envio INT IDENTITY(1,1) PRIMARY KEY,
            id_solicitud            INT NOT NULL,
            id_usuario_envio INT NOT NULL,
            estado                  VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
            token_seguridad NVARCHAR(100) NOT NULL UNIQUE,
            id_tipo_solicitud INT NULL,
            id_usuario_solicitante INT NULL,
            fecha_envio DATETIME NOT NULL DEFAULT GETDATE(),
            fecha_respuesta DATETIME NULL,
            id_usuario_respuesta INT NULL,
            comentario_respuesta NVARCHAR(500) NULL,
            fecha_creacion DATETIME DEFAULT GETDATE(),
            fecha_modificacion DATETIME DEFAULT GETDATE(),
            activo BIT NOT NULL DEFAULT 1
            CONSTRAINT FK_spe_solicitud FOREIGN KEY(id_solicitud) REFERENCES rh.solicitudes_personal(id_solicitud)
        );

        CREATE INDEX IX_spe_solicitud ON rh.envios_solicitudes(id_solicitud);

            CREATE TABLE app.DocumentosInterfaseSolicitud
        (
            id_documento_firmar UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
            id_envio INT NOT NULL,
            --CONSTRAINT FK_dis_documento FOREIGN KEY(id_documento_firmar) REFERENCES app.Documentos(Id)
        );*/
    public async Task<ErrorOr<EnviarDirectorResponse>> EnviarDirectorAsync(
    int idSolicitud, EnviarDirectorRequest request, int idUsuario)
    {
        try
        {
            // Validar firma del usuario
            var firmaValidacion = await ValidarFirmaUsuarioAsync(idUsuario);
            if (firmaValidacion.IsError)
                return firmaValidacion.Errors;

            //Validar que venga PDF
            if (request.ArchivoPdf == null || request.ArchivoPdf.Length == 0)
                return CommonErrors.Validation("ArchivoPdf", "El PDF de la solicitud es obligatorio.");

            var extension = Path.GetExtension(request.ArchivoPdf.FileName).ToLowerInvariant();
            if (extension != ".pdf")
                return CommonErrors.Validation("ArchivoPdf", "Solo se permiten archivos PDF.");

            //Cargar solicitud
            var solicitud = await _solicitudRepo.GetByIdAsync(idSolicitud);
            if (solicitud is null)
                return CommonErrors.NotFound("SolicitudPersonal", idSolicitud.ToString());

            //Validar que la acción sea ENVIAR_DIRECTOR y esté disponible
            var acciones = await GetAccionesDisponiblesAsync(idSolicitud, idUsuario);
            if (acciones.IsError)
                return acciones.Errors;

            var accionEnviarDirector = acciones.Value
                .FirstOrDefault(a => a.IdAccion == request.IdAccion &&
                                     a.TipoAccionCodigo == "ENVIAR_DIRECTOR");

            if (accionEnviarDirector == null)
                return CommonErrors.Validation("Accion", "La acción no está disponible o no es ENVIAR_DIRECTOR.");

            // primero firmar, luego enviar
            await using var transaction = await _context.Database.BeginTransactionAsync();

            // Ejecutar la firma con la acción ENVIAR_DIRECTOR
            var firmaResult = await FirmarAsync(idSolicitud, new FirmarRequest
            {
                IdAccion = request.IdAccion,
                Comentario = request.Comentario
            }, idUsuario);

            if (firmaResult.IsError)
            {
                await transaction.RollbackAsync();
                return firmaResult.Errors;
            }

            //obtener solicitud para obtener el estado actualizado
            solicitud = await _solicitudRepo.GetByIdAsync(idSolicitud);
            if (solicitud == null)
            {
                await transaction.RollbackAsync();
                return CommonErrors.NotFound("SolicitudPersonal", idSolicitud.ToString());
            }

            // Generar token y crear el envío externo
            var token = Guid.NewGuid().ToString("N");

            var envio = new EnvioSolicitud
            {
                IdSolicitud = idSolicitud,
                IdUsuarioEnvio = idUsuario,
                IdUsuarioSolicitante = solicitud.IdUsuarioSolicitante ?? solicitud.IdUsuarioCreador,
                IdTipoSolicitud = solicitud.IdTipoSolicitud,
                Estado = "PENDIENTE",
                TokenSeguridad = token,
                FechaEnvio = DateTime.Now,
                FechaCreacion = DateTime.Now,
                FechaModificacion = DateTime.Now,
                Activo = true
            };

            _context.EnviosSolicitudes.Add(envio);
            await _context.SaveChangesAsync();

            //leer el pdf y guardarlo en Asokam.app.Documentos
            byte[] pdfBytes;
            await using (var ms = new MemoryStream())
            {
                await request.ArchivoPdf.CopyToAsync(ms);
                pdfBytes = ms.ToArray();
            }

            var documento = new Domain.Entities.Asokam.Documento
            {
                Id = Guid.NewGuid(),
                NombreArchivo = $"{solicitud.Folio}.pdf",
                MimeType = "application/pdf",
                TamanoBytes = pdfBytes.Length,
                PDFBinario = pdfBytes,
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
                MetadataJSON = System.Text.Json.JsonSerializer.Serialize(new Dictionary<string, string>
                {
                    ["to"] = "41@grupolefarma.com.mx",
                    ["cc"] = ""
                }),
                TieneDocumentoLigado = false,
                PDFBinarioAdicional = null
            };

            // QUITAR COMENTARIO PARA INSERTAR DOCUMENTO EN ASOKAM
            //_asokamContext.Documentos.Add(documento);

            //Guardar el registro en Asokam.app.DocumentosInterfaseSolicitud
            var interfase = new Domain.Entities.Asokam.DocumentoInterfaseSolicitud
            {
                IdDocumentoFirmar = documento.Id,
                IdEnvio = envio.IdEnvio
            };

            _asokamContext.DocumentosInterfaseSolicitud.Add(interfase);
            await _asokamContext.SaveChangesAsync();

            await transaction.CommitAsync();

            EnrichWideEvent("EnviarDirector", entityId: idSolicitud, nombre: solicitud.Folio,
                additionalContext: new Dictionary<string, object>
                {
                    ["idEnvio"] = envio.IdEnvio,
                    ["idDocumento"] = Guid.NewGuid(),// documento.Id,
                });

            return new EnviarDirectorResponse
            {
                IdEnvio = envio.IdEnvio,
                TokenSeguridad = token,
                Estado = envio.Estado,
                Folio = solicitud.Folio
            };
        }
        catch (Exception ex)
        {
            EnrichWideEvent("EnviarDirector", entityId: idSolicitud, exception: ex);
            return CommonErrors.InternalServerError("Error inesperado al enviar la solicitud al director.");
        }
    }

    public async Task<ErrorOr<RespuestaSolicitudPersonalExternaResponse>> ProcesarRespuestaAsync(
    RespuestaSolicitudPersonalExternaRequest request)
    {
        try
        {
            //Buscar envío por Id + Token
            var envio = await _context.EnviosSolicitudes
                .FirstOrDefaultAsync(e => e.IdEnvio == request.IdEnvio
                                       && e.TokenSeguridad == request.TokenSeguridad);

            if (envio is null)
                return CommonErrors.NotFound("EnvioSolicitud", $"ID: {request.IdEnvio}");

            //validar que el envío esté pendiente
            if (envio.Estado != "PENDIENTE")
                return CommonErrors.Conflict("EnvioSolicitud", $"El envío ya fue {envio.Estado}.");

            var solicitud = await _solicitudRepo.GetByIdAsync(envio.IdSolicitud);
            if (solicitud is null)
                return CommonErrors.NotFound("SolicitudPersonal", envio.IdSolicitud.ToString());

            // validar que la acción sea AUTORIZAR o DEVOLVER
            var accionExterna = request.Accion.Trim().ToUpperInvariant();
            var esAutorizar = accionExterna == "AUTORIZAR";
            var esDevolver = accionExterna == "DEVOLVER";

            if (!esAutorizar && !esDevolver)
                return CommonErrors.Validation("Accion", "La acción debe ser AUTORIZAR o DEVOLVER.");

            // Resolver acción interna del paso actual
            var acciones = await _queryService.GetAccionesDisponiblesAsync(
                idWorkflow: solicitud.IdWorkflow,
                idEntidad: solicitud.IdSolicitud,
                idPasoActual: solicitud.IdPasoActual!.Value,
                idUsuario: request.IdUsuario,
                tipoEntidad: CodigoProceso.SOLICITUD_PERSONAL,
                entidadParaHandlers: solicitud);

            if (acciones.IsError)
                return acciones.Errors;

            var codigoAccionInterna = esAutorizar ? "CERRAR" : "DEVOLVER";
            var accionInterna = acciones.Value
                .FirstOrDefault(a => a.TipoAccionCodigo == codigoAccionInterna);

            if (accionInterna == null)
                return CommonErrors.Validation("Accion", $"No hay acción {codigoAccionInterna} disponible en el paso actual.");

            //ejecutar firma con la acción interna correspondiente
            var firmaResult = await FirmarAsync(envio.IdSolicitud, new FirmarRequest
            {
                IdAccion = accionInterna.IdAccion,
                Comentario = request.Comentario
            }, request.IdUsuario);

            if (firmaResult.IsError)
                return firmaResult.Errors;

            //actualizar estado del envío
            envio.Estado = esAutorizar ? "APROBADO" : "DEVUELTO";
            envio.FechaRespuesta = DateTime.Now;
            envio.IdUsuarioRespuesta = request.IdUsuario;
            envio.ComentarioRespuesta = request.Comentario;
            envio.FechaModificacion = DateTime.Now;

            await _context.SaveChangesAsync();

            EnrichWideEvent("ProcesarRespuestaSolicitudExterna", entityId: envio.IdSolicitud,
                additionalContext: new Dictionary<string, object>
                {
                    ["idEnvio"] = envio.IdEnvio,
                    ["accion"] = request.Accion,
                    ["nuevoEstado"] = envio.Estado
                });

            return new RespuestaSolicitudPersonalExternaResponse
            {
                IdEnvio = envio.IdEnvio,
                NuevoEstado = envio.Estado,
                Folio = firmaResult.Value.Folio
            };
        }
        catch (Exception ex)
        {
            EnrichWideEvent("ProcesarRespuestaSolicitudExterna", exception: ex);
            return CommonErrors.InternalServerError("Error inesperado al procesar la respuesta externa.");
        }
    }
}