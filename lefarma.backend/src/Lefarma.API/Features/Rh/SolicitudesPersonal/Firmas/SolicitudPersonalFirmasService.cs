using ErrorOr;
using Lefarma.API.Domain.Entities.Archivos;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Config.Workflows;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.Profile;
using Lefarma.API.Features.Rh.Vacaciones;
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
    private readonly IEmpleadoRepository _empleadoRepository;
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
        IEmpleadoRepository empleadoRepository,
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
        _empleadoRepository = empleadoRepository;
    }

    public async Task<ErrorOr<FirmarResponse>> FirmarAsync(int idSolicitud, FirmarRequest request, int idUsuario)
    {
        IDbContextTransaction? transaction = null;
        try
        {
            var firmaValidacion = await ValidarFirmaUsuarioAsync(idUsuario);
            if (firmaValidacion.IsError)
                return firmaValidacion.Errors;

            var solicitud = await _solicitudRepo.GetByIdAsync(idSolicitud);
            if (solicitud is null)
            {
                EnrichWideEvent("Firmar", entityId: idSolicitud, notFound: true);
                return CommonErrors.NotFound("SolicitudPersonal", idSolicitud.ToString());
            }

            if (solicitud.Estado?.Codigo is "CERRADA" or "CANCELADA" or "RECHAZADA")
                return CommonErrors.Conflict("SolicitudPersonal",
                    $"La solicitud {solicitud.Folio} ya está en estado terminal.");

            var estadoAnterior = solicitud.Estado?.Codigo;

            transaction = _context.Database.CurrentTransaction == null
                ? await _context.Database.BeginTransactionAsync()
                : null;

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

            var pasoActual = workflowConfig.Pasos.FirstOrDefault(p => p.IdPaso == solicitud.IdPasoActual);
            if (pasoActual is null || !pasoActual.Activo)
                return CommonErrors.Conflict("solicitud", "La solicitud no tiene un paso activo válido.");

            var accionSolicitada = pasoActual.AccionesOrigen
                .FirstOrDefault(a => a.IdAccion == request.IdAccion && a.Activo);
            var codigoAccionSolicitada = accionSolicitada?.TipoAccion?.Codigo;

            if (codigoAccionSolicitada == "CERRAR")
            {
                var enComprobacion = await _profileService.TieneFirmaEnComprobacionAsync(idUsuario);
                if (enComprobacion.IsError)
                    return enComprobacion.Errors;

                if (enComprobacion.Value)
                    return CommonErrors.Validation("Firma.EnComprobacion",
                        "Tu firma digital está en comprobación por Recursos Humanos. No puedes cerrar solicitudes hasta que sea resuelta.");
            }

                var validacion = await WorkflowFirmaHelper.ValidarParticipanteAsync(
                    pasoActual, solicitud.IdWorkflow, idUsuario, solicitud.IdUsuarioCreador, _asokamContext, _jefeInmediatoResolver,
                    codigoAccion: codigoAccionSolicitada,
                    idUsuarioSolicitante: solicitud.IdUsuarioSolicitante ?? solicitud.IdUsuarioCreador);
                if (validacion.IsError)
                return validacion.Errors;

            var esAccionNegativa = codigoAccionSolicitada is "RECHAZAR" or "DEVOLVER" or "CANCELAR";
            if (!esAccionNegativa && pasoActual.RequiereAdjunto)
            {
                var tieneAdjunto = await _context.Archivos
                    .AsNoTracking()
                    .AnyAsync(a => a.EntidadTipo == "SolicitudPersonal"
                        && a.EntidadId == solicitud.IdSolicitud
                        && a.Activo);

                if (!tieneAdjunto)
                    return CommonErrors.Validation("Adjunto", "Debes adjuntar al menos un documento de soporte para esta acción.");
            }

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

            solicitud.IdPasoActual = resultado.NuevoIdPaso;
            if (resultado.NuevoIdEstado.HasValue)
                solicitud.IdEstado = resultado.NuevoIdEstado.Value;
            _context.Entry(solicitud).Property(x => x.IdEstado).IsModified = true;

            var accion = workflowConfig.Pasos
                .SelectMany(p => p.AccionesOrigen)
                .FirstOrDefault(a => a.IdAccion == request.IdAccion);
            if (accion?.TipoAccion?.Codigo == "ENVIAR" && !solicitud.FechaEnvio.HasValue)
                solicitud.FechaEnvio = DateTime.Now;

            solicitud.FechaModificacion = DateTime.Now;

            var nuevoEstado = await _context.WorkflowEstados.FindAsync(solicitud.IdEstado);

            await _context.SaveChangesAsync();

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

            var notificacion = WorkflowFirmaHelper.ResolverNotificacion(
                workflowConfig, request.IdAccion, resultado.NuevoIdPaso);

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

            var idUsuarioSolicitante = solicitud.IdUsuarioSolicitante ?? solicitud.IdUsuarioCreador;

            var fechasDetalle = await _context.SolicitudesPersonalDetalle
                .AsNoTracking()
                .Where(d => d.IdSolicitud == solicitud.IdSolicitud)
                .Select(d => d.Fecha)
                .ToListAsync();

            var fechasConsumo = fechasDetalle.Count > 0
                ? await SolicitudPersonalService.ObtenerFechasQueConsumenSaldoAsync(
                    _context, solicitud.IdEmpresa, fechasDetalle)
                : await SolicitudPersonalService.ObtenerFechasQueConsumenSaldoAsync(
                    _context, solicitud.IdEmpresa, solicitud.FechaInicio.Value, solicitud.FechaFin.Value);

            var pendiente = (decimal)fechasConsumo.Count;
            if (pendiente == 0)
                return true;

            var empleado = await _empleadoRepository.ObtenerEmpleadoPorUsuarioAsync(idUsuarioSolicitante);
            var fechaIngreso = empleado?.Fechaingreso ?? solicitud.FechaInicio.Value;

            var periodos = await _context.SaldosVacacionesPeriodos
                .Where(s => s.IdUsuario == idUsuarioSolicitante && s.Activo)
                .OrderBy(s => s.FechaInicioPeriodo)
                .ToListAsync();

            var tieneArrastre = periodos.Any(p => p.DiasAjustadosArrastre > 0);
            var arrastres = new List<SaldoVacacionesArrastre>();

            if (tieneArrastre)
            {
                arrastres = await _context.SaldosVacacionesArrastres
                    .Where(a => a.IdUsuario == idUsuarioSolicitante && a.Activo && a.DiasTotal > 0)
                    .OrderBy(a => a.FechaCorte)
                    .ThenBy(a => a.IdArrastre)
                    .ToListAsync();
            }

            foreach (var arrastre in arrastres)
            {
                if (pendiente <= 0) break;

                var restante = arrastre.DiasTotal - arrastre.DiasAplicados;
                if (restante <= 0) continue;

                var aplicar = Math.Min(restante, pendiente);
                arrastre.DiasAplicados += aplicar;
                arrastre.FechaModificacion = DateTime.Now;
                pendiente -= aplicar;
            }

            foreach (var periodo in periodos)
            {
                if (pendiente <= 0) break;
                if (periodo.FechaLimiteDisfrute < DateTime.Today) continue;

                var disponible = periodo.DiasGenerados + periodo.DiasCompensados + periodo.DiasAjustados
                    - periodo.DiasVencidos - periodo.DiasTomados;

                if (disponible <= 0) continue;

                var aplicar = Math.Min(disponible, pendiente);
                periodo.DiasTomados += aplicar;
                pendiente -= aplicar;
            }

            SaldoVacacionesPeriodo? periodoUsado = null;

            if (pendiente > 0)
            {
                var (inicio, fin, limite, numero) = VacacionesPeriodoHelper.CalcularPeriodo(fechaIngreso, solicitud.FechaFin.Value);

                periodoUsado = await _context.SaldosVacacionesPeriodos
                    .FirstOrDefaultAsync(s => s.IdUsuario == idUsuarioSolicitante && s.FechaInicioPeriodo == inicio && s.Activo);

                if (periodoUsado is null)
                {
                    periodoUsado = new SaldoVacacionesPeriodo
                    {
                        IdUsuario = idUsuarioSolicitante,
                        IdEmpresa = solicitud.IdEmpresa,
                        FechaInicioPeriodo = inicio,
                        FechaFinPeriodo = fin,
                        FechaLimiteDisfrute = limite,
                        NumeroPeriodo = numero,
                        DiasGenerados = VacacionesPeriodoHelper.CalcularDiasGenerados(numero),
                        Activo = true,
                        FechaCreacion = DateTime.Now
                    };
                    _context.SaldosVacacionesPeriodos.Add(periodoUsado);
                    periodos.Add(periodoUsado);
                }

                periodoUsado.DiasTomados += pendiente;
            }

            var restanteArrastre = arrastres.Sum(a => a.DiasTotal - a.DiasAplicados);

            var periodoEspejo = periodos.FirstOrDefault(p => p.FechaInicioPeriodo <= DateTime.Today && p.FechaFinPeriodo >= DateTime.Today)
                ?? periodoUsado
                ?? periodos.OrderByDescending(p => p.FechaInicioPeriodo).FirstOrDefault();

            if (periodoEspejo is not null)
            {
                periodoEspejo.DiasAjustadosArrastre = restanteArrastre;
                periodoEspejo.FechaModificacion = DateTime.Now;
            }

            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            EnrichWideEvent("ProcesarVacacionesAprobadas", exception: ex);
            return CommonErrors.InternalServerError("Error al procesar vacaciones aprobadas.");
        }
    }

    public async Task<ErrorOr<EnviarDirectorResponse>> EnviarDirectorAsync(
    int idSolicitud, EnviarDirectorRequest request, int idUsuario)
    {
        try
        {
            var firmaValidacion = await ValidarFirmaUsuarioAsync(idUsuario);
            if (firmaValidacion.IsError)
                return firmaValidacion.Errors;

            if (request.ArchivoPdf == null || request.ArchivoPdf.Length == 0)
                return CommonErrors.Validation("ArchivoPdf", "El PDF de la solicitud es obligatorio.");

            var extension = Path.GetExtension(request.ArchivoPdf.FileName).ToLowerInvariant();
            if (extension != ".pdf")
                return CommonErrors.Validation("ArchivoPdf", "Solo se permiten archivos PDF.");

            if (request.TieneDocumentoSoporte && request.ArchivoSoporte != null)
            {
                var extensionSoporte = Path.GetExtension(request.ArchivoSoporte.FileName).ToLowerInvariant();
                if (extensionSoporte != ".pdf")
                    return CommonErrors.Validation("ArchivoSoporte", "El documento soporte debe ser un PDF.");
            }

            var solicitud = await _solicitudRepo.GetByIdAsync(idSolicitud);
            if (solicitud is null)
                return CommonErrors.NotFound("SolicitudPersonal", idSolicitud.ToString());

            var acciones = await GetAccionesDisponiblesAsync(idSolicitud, idUsuario);
            if (acciones.IsError)
                return acciones.Errors;

            var accionEnviarDirector = acciones.Value
                .FirstOrDefault(a => a.IdAccion == request.IdAccion &&
                                     a.TipoAccionCodigo == "ENVIAR_DIRECTOR");

            if (accionEnviarDirector == null)
                return CommonErrors.Validation("Accion", "La acción no está disponible o no es ENVIAR_DIRECTOR.");

            await using var transaction = await _context.Database.BeginTransactionAsync();

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

            solicitud = await _solicitudRepo.GetByIdAsync(idSolicitud);
            if (solicitud == null)
            {
                await transaction.RollbackAsync();
                return CommonErrors.NotFound("SolicitudPersonal", idSolicitud.ToString());
            }

            var token = Guid.NewGuid().ToString("N");
            var idUsuarioSolicitante = solicitud.IdUsuarioSolicitante ?? solicitud.IdUsuarioCreador;

            var envio = new EnvioSolicitud
            {
                IdSolicitud = idSolicitud,
                IdUsuarioEnvio = idUsuario,
                IdUsuarioSolicitante = idUsuarioSolicitante,
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

            byte[] pdfBytes;
            await using (var ms = new MemoryStream())
            {
                await request.ArchivoPdf.CopyToAsync(ms);
                pdfBytes = ms.ToArray();
            }

            byte[]? soporteBytes = null;
            if (request.TieneDocumentoSoporte && request.ArchivoSoporte != null)
            {
                await using var msSoporte = new MemoryStream();
                await request.ArchivoSoporte.CopyToAsync(msSoporte);
                soporteBytes = msSoporte.ToArray();
            }

            var metadata = new Dictionary<string, string>();
            if (!string.IsNullOrWhiteSpace(request.Correo)) metadata["to"] = request.Correo.Trim();
            if (!string.IsNullOrWhiteSpace(request.CorreoCC)) metadata["cc"] = request.CorreoCC.Trim();

            var usuarioSolicitante = await _asokamContext.Usuarios
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.IdUsuario == idUsuarioSolicitante);

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
                SubidoPorUsuario = usuarioSolicitante is
                    { SamAccountName: { Length: > 0 } sam, Dominio: { Length: > 0 } dominio }
                    ? $"{sam}@{dominio}"
                    : usuarioSolicitante?.Correo ?? idUsuarioSolicitante.ToString(),
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
                MetadataJSON = metadata.Count > 0 ? System.Text.Json.JsonSerializer.Serialize(metadata) : null,
                TieneDocumentoLigado = request.TieneDocumentoSoporte,
                PDFBinarioAdicional = soporteBytes
            };

            _asokamContext.Documentos.Add(documento);

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
                    ["idDocumento"] = documento.Id,
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
            var envio = await _context.EnviosSolicitudes
                .FirstOrDefaultAsync(e => e.IdEnvio == request.IdEnvio
                                       && e.TokenSeguridad == request.TokenSeguridad);

            if (envio is null)
                return CommonErrors.NotFound("EnvioSolicitud", $"ID: {request.IdEnvio}");

            if (envio.Estado != "PENDIENTE")
                return CommonErrors.Conflict("EnvioSolicitud", $"El envío ya fue {envio.Estado}.");

            var solicitud = await _solicitudRepo.GetByIdAsync(envio.IdSolicitud);
            if (solicitud is null)
                return CommonErrors.NotFound("SolicitudPersonal", envio.IdSolicitud.ToString());

            var accionExterna = request.Accion.Trim().ToUpperInvariant();
            var esAutorizar = accionExterna == "AUTORIZAR";
            var esDevolver = accionExterna == "DEVOLVER";

            if (!esAutorizar && !esDevolver)
                return CommonErrors.Validation("Accion", "La acción debe ser AUTORIZAR o DEVOLVER.");

            var acciones = await _queryService.GetAccionesDisponiblesAsync(
                idWorkflow: solicitud.IdWorkflow,
                idEntidad: solicitud.IdSolicitud,
                idPasoActual: solicitud.IdPasoActual!.Value,
                idUsuario: request.IdUsuario,
                tipoEntidad: CodigoProceso.SOLICITUD_PERSONAL,
                entidadParaHandlers: solicitud);

            if (acciones.IsError)
                return acciones.Errors;

            var codigoAccionInterna = esAutorizar ? "AUTORIZAR" : "DEVOLVER";
            var accionInterna = acciones.Value
                .FirstOrDefault(a => a.TipoAccionCodigo == codigoAccionInterna);

            if (accionInterna == null)
                return CommonErrors.Validation("Accion", $"No hay acción {codigoAccionInterna} disponible en el paso actual.");

            var firmaResult = await FirmarAsync(envio.IdSolicitud, new FirmarRequest
            {
                IdAccion = accionInterna.IdAccion,
                Comentario = request.Comentario
            }, request.IdUsuario);

            if (firmaResult.IsError)
                return firmaResult.Errors;

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