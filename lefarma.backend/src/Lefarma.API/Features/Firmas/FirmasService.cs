using ErrorOr;
using Lefarma.API.Domain.Firmas;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Archivos.Settings;
using Lefarma.API.Features.Firmas.DTOs;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Firmas;

/// <summary>
/// Gestión de firmas digitales de usuarios por parte de RH:
/// listado con estado, habilitación de cambio (un solo uso) y
/// comprobación (aprobación/rechazo) de firmas remitidas con INE.
/// El estado se deriva del historial de eventos JSON (firma_control).
/// </summary>
public class FirmasService : BaseService, IFirmasService
{
    private readonly AsokamDbContext _asokamContext;
    private readonly ApplicationDbContext _appContext;
    private readonly INotificationService _notificationService;
    private readonly IOptions<ArchivosSettings> _archivosSettings;
    protected override string EntityName => "Firmas";

    public FirmasService(
        AsokamDbContext asokamContext,
        ApplicationDbContext appContext,
        INotificationService notificationService,
        IOptions<ArchivosSettings> archivosSettings,
        IWideEventAccessor wideEventAccessor)
        : base(wideEventAccessor)
    {
        _asokamContext = asokamContext;
        _appContext = appContext;
        _notificationService = notificationService;
        _archivosSettings = archivosSettings;
    }

    public async Task<ErrorOr<List<FirmaUsuarioResponse>>> GetUsuariosConFirmaAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            // Detalles (Lefarma) de usuarios con firma registrada o con historial
            // (el historial basta para que aparezcan remisiones de primera firma).
            var detalles = await _appContext.UsuariosDetalle
                .AsNoTracking()
                .Where(d => (d.FirmaPath != null && d.FirmaPath != "")
                    || (d.FirmaControlJson != null && d.FirmaControlJson != ""))
                .ToListAsync(cancellationToken);

            if (detalles.Count == 0)
                return new List<FirmaUsuarioResponse>();

            // Estado derivado del historial JSON por usuario.
            var controles = detalles.ToDictionary(d => d.IdUsuario, d => FirmaControl.Parse(d.FirmaControlJson));

            var ids = detalles.Select(d => d.IdUsuario).ToList();
            var areaIds = detalles.Where(d => d.IdArea.HasValue).Select(d => d.IdArea!.Value).Distinct().ToList();
            var habilitoIds = controles.Values
                .Select(c => c.UltimaHabilitacion?.IdUsuario)
                .Where(id => id.HasValue && id.Value > 0)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();

            // Nombres (Asokam) y áreas (Lefarma) en consultas separadas; se cruzan en memoria.
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
                var tieneIne = ultimaRemision?.Ine != null && File.Exists(GetIneFullPath(ultimaRemision.Ine));

                return new FirmaUsuarioResponse
                {
                    IdUsuario = d.IdUsuario,
                    SamAccountName = u?.SamAccountName,
                    NombreCompleto = u?.NombreCompleto,
                    Correo = u?.Correo,
                    Area = area,
                    FirmaPath = d.FirmaPath,
                    FirmaSubidas = Math.Max(control.Subidas, string.IsNullOrEmpty(d.FirmaPath) ? 0 : 1),
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
            // Primero las firmas en comprobación y luego quienes solicitaron cambio:
            // son los pendientes de atender.
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

            if (detalle == null || string.IsNullOrEmpty(detalle.FirmaPath))
            {
                EnrichWideEvent(action: "HabilitarCambioFirma", entityId: idUsuario, notFound: true);
                return CommonErrors.NotFound("Firma");
            }

            var control = FirmaControl.Parse(detalle.FirmaControlJson);
            if (control.CambioHabilitado)
                return CommonErrors.Validation("Firma.CambioYaHabilitado", "Este usuario ya tiene un cambio de firma habilitado.");

            // Un evento "habilitacion" habilita el cambio (un solo uso) y, si existía,
            // atiende la solicitud pendiente (el estado se deriva del último evento).
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

            var pendienteFullPath = Path.Combine(
                _archivosSettings.Value.BasePath, remision.FirmaPendiente.TrimStart('/'));
            if (!File.Exists(pendienteFullPath))
                return CommonErrors.NotFound("FirmaPendiente", remision.FirmaPendiente);

            // Borrar la firma vigente anterior (vive bajo BasePath, no wwwroot).
            if (!string.IsNullOrEmpty(detalle.FirmaPath))
            {
                var anteriorFullPath = Path.Combine(
                    _archivosSettings.Value.BasePath, detalle.FirmaPath.TrimStart('/'));
                if (File.Exists(anteriorFullPath))
                    File.Delete(anteriorFullPath);
            }

            // La pendiente pasa a ser la vigente: {BasePath}/firmas_usuarios/{userId}.{ext}
            var extension = Path.GetExtension(remision.FirmaPendiente);
            var vigenteFileName = $"{idUsuario}{extension}";
            var vigenteFullPath = Path.Combine(
                _archivosSettings.Value.BasePath, "firmas_usuarios", vigenteFileName);
            File.Move(pendienteFullPath, vigenteFullPath, overwrite: true);

            // La foto del INE se borra siempre al resolver.
            BorrarIne(remision.Ine);

            // La aprobación va acompañada de "subida" para mantener el conteo y el bloqueo vigente.
            var ahora = DateTime.Now;
            control.AgregarAprobacion(idUsuarioRh, ahora);
            control.AgregarSubida(idUsuario, ahora);
            detalle.FirmaControlJson = control.Serialize();
            detalle.FirmaPath = $"firmas_usuarios/{vigenteFileName}";
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

            // Borrar la firma pendiente y la foto del INE (la vigente no se toca).
            if (!string.IsNullOrEmpty(remision.FirmaPendiente))
            {
                var pendienteFullPath = Path.Combine(
                    _archivosSettings.Value.BasePath, remision.FirmaPendiente.TrimStart('/'));
                if (File.Exists(pendienteFullPath))
                    File.Delete(pendienteFullPath);
            }
            BorrarIne(remision.Ine);

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

    public async Task<ErrorOr<IneArchivoResponse>> GetIneAsync(int idUsuario, CancellationToken cancellationToken = default)
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
                return CommonErrors.NotFound("Ine", $"Usuario {idUsuario} sin firma en comprobación");

            var ineFileName = control.UltimaRemision?.Ine;
            if (string.IsNullOrEmpty(ineFileName))
                return CommonErrors.NotFound("Ine", $"Usuario {idUsuario}");

            var fullPath = GetIneFullPath(ineFileName);
            if (!File.Exists(fullPath))
                return CommonErrors.NotFound("Ine", ineFileName);

            var contenido = await File.ReadAllBytesAsync(fullPath, cancellationToken);
            return new IneArchivoResponse
            {
                Contenido = contenido,
                ContentType = Path.GetExtension(ineFileName).ToLowerInvariant() == ".png"
                    ? "image/png"
                    : "image/jpeg",
                NombreArchivo = ineFileName
            };
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetIne", entityId: idUsuario, exception: ex);
            return CommonErrors.DatabaseError("obtener la foto del INE");
        }
    }

    private string GetIneFullPath(string ineFileName) =>
        Path.Combine(_archivosSettings.Value.PrivatePath, "ine_usuarios", ineFileName);

    /// <summary>La foto del INE se borra físicamente al resolver (aprobación o rechazo).</summary>
    private void BorrarIne(string? ineFileName)
    {
        if (string.IsNullOrEmpty(ineFileName))
            return;

        var fullPath = GetIneFullPath(ineFileName);
        if (File.Exists(fullPath))
            File.Delete(fullPath);
    }

    /// <summary>
    /// Notifica al usuario (in-app + correo) la resolución de su firma en comprobación.
    /// No debe romper la resolución si falla.
    /// </summary>
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
