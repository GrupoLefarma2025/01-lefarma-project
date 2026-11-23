using ErrorOr;
using Lefarma.API.Domain.Firmas;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Archivos.Settings;
using Lefarma.API.Features.Firmas.DTOs;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Features.OrdenesCompra.Visibilidad;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Infrastructure.Files;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Lefarma.API.Features.Firmas;

public class FirmasService : BaseService, IFirmasService
{
    private readonly AsokamDbContext _asokamContext;
    private readonly ApplicationDbContext _appContext;
    private readonly INotificationService _notificationService;
    private readonly IOptions<ArchivosSettings> _archivosSettings;
    private readonly IFileCipher _cipher;
    private readonly IOrdenCompraVisibilidadService _visibilidadOrdenCompra;
    protected override string EntityName => "Firmas";

    public FirmasService(
        AsokamDbContext asokamContext,
        ApplicationDbContext appContext,
        INotificationService notificationService,
        IOptions<ArchivosSettings> archivosSettings,
        IFileCipher cipher,
        IOrdenCompraVisibilidadService visibilidadOrdenCompra,
        IWideEventAccessor wideEventAccessor)
        : base(wideEventAccessor)
    {
        _asokamContext = asokamContext;
        _appContext = appContext;
        _notificationService = notificationService;
        _archivosSettings = archivosSettings;
        _cipher = cipher;
        _visibilidadOrdenCompra = visibilidadOrdenCompra;
    }

    private string FirmasDir => Path.Combine(_archivosSettings.Value.PrivatePath, "firmas");
    private string IneDir => Path.Combine(_archivosSettings.Value.PrivatePath, "ine");

    private static readonly Regex LogicalNameRegex = new(
        @"^(?<dir>firmas|ine)/(?<file>\d+_\d{14}\.(?:png|jpg|jpeg|pdf))$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex LegacyFirmaRegex = new(
        @"^firmas_usuarios/(?<file>[A-Za-z0-9_-]+\.(?:png|jpg|jpeg))$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private (string Directorio, string Archivo)? SplitLogical(string? logical, string dirEsperada)
    {
        if (string.IsNullOrWhiteSpace(logical))
            return null;
        var m = LogicalNameRegex.Match(logical);
        if (!m.Success || !m.Groups["dir"].Value.Equals(dirEsperada, StringComparison.OrdinalIgnoreCase))
            return null;
        var dir = dirEsperada.Equals("ine", StringComparison.OrdinalIgnoreCase) ? IneDir : FirmasDir;
        return (dir, m.Groups["file"].Value.ToLowerInvariant());
    }

    private static string ContentTypePorExtension(string nombreArchivo) =>
        Path.GetExtension(nombreArchivo).ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".pdf" => "application/pdf",
            _ => "application/octet-stream",
        };

    private static Dictionary<string, object> Ctx(params (string Key, object? Value)[] pairs)
    {
        var dict = new Dictionary<string, object>();
        foreach (var (key, value) in pairs)
            if (value != null)
                dict[key] = value;
        return dict;
    }

    private bool ExisteIne(string? ine)
    {
        var parts = SplitLogical(ine, "ine");
        return parts != null && File.Exists(Path.Combine(parts.Value.Directorio, parts.Value.Archivo + ".enc"));
    }

    private void EliminarFirmaCandidata(string? firmaPendiente)
    {
        var parts = SplitLogical(firmaPendiente, "firmas");
        if (parts != null)
            _cipher.DeleteEncrypted(parts.Value.Directorio, parts.Value.Archivo);
    }

    private void EliminarIne(string? ine)
    {
        var parts = SplitLogical(ine, "ine");
        if (parts != null)
            _cipher.DeleteEncrypted(parts.Value.Directorio, parts.Value.Archivo);
    }

    public async Task<ErrorOr<List<FirmaUsuarioResponse>>> GetUsuariosConFirmaAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var detalles = await _appContext.UsuariosDetalle
                .AsNoTracking()
                .Where(d => (d.FirmaPathCifrada != null && d.FirmaPathCifrada != "")
                    || (d.FirmaControlJson != null && d.FirmaControlJson != ""))
                .ToListAsync(cancellationToken);

            if (detalles.Count == 0)
                return new List<FirmaUsuarioResponse>();

            var controles = detalles.ToDictionary(d => d.IdUsuario, d => FirmaControl.Parse(d.FirmaControlJson));

            var ids = detalles.Select(d => d.IdUsuario).ToList();
            var areaIds = detalles.Where(d => d.IdArea.HasValue).Select(d => d.IdArea!.Value).Distinct().ToList();
            var habilitoIds = controles.Values
                .Select(c => c.UltimaHabilitacion?.IdUsuario)
                .Where(id => id.HasValue && id.Value > 0)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();

            var usuarios = await _asokamContext.Usuarios
                .AsNoTracking()
                .Where(u => ids.Contains(u.IdUsuario))
                .ToListAsync(cancellationToken);

            var areas = await _appContext.Areas
                .AsNoTracking()
                .Where(a => areaIds.Contains(a.IdArea))
                .ToDictionaryAsync(a => a.IdArea, a => a.Nombre, cancellationToken);

            var habilitoNombres = habilitoIds.Count == 0
                ? new Dictionary<int, string?>()
                : await _asokamContext.Usuarios
                    .AsNoTracking()
                    .Where(u => habilitoIds.Contains(u.IdUsuario))
                    .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto, cancellationToken);

            var usuariosPorId = usuarios.ToDictionary(u => u.IdUsuario);

            var response = detalles.Select(d =>
            {
                usuariosPorId.TryGetValue(d.IdUsuario, out var u);
                var area = d.IdArea.HasValue && areas.TryGetValue(d.IdArea.Value, out var a) ? a : null;
                var control = controles[d.IdUsuario];
                var ultimaHabilitacion = control.UltimaHabilitacion;
                var nombreHabilito = ultimaHabilitacion != null && ultimaHabilitacion.IdUsuario > 0
                    && habilitoNombres.TryGetValue(ultimaHabilitacion.IdUsuario, out var n) ? n : null;

                var enComprobacion = control.EnComprobacion;
                var ultimaRemision = enComprobacion ? control.UltimaRemision : null;
                var tieneIne = ultimaRemision?.Ine != null && ExisteIne(ultimaRemision.Ine);

                return new FirmaUsuarioResponse
                {
                    IdUsuario = d.IdUsuario,
                    SamAccountName = u?.SamAccountName,
                    NombreCompleto = u?.NombreCompleto,
                    Correo = u?.Correo,
                    Area = area,
                    FirmaPath = d.FirmaPathCifrada,
                    FirmaSubidas = string.IsNullOrEmpty(d.FirmaPathCifrada) ? 0 : Math.Max(control.Subidas, 1),
                    FirmaCambioHabilitado = control.CambioHabilitado,
                    FirmaCambioSolicitado = control.SolicitudPendiente,
                    FechaSolicitudCambioFirma = control.SolicitudPendiente ? control.UltimaSolicitud?.Fecha : null,
                    EnComprobacion = enComprobacion,
                    FechaRemision = ultimaRemision?.Fecha,
                    TieneIne = tieneIne,
                    FirmaPendientePath = ultimaRemision?.FirmaPendiente,
                    IdUsuarioHabilito = ultimaHabilitacion?.IdUsuario > 0 ? ultimaHabilitacion.IdUsuario : null,
                    NombreUsuarioHabilito = nombreHabilito,
                    FechaHabilitoFirma = ultimaHabilitacion?.Fecha,
                };
            })
            .OrderByDescending(r => r.EnComprobacion)
            .ThenByDescending(r => r.FirmaCambioSolicitado)
            .ThenBy(r => r.NombreCompleto)
            .ToList();

            EnrichWideEvent(action: "GetUsuariosConFirma", count: response.Count);
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetUsuariosConFirma", exception: ex);
            return CommonErrors.DatabaseError("obtener los usuarios con firma");
        }
    }

    public async Task<ErrorOr<List<FirmaHistorialEventoResponse>>> GetHistorialAsync(int idUsuario, CancellationToken cancellationToken = default)
    {
        try
        {
            var detalle = await _appContext.UsuariosDetalle
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.IdUsuario == idUsuario, cancellationToken);

            if (detalle == null)
            {
                EnrichWideEvent(action: "GetHistorialFirma", entityId: idUsuario, notFound: true);
                return CommonErrors.NotFound("Usuario");
            }

            var control = FirmaControl.Parse(detalle.FirmaControlJson);
            if (control.Eventos.Count == 0)
                return new List<FirmaHistorialEventoResponse>();

            var actorIds = control.Eventos.Select(e => e.IdUsuario).Where(id => id > 0).Distinct().ToList();
            var nombres = actorIds.Count == 0
                ? new Dictionary<int, string?>()
                : await _asokamContext.Usuarios
                    .AsNoTracking()
                    .Where(u => actorIds.Contains(u.IdUsuario))
                    .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto, cancellationToken);

            var response = control.Eventos
                .OrderByDescending(e => e.Fecha)
                .Select(e => new FirmaHistorialEventoResponse
                {
                    Accion = e.Accion,
                    Fecha = e.Fecha,
                    IdUsuario = e.IdUsuario,
                    NombreUsuario = e.IdUsuario > 0 && nombres.TryGetValue(e.IdUsuario, out var n) ? n : null,
                    Motivo = e.Motivo
                })
                .ToList();

            EnrichWideEvent(action: "GetHistorialFirma", entityId: idUsuario, count: response.Count);
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetHistorialFirma", entityId: idUsuario, exception: ex);
            return CommonErrors.DatabaseError("obtener el historial de la firma");
        }
    }

    public async Task<ErrorOr<bool>> HabilitarCambioFirmaAsync(int idUsuario, int idUsuarioRh, CancellationToken cancellationToken = default)
    {
        try
        {
            var detalle = await _appContext.UsuariosDetalle
                .FirstOrDefaultAsync(d => d.IdUsuario == idUsuario, cancellationToken);

            if (detalle == null || string.IsNullOrEmpty(detalle.FirmaPathCifrada))
            {
                EnrichWideEvent(action: "HabilitarCambioFirma", entityId: idUsuario, notFound: true);
                return CommonErrors.NotFound("Firma");
            }

            var control = FirmaControl.Parse(detalle.FirmaControlJson);
            if (control.CambioHabilitado)
                return CommonErrors.Validation("Firma.CambioYaHabilitado", "Este usuario ya tiene un cambio de firma habilitado.");

            control.AgregarHabilitacion(idUsuarioRh, DateTime.Now);
            detalle.FirmaControlJson = control.Serialize();
            detalle.FechaModificacion = DateTime.Now;
            await _appContext.SaveChangesAsync(cancellationToken);

            EnrichWideEvent(action: "HabilitarCambioFirma", entityId: idUsuario, additionalContext: new Dictionary<string, object>
            {
                ["habilitadoPor"] = idUsuarioRh
            });
            return true;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "HabilitarCambioFirma", entityId: idUsuario, exception: ex);
            return CommonErrors.DatabaseError("habilitar el cambio de firma");
        }
    }

    public async Task<ErrorOr<bool>> AprobarFirmaAsync(int idUsuario, int idUsuarioRh, CancellationToken cancellationToken = default)
    {
        try
        {
            var detalle = await _appContext.UsuariosDetalle
                .FirstOrDefaultAsync(d => d.IdUsuario == idUsuario, cancellationToken);

            if (detalle == null)
            {
                EnrichWideEvent(action: "AprobarFirma", entityId: idUsuario, notFound: true);
                return CommonErrors.NotFound("Usuario");
            }

            var control = FirmaControl.Parse(detalle.FirmaControlJson);
            if (!control.EnComprobacion)
                return CommonErrors.Validation("Firma.NoEnComprobacion",
                    "Este usuario no tiene una firma en comprobación.");

            var remision = control.UltimaRemision!;
            if (string.IsNullOrEmpty(remision.FirmaPendiente))
                return CommonErrors.Validation("Firma.RemisionIncompleta",
                    "La remisión no tiene firma pendiente registrada.");

            var ahora = DateTime.Now;
            control.AgregarAprobacion(idUsuarioRh, ahora, remision.FirmaPendiente, remision.Ine);
            control.AgregarSubida(idUsuario, ahora);
            detalle.FirmaControlJson = control.Serialize();
            detalle.FirmaPathCifrada = remision.FirmaPendiente;
            detalle.FechaModificacion = ahora;
            await _appContext.SaveChangesAsync(cancellationToken);

            EnrichWideEvent(action: "AprobarFirma", entityId: idUsuario, additionalContext: new Dictionary<string, object>
            {
                ["aprobadoPor"] = idUsuarioRh
            });

            await NotificarResolucionUsuarioAsync(idUsuario, aprobada: true, motivo: null, cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "AprobarFirma", entityId: idUsuario, exception: ex);
            return CommonErrors.DatabaseError("aprobar la firma");
        }
    }

    public async Task<ErrorOr<bool>> RechazarFirmaAsync(int idUsuario, int idUsuarioRh, string motivo, CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(motivo))
                return CommonErrors.Validation("Motivo", "El motivo del rechazo es obligatorio.");

            var detalle = await _appContext.UsuariosDetalle
                .FirstOrDefaultAsync(d => d.IdUsuario == idUsuario, cancellationToken);

            if (detalle == null)
            {
                EnrichWideEvent(action: "RechazarFirma", entityId: idUsuario, notFound: true);
                return CommonErrors.NotFound("Usuario");
            }

            var control = FirmaControl.Parse(detalle.FirmaControlJson);
            if (!control.EnComprobacion)
                return CommonErrors.Validation("Firma.NoEnComprobacion",
                    "Este usuario no tiene una firma en comprobación.");

            var remision = control.UltimaRemision!;

            EliminarFirmaCandidata(remision.FirmaPendiente);
            EliminarIne(remision.Ine);

            control.AgregarRechazo(idUsuarioRh, DateTime.Now, motivo.Trim());
            detalle.FirmaControlJson = control.Serialize();
            detalle.FechaModificacion = DateTime.Now;
            await _appContext.SaveChangesAsync(cancellationToken);

            EnrichWideEvent(action: "RechazarFirma", entityId: idUsuario, additionalContext: new Dictionary<string, object>
            {
                ["rechazadoPor"] = idUsuarioRh
            });

            await NotificarResolucionUsuarioAsync(idUsuario, aprobada: false, motivo: motivo.Trim(), cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "RechazarFirma", entityId: idUsuario, exception: ex);
            return CommonErrors.DatabaseError("rechazar la firma");
        }
    }

    public async Task<ErrorOr<ArchivoProtegidoResponse>> GetIneAsync(int idUsuario, string? archivo = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var firmaControlJson = await _appContext.UsuariosDetalle
                .AsNoTracking()
                .Where(d => d.IdUsuario == idUsuario)
                .Select(d => d.FirmaControlJson)
                .FirstOrDefaultAsync(cancellationToken);

            var control = FirmaControl.Parse(firmaControlJson);

            var candidatos = control.Eventos
                .Select(e => new { e.Fecha, IneRef = e.Accion == FirmaAccion.Remision ? e.Ine : e.Accion == FirmaAccion.Aprobacion ? e.IneArchivo : null })
                .Where(x => !string.IsNullOrWhiteSpace(x.IneRef))
                .ToList();

            string? ineRef;
            if (string.IsNullOrWhiteSpace(archivo))
            {
                ineRef = candidatos.OrderByDescending(x => x.Fecha).FirstOrDefault()?.IneRef;
            }
            else
            {
                ineRef = candidatos
                    .FirstOrDefault(x => string.Equals(x.IneRef, archivo, StringComparison.OrdinalIgnoreCase))?.IneRef;
            }

            if (string.IsNullOrWhiteSpace(ineRef))
            {
                EnrichWideEvent(action: "GetIne", entityId: idUsuario, notFound: true);
                return CommonErrors.NotFound("Ine", $"Usuario {idUsuario}");
            }

            var parts = SplitLogical(ineRef, "ine");
            if (parts != null)
            {
                var bytes = await _cipher.ReadDecryptedAsync(parts.Value.Directorio, parts.Value.Archivo, cancellationToken);
                if (bytes == null)
                {
                    EnrichWideEvent(action: "GetIne", entityId: idUsuario, notFound: true, additionalContext: Ctx(("archivo", ineRef)));
                    return CommonErrors.NotFound("Ine", ineRef);
                }
                EnrichWideEvent(action: "GetIne", entityId: idUsuario, additionalContext: Ctx(("archivo", ineRef)));
                return new ArchivoProtegidoResponse
                {
                    Contenido = bytes,
                    ContentType = ContentTypePorExtension(parts.Value.Archivo),
                    NombreArchivo = parts.Value.Archivo
                };
            }

            EnrichWideEvent(action: "GetIne", entityId: idUsuario, notFound: true, additionalContext: Ctx(("archivo", ineRef)));
            return CommonErrors.NotFound("Ine", ineRef);
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetIne", entityId: idUsuario, exception: ex);
            return CommonErrors.DatabaseError("obtener la foto del INE");
        }
    }

    public async Task<ErrorOr<ArchivoProtegidoResponse>> GetFirmaPendienteAsync(int idUsuario, CancellationToken cancellationToken = default)
    {
        try
        {
            var firmaControlJson = await _appContext.UsuariosDetalle
                .AsNoTracking()
                .Where(d => d.IdUsuario == idUsuario)
                .Select(d => d.FirmaControlJson)
                .FirstOrDefaultAsync(cancellationToken);

            var control = FirmaControl.Parse(firmaControlJson);
            if (!control.EnComprobacion)
            {
                EnrichWideEvent(action: "GetFirmaPendiente", entityId: idUsuario, notFound: true);
                return CommonErrors.NotFound("FirmaPendiente", $"Usuario {idUsuario} sin firma en comprobación");
            }

            var firmaRef = control.UltimaRemision?.FirmaPendiente;
            return await ServirFirmaAsync("GetFirmaPendiente", idUsuario, firmaRef, cancellationToken);
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetFirmaPendiente", entityId: idUsuario, exception: ex);
            return CommonErrors.DatabaseError("obtener la firma pendiente");
        }
    }

    public async Task<ErrorOr<ArchivoProtegidoResponse>> GetFirmaVigenteAsync(int idUsuario, CancellationToken cancellationToken = default)
    {
        try
        {
            var firmaCifrada = await _appContext.UsuariosDetalle
                .AsNoTracking()
                .Where(d => d.IdUsuario == idUsuario)
                .Select(d => d.FirmaPathCifrada)
                .FirstOrDefaultAsync(cancellationToken);

            return await ServirFirmaAsync("GetFirmaVigente", idUsuario, firmaCifrada, cancellationToken);
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetFirmaVigente", entityId: idUsuario, exception: ex);
            return CommonErrors.DatabaseError("obtener la firma vigente");
        }
    }

    public async Task<ErrorOr<ArchivoProtegidoResponse>> GetFirmaVigenteConLegacyAsync(
        int idUsuario, CancellationToken cancellationToken = default)
    {
        try
        {
            var firmas = await _appContext.UsuariosDetalle
                .AsNoTracking()
                .Where(d => d.IdUsuario == idUsuario)
                .Select(d => new { d.FirmaPathCifrada, d.FirmaPath })
                .FirstOrDefaultAsync(cancellationToken);

            if (!string.IsNullOrWhiteSpace(firmas?.FirmaPathCifrada))
            {
                var cifrada = await ServirFirmaAsync(
                    "GetFirmaVigenteConLegacy", idUsuario, firmas.FirmaPathCifrada, cancellationToken);
                if (!cifrada.IsError)
                    return cifrada;
            }

            if (!string.IsNullOrWhiteSpace(firmas?.FirmaPath))
            {
                var legacy = await ServirFirmaLegacyAsync(
                    "GetFirmaVigenteConLegacy", idUsuario, firmas.FirmaPath, cancellationToken);
                if (!legacy.IsError)
                    return legacy;
            }

            return CommonErrors.NotFound("Firma", $"Usuario {idUsuario}");
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetFirmaVigenteConLegacy", entityId: idUsuario, exception: ex);
            return CommonErrors.DatabaseError("obtener la firma vigente");
        }
    }

    public async Task<ErrorOr<ArchivoProtegidoResponse>> GetFirmaBitacoraAsync(
        int idEvento, int idUsuarioActual, IReadOnlyCollection<string> permisos, CancellationToken cancellationToken = default)
    {
        try
        {
            var evento = await _appContext.WorkflowBitacoras
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.IdEvento == idEvento, cancellationToken);

            if (evento == null)
            {
                EnrichWideEvent(action: "GetFirmaBitacora", entityId: idEvento, notFound: true);
                return CommonErrors.NotFound("Evento", idEvento.ToString());
            }

            var permitido = evento.TipoEntidad switch
            {
                CodigoProceso.SOLICITUD_PERSONAL => await PuedeVerSolicitudAsync(evento.IdEntidad, idUsuarioActual, permisos, cancellationToken),
                CodigoProceso.ORDEN_COMPRA => await PuedeVerOrdenAsync(evento.IdEntidad, idUsuarioActual, permisos, cancellationToken),
                _ => false,
            };

            if (!permitido)
            {
                EnrichWideEvent(action: "GetFirmaBitacora", entityId: idEvento, additionalContext: Ctx(("forbidden", true)));
                return Error.Forbidden("Firma.Acceso",
                    "No tiene permiso para ver las firmas de este documento.");
            }

            var firmaEvento = ExtraerFirmaArchivo(evento.DatosSnapshot);
            if (!string.IsNullOrWhiteSpace(firmaEvento))
            {
                var servida = await ServirFirmaAsync("GetFirmaBitacora", evento.IdUsuario, firmaEvento, cancellationToken);
                if (!servida.IsError)
                    return servida;

                if (evento.TipoEntidad == CodigoProceso.ORDEN_COMPRA)
                {
                    var servidaLegacy = await ServirFirmaLegacyAsync(
                        "GetFirmaBitacora", evento.IdUsuario, firmaEvento, cancellationToken);
                    if (!servidaLegacy.IsError)
                        return servidaLegacy;
                }
            }

            if (evento.TipoEntidad == CodigoProceso.ORDEN_COMPRA)
            {
                var firmas = await _appContext.UsuariosDetalle
                    .AsNoTracking()
                    .Where(d => d.IdUsuario == evento.IdUsuario)
                    .Select(d => new { d.FirmaPathCifrada, d.FirmaPath })
                    .FirstOrDefaultAsync(cancellationToken);

                if (!string.IsNullOrWhiteSpace(firmas?.FirmaPathCifrada))
                {
                    var servida = await ServirFirmaAsync(
                        "GetFirmaBitacora", evento.IdUsuario, firmas.FirmaPathCifrada, cancellationToken);
                    if (!servida.IsError)
                        return servida;
                }

                if (!string.IsNullOrWhiteSpace(firmas?.FirmaPath))
                {
                    var servidaLegacy = await ServirFirmaLegacyAsync(
                        "GetFirmaBitacora", evento.IdUsuario, firmas.FirmaPath, cancellationToken);
                    if (!servidaLegacy.IsError)
                        return servidaLegacy;
                }
            }

            return await GetFirmaVigenteAsync(evento.IdUsuario, cancellationToken);
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetFirmaBitacora", entityId: idEvento, exception: ex);
            return CommonErrors.DatabaseError("obtener la firma del evento");
        }
    }

    public async Task<ErrorOr<ArchivoProtegidoResponse>> GetFirmaSolicitanteAsync(
        int idSolicitud, int idUsuarioActual, IReadOnlyCollection<string> permisos, CancellationToken cancellationToken = default)
    {
        try
        {
            var solicitante = await _appContext.SolicitudesPersonal
                .AsNoTracking()
                .Where(s => s.IdSolicitud == idSolicitud)
                .Select(s => (int?)s.IdUsuarioSolicitante)
                .FirstOrDefaultAsync(cancellationToken);

            if (solicitante == null)
            {
                EnrichWideEvent(action: "GetFirmaSolicitante", entityId: idSolicitud, notFound: true);
                return CommonErrors.NotFound("Solicitud", idSolicitud.ToString());
            }

            if (!await PuedeVerSolicitudAsync(idSolicitud, idUsuarioActual, permisos, cancellationToken))
            {
                EnrichWideEvent(action: "GetFirmaSolicitante", entityId: idSolicitud, additionalContext: Ctx(("forbidden", true)));
                return Error.Forbidden("Firma.Acceso", "No tiene permiso para ver las firmas de este documento.");
            }

            var snapshotCreacion = await _appContext.WorkflowBitacoras
                .AsNoTracking()
                .Where(b => b.TipoEntidad == CodigoProceso.SOLICITUD_PERSONAL && b.IdEntidad == idSolicitud)
                .OrderBy(b => b.IdEvento)
                .Select(b => b.DatosSnapshot)
                .FirstOrDefaultAsync(cancellationToken);

            var firmaCapturada = ExtraerFirmaArchivo(snapshotCreacion, "firmaSolicitanteArchivo");
            if (!string.IsNullOrWhiteSpace(firmaCapturada))
            {
                var servida = await ServirFirmaAsync("GetFirmaSolicitante", solicitante.Value, firmaCapturada, cancellationToken);
                if (!servida.IsError)
                    return servida;
            }

            return await GetFirmaVigenteAsync(solicitante.Value, cancellationToken);
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetFirmaSolicitante", entityId: idSolicitud, exception: ex);
            return CommonErrors.DatabaseError("obtener la firma del solicitante");
        }
    }

    private async Task<ErrorOr<ArchivoProtegidoResponse>> ServirFirmaAsync(
        string accion, int idUsuarioObjetivo, string? firmaRef, CancellationToken cancellationToken)
    {
        var parts = SplitLogical(firmaRef, "firmas");
        if (parts != null)
        {
            var bytes = await _cipher.ReadDecryptedAsync(parts.Value.Directorio, parts.Value.Archivo, cancellationToken);
            if (bytes != null)
            {
                EnrichWideEvent(action: accion, entityId: idUsuarioObjetivo, additionalContext: Ctx(("archivo", firmaRef)));
                return new ArchivoProtegidoResponse
                {
                    Contenido = bytes,
                    ContentType = ContentTypePorExtension(parts.Value.Archivo),
                    NombreArchivo = parts.Value.Archivo
                };
            }
        }

        EnrichWideEvent(action: accion, entityId: idUsuarioObjetivo, notFound: true, additionalContext: Ctx(("archivo", firmaRef)));
        return CommonErrors.NotFound("Firma", $"Usuario {idUsuarioObjetivo}");
    }

    private async Task<ErrorOr<ArchivoProtegidoResponse>> ServirFirmaLegacyAsync(
        string accion, int idUsuarioObjetivo, string? firmaRef, CancellationToken cancellationToken)
    {
        var normalizada = firmaRef?.Replace('\\', '/').TrimStart('/');
        var match = LegacyFirmaRegex.Match(normalizada ?? string.Empty);
        if (!match.Success)
        {
            EnrichWideEvent(action: accion, entityId: idUsuarioObjetivo, notFound: true, additionalContext: Ctx(("archivo", firmaRef)));
            return CommonErrors.NotFound("Firma", $"Usuario {idUsuarioObjetivo}");
        }

        var archivo = match.Groups["file"].Value;
        var raiz = Path.GetFullPath(Path.Combine(_archivosSettings.Value.BasePath, "firmas_usuarios"));
        var rutaFisica = Path.GetFullPath(Path.Combine(raiz, archivo));

        if (!rutaFisica.StartsWith(raiz + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
            || !File.Exists(rutaFisica))
        {
            EnrichWideEvent(action: accion, entityId: idUsuarioObjetivo, notFound: true, additionalContext: Ctx(("archivo", firmaRef)));
            return CommonErrors.NotFound("Firma", $"Usuario {idUsuarioObjetivo}");
        }

        var bytes = await File.ReadAllBytesAsync(rutaFisica, cancellationToken);
        EnrichWideEvent(action: accion, entityId: idUsuarioObjetivo, additionalContext: Ctx(("archivo", firmaRef)));
        return new ArchivoProtegidoResponse
        {
            Contenido = bytes,
            ContentType = ContentTypePorExtension(archivo),
            NombreArchivo = archivo
        };
    }

    private async Task<bool> PuedeVerSolicitudAsync(int idSolicitud, int idUsuario, IReadOnlyCollection<string> permisos, CancellationToken cancellationToken)
    {
        if (permisos.Contains("solicitud_personal.puede_ver_todas"))
            return true;

        var duenos = await _appContext.SolicitudesPersonal
            .AsNoTracking()
            .Where(s => s.IdSolicitud == idSolicitud)
            .Select(s => new { s.IdUsuarioCreador, s.IdUsuarioSolicitante })
            .FirstOrDefaultAsync(cancellationToken);

        if (duenos == null)
            return false;
        if (duenos.IdUsuarioCreador == idUsuario || duenos.IdUsuarioSolicitante == idUsuario)
            return true;

        return await _appContext.WorkflowBitacoras
            .AsNoTracking()
            .AnyAsync(b => b.TipoEntidad == CodigoProceso.SOLICITUD_PERSONAL
                && b.IdEntidad == idSolicitud && b.IdUsuario == idUsuario, cancellationToken);
    }

    private async Task<bool> PuedeVerOrdenAsync(int idOrden, int idUsuario, IReadOnlyCollection<string> permisos, CancellationToken cancellationToken)
    {
        return await _visibilidadOrdenCompra.PuedeVerAsync(idOrden, idUsuario, cancellationToken);
    }

    private static string? ExtraerFirmaArchivo(string? datosSnapshot, string clave = "firmaArchivo")
    {
        if (string.IsNullOrWhiteSpace(datosSnapshot))
            return null;
        try
        {
            using var doc = JsonDocument.Parse(datosSnapshot);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return null;
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (string.Equals(prop.Name, clave, StringComparison.OrdinalIgnoreCase)
                    && prop.Value.ValueKind == JsonValueKind.String)
                    return prop.Value.GetString();
            }
        }
        catch (JsonException)
        {
        }
        return null;
    }

    private async Task NotificarResolucionUsuarioAsync(int idUsuario, bool aprobada, string? motivo, CancellationToken cancellationToken)
    {
        try
        {
            await _notificationService.SendAsync(new SendNotificationRequest
            {
                Title = aprobada ? "Firma aprobada" : "Firma rechazada",
                Message = aprobada
                    ? "Recursos Humanos aprobó tu firma digital. Ya puedes usarla para firmar documentos."
                    : $"Recursos Humanos rechazó tu firma digital. Motivo: {motivo}",
                Type = aprobada ? "success" : "warning",
                Category = "firmas",
                Priority = "normal",
                Channels =
                [
                    new NotificationChannelRequest { ChannelType = "in-app", UserIds = [idUsuario] },
                    new NotificationChannelRequest { ChannelType = "email", UserIds = [idUsuario] }
                ]
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "ResolucionFirma.NotificacionError", entityId: idUsuario, exception: ex);
        }
    }
}
