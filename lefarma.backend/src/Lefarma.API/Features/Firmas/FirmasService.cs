using ErrorOr;
using Lefarma.API.Domain.Firmas;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Archivos.Settings;
using Lefarma.API.Features.Firmas.DTOs;
using Lefarma.API.Features.Notifications.DTOs;
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
    private readonly IFileCipher _cipher;
    protected override string EntityName => "Firmas";

    public FirmasService(
        AsokamDbContext asokamContext,
        ApplicationDbContext appContext,
        INotificationService notificationService,
        IOptions<ArchivosSettings> archivosSettings,
        IFileCipher cipher,
        IWideEventAccessor wideEventAccessor)
        : base(wideEventAccessor)
    {
        _asokamContext = asokamContext;
        _appContext = appContext;
        _notificationService = notificationService;
        _archivosSettings = archivosSettings;
        _cipher = cipher;
    }

    private string FirmasDir => Path.Combine(_archivosSettings.Value.PrivatePath, "firmas");
    private string IneDir => Path.Combine(_archivosSettings.Value.PrivatePath, "ine");

    // Nombre lógico válido: "firmas|ine/{userId}_{yyyyMMddHHmmss}.{ext}" (sin traversal).
    private static readonly Regex LogicalNameRegex = new(
        @"^(?<dir>firmas|ine)/(?<file>\d+_\d{14}\.(?:png|jpg|jpeg|pdf))$",
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

    /// <summary>Elimina la firma candidata de una remisión (cifrada).</summary>
    private void EliminarFirmaCandidata(string? firmaPendiente)
    {
        var parts = SplitLogical(firmaPendiente, "firmas");
        if (parts != null)
            _cipher.DeleteEncrypted(parts.Value.Directorio, parts.Value.Archivo);
    }

    /// <summary>Elimina la foto de INE de una remisión (cifrada).</summary>
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
            // Detalles (Lefarma) de usuarios con firma cifrada o con historial
            // (el historial basta para que aparezcan remisiones de primera firma).
            var detalles = await _appContext.UsuariosDetalle
                .AsNoTracking()
                .Where(d => (d.FirmaPathCifrada != null && d.FirmaPathCifrada != "")
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

            if (detalle == null || string.IsNullOrEmpty(detalle.FirmaPathCifrada))
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

            // La candidata ya vive cifrada en firmas/; aprobar solo mueve el puntero.
            // No se borra nada: la firma vigente anterior queda como versión autorizada
            // y la foto del INE queda como evidencia (retención de versiones autorizadas).
            var ahora = DateTime.Now;
            control.AgregarAprobacion(idUsuarioRh, ahora, remision.FirmaPendiente, remision.Ine);
            // La aprobación va acompañada de "subida" para mantener el conteo y el bloqueo vigente.
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

            // Rechazo: se eliminan la firma candidata y la foto del INE (la vigente no se toca).
            // El evento de remisión queda en el historial como registro del proceso,
            // aunque sus nombres de archivo apunten a archivos ya eliminados.
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

            // Pares remisión/aprobación que tienen INE asociada (nombre lógico o legacy).
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
                // ?archivo= solo sirve versiones referenciadas en el historial (anti-enumeración).
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

    /// <summary>Firma candidata en comprobación (para el modal de comprobación de RH).</summary>
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

    /// <summary>
    /// Firma vigente del usuario en el sistema RH: solo el puntero firma_path_cifrada.
    /// Sin puntero → NotFound (los usuarios legacy se tratan como nuevos).
    /// </summary>
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

    /// <summary>
    /// Firma usada en un evento de la bitácora del workflow. Autorización estricta:
    /// solo quien puede ver el documento del evento (SP/OC). Si el evento no tiene
    /// firmaArchivo capturado (documentos anteriores a la captura), se sirve la
    /// firma vigente actual del actor (fallback).
    /// </summary>
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

            // Preferir la firma capturada en el evento (Fase 2); si no, la vigente del actor.
            var firmaEvento = ExtraerFirmaArchivo(evento.DatosSnapshot);
            if (!string.IsNullOrWhiteSpace(firmaEvento))
            {
                var servida = await ServirFirmaAsync("GetFirmaBitacora", evento.IdUsuario, firmaEvento, cancellationToken);
                if (!servida.IsError)
                    return servida;
            }

            return await GetFirmaVigenteAsync(evento.IdUsuario, cancellationToken);
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetFirmaBitacora", entityId: idEvento, exception: ex);
            return CommonErrors.DatabaseError("obtener la firma del evento");
        }
    }

    /// <summary>
    /// Firma del solicitante de una solicitud de personal, con autorización por documento
    /// (misma regla que la bitácora). Prefiere la capturada al crear la solicitud
    /// (`firmaSolicitanteArchivo`, Fase 2/T7); si no existe, la vigente actual.
    /// </summary>
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

            // Preferir la firma del solicitante capturada al crear la solicitud (Fase 2, T7);
            // si no existe (solicitudes anteriores), servir la vigente actual.
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

    /// <summary>
    /// Sirve una firma por su nombre lógico cifrado.
    /// </summary>
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

    // Quien puede ver la solicitud: creador, solicitante, participante del flujo o "ver todas".
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

    // Quien puede ver la orden: creador, participante del flujo o "ver todas las órdenes".
    private async Task<bool> PuedeVerOrdenAsync(int idOrden, int idUsuario, IReadOnlyCollection<string> permisos, CancellationToken cancellationToken)
    {
        if (permisos.Contains("orden_compra.puede_ver_todas_las_ordenes"))
            return true;

        var idCreador = await _appContext.OrdenesCompra
            .AsNoTracking()
            .Where(o => o.IdOrden == idOrden)
            .Select(o => (int?)o.IdUsuarioCreador)
            .FirstOrDefaultAsync(cancellationToken);

        if (idCreador == null)
            return false;
        if (idCreador == idUsuario)
            return true;

        return await _appContext.WorkflowBitacoras
            .AsNoTracking()
            .AnyAsync(b => b.TipoEntidad == CodigoProceso.ORDEN_COMPRA
                && b.IdEntidad == idOrden && b.IdUsuario == idUsuario, cancellationToken);
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
            // Snapshot no-JSON: no hay firma capturada.
        }
        return null;
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
