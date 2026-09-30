using ErrorOr;
using Lefarma.API.Domain.Firmas;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Archivos.Settings;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Features.Profile.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Services.Identity;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Profile;
/// <summary>
/// Implementación del servicio de perfil de usuario
/// </summary>
public class ProfileService : BaseService, IProfileService
{
    private readonly AsokamDbContext _asokamContext;
    private readonly ApplicationDbContext _appContext;
    private readonly UserPermissionService _permissionService;
    private readonly INotificationService _notificationService;
    private readonly IOptions<ArchivosSettings> _archivosSettings;
    protected override string EntityName => "Profile";

    public ProfileService(
        AsokamDbContext asokamContext,
        ApplicationDbContext appContext,
        UserPermissionService permissionService,
        INotificationService notificationService,
        IOptions<ArchivosSettings> archivosSettings,
        IWideEventAccessor wideEventAccessor)
        : base(wideEventAccessor)
    {
        _asokamContext = asokamContext;
        _appContext = appContext;
        _permissionService = permissionService;
        _notificationService = notificationService;
        _archivosSettings = archivosSettings;
    }

    public async Task<ErrorOr<ProfileResponse>> GetProfileAsync(int userId, CancellationToken cancellationToken = default)
    {
        try
        {
            var usuario = await _asokamContext.Usuarios
                .FirstOrDefaultAsync(u => u.IdUsuario == userId, cancellationToken);

            if (usuario == null)
            {
                EnrichWideEvent(action: "GetProfile", entityId: userId, notFound: true);
                return CommonErrors.NotFound("Usuario", userId.ToString());
            }

            var detalle = await EnsureUsuarioDetalleAsync(userId, cancellationToken);

            // Estado de firma derivado del historial JSON (firma_control).
            var firmaControl = FirmaControl.Parse(detalle.FirmaControlJson);
            var firmaSubidasEfectivas = Math.Max(firmaControl.Subidas,
                string.IsNullOrEmpty(detalle.FirmaPath) ? 0 : 1);

            // Obtener si la empresa del usuario puede seleccionar otras empresas
            var puedeSeleccionarEmpresas = false;
            if (detalle.IdEmpresa > 0)
            {
                var empresa = await _appContext.Empresas
                    .FirstOrDefaultAsync(e => e.IdEmpresa == detalle.IdEmpresa, cancellationToken);
                puedeSeleccionarEmpresas = empresa?.PuedeSeleccionarEmpresas ?? false;
            }

            // Obtener roles activos del usuario
            var roles = await _asokamContext.UsuariosRoles
                .Include(ur => ur.Rol)
                .Where(ur => ur.IdUsuario == userId && ur.Rol.EsActivo)
                .Where(ur => ur.FechaExpiracion == null || ur.FechaExpiracion > DateTime.Now)
                .Select(ur => ur.Rol.NombreRol)
                .ToListAsync(cancellationToken);

            // Permisos via cache compartido (5 min) — misma fuente que PermissionHandler
            var permisos = (await _permissionService.GetPermissionsAsync(userId)).ToList();

            var response = new ProfileResponse
            {
                IdUsuario = usuario.IdUsuario,
                SamAccountName = usuario.SamAccountName ?? string.Empty,
                Dominio = usuario.Dominio,
                NombreCompleto = usuario.NombreCompleto,
                Correo = usuario.Correo,
                EsActivo = usuario.EsActivo,
                UltimoLogin = usuario.UltimoLogin,
                FechaCreacion = usuario.FechaCreacion,
                Roles = roles,
                Permissions = permisos,
                PuedeSeleccionarEmpresas = puedeSeleccionarEmpresas,
                Detalle = detalle != null ? new UsuarioDetalleData
                {
                    IdEmpresa = detalle.IdEmpresa,
                    IdSucursal = detalle.IdSucursal,
                    IdArea = detalle.IdArea,
                    IdCentroCosto = detalle.IdCentroCosto,
                    Puesto = detalle.Puesto,
                    NumeroEmpleado = detalle.NumeroEmpleado,
                    FirmaPath = detalle.FirmaPath,
                    FirmaSubidas = firmaSubidasEfectivas,
                    FirmaCambioHabilitado = firmaControl.CambioHabilitado,
                    FirmaCambioSolicitado = firmaControl.SolicitudPendiente,
                    FirmaEnComprobacion = firmaControl.EnComprobacion,
                    FechaSolicitudCambioFirma = firmaControl.SolicitudPendiente ? firmaControl.UltimaSolicitud?.Fecha : null,
                    TelefonoOficina = detalle.TelefonoOficina,
                    Extension = detalle.Extension,
                    Celular = detalle.Celular,
                    TelegramChat = detalle.TelegramChat,
                    NotificarEmail = detalle.NotificarEmail,
                    NotificarApp = detalle.NotificarApp,
                    NotificarWhatsapp = detalle.NotificarWhatsapp,
                    NotificarSms = detalle.NotificarSms,
                    NotificarTelegram = detalle.NotificarTelegram,
                    NotificarSoloUrgentes = detalle.NotificarSoloUrgentes,
                    NotificarResumenDiario = detalle.NotificarResumenDiario,
                    NotificarRechazos = detalle.NotificarRechazos,
                    NotificarVencimientos = detalle.NotificarVencimientos,
                    IdUsuarioDelegado = detalle.IdUsuarioDelegado,
                    DelegacionHasta = detalle.DelegacionHasta,
                    AvatarUrl = detalle.AvatarUrl,
                    TemaInterfaz = detalle.TemaInterfaz,
                    DashboardInicio = detalle.DashboardInicio
                } : null
            };

            EnrichWideEvent(action: "GetProfile", entityId: userId, nombre: usuario.NombreCompleto);
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetProfile", entityId: userId, exception: ex);
            return CommonErrors.DatabaseError("obtener el perfil");
        }
    }

    public async Task<ErrorOr<ProfileResponse>> UpdateProfileAsync(int userId, UpdateProfileRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var usuario = await _asokamContext.Usuarios
                .FirstOrDefaultAsync(u => u.IdUsuario == userId, cancellationToken);

            if (usuario == null)
            {
                EnrichWideEvent(action: "UpdateProfile", entityId: userId, notFound: true);
                return CommonErrors.NotFound("Usuario", userId.ToString());
            }

            if (!string.IsNullOrWhiteSpace(request.NombreCompleto))
                usuario.NombreCompleto = request.NombreCompleto;

            if (!string.IsNullOrWhiteSpace(request.Correo))
                usuario.Correo = request.Correo;

            var detalle = await EnsureUsuarioDetalleAsync(userId, cancellationToken);

            // Actualizar campos de detalle (solo los que vienen en el request)
            if (request.IdCentroCosto.HasValue)
                detalle.IdCentroCosto = request.IdCentroCosto.Value;

            if (!string.IsNullOrWhiteSpace(request.Puesto))
                detalle.Puesto = request.Puesto;

            if (!string.IsNullOrWhiteSpace(request.NumeroEmpleado))
                detalle.NumeroEmpleado = request.NumeroEmpleado;

            // FirmaPath ya NO se actualiza aquí: la firma solo cambia vía POST /profile/firma,
            // que aplica la regla de un solo cambio con habilitación RH.

            if (!string.IsNullOrWhiteSpace(request.TelefonoOficina))
                detalle.TelefonoOficina = request.TelefonoOficina;

            if (!string.IsNullOrWhiteSpace(request.Extension))
                detalle.Extension = request.Extension;

            if (!string.IsNullOrWhiteSpace(request.Celular))
                detalle.Celular = request.Celular;

            if (!string.IsNullOrWhiteSpace(request.TelegramChat))
                detalle.TelegramChat = request.TelegramChat;

            // Actualizar configuración de notificaciones
            if (request.NotificarEmail.HasValue)
                detalle.NotificarEmail = request.NotificarEmail.Value;

            if (request.NotificarApp.HasValue)
                detalle.NotificarApp = request.NotificarApp.Value;

            if (request.NotificarWhatsapp.HasValue)
                detalle.NotificarWhatsapp = request.NotificarWhatsapp.Value;

            if (request.NotificarSms.HasValue)
                detalle.NotificarSms = request.NotificarSms.Value;

            if (request.NotificarTelegram.HasValue)
                detalle.NotificarTelegram = request.NotificarTelegram.Value;

            if (request.NotificarSoloUrgentes.HasValue)
                detalle.NotificarSoloUrgentes = request.NotificarSoloUrgentes.Value;

            if (request.NotificarResumenDiario.HasValue)
                detalle.NotificarResumenDiario = request.NotificarResumenDiario.Value;

            if (request.NotificarRechazos.HasValue)
                detalle.NotificarRechazos = request.NotificarRechazos.Value;

            if (request.NotificarVencimientos.HasValue)
                detalle.NotificarVencimientos = request.NotificarVencimientos.Value;

            // Actualizar delegación
            if (request.IdUsuarioDelegado.HasValue)
                detalle.IdUsuarioDelegado = request.IdUsuarioDelegado.Value;

            if (request.DelegacionHasta.HasValue)
                detalle.DelegacionHasta = request.DelegacionHasta.Value;

            // Actualizar configuración de interfaz
            if (!string.IsNullOrWhiteSpace(request.AvatarUrl))
                detalle.AvatarUrl = request.AvatarUrl;

            if (!string.IsNullOrWhiteSpace(request.TemaInterfaz))
                detalle.TemaInterfaz = request.TemaInterfaz;

            if (!string.IsNullOrWhiteSpace(request.DashboardInicio))
                detalle.DashboardInicio = request.DashboardInicio;

            detalle.FechaModificacion = DateTime.Now;

            await _asokamContext.SaveChangesAsync(cancellationToken);
            await _appContext.SaveChangesAsync(cancellationToken);

            EnrichWideEvent(action: "UpdateProfile", entityId: userId, nombre: usuario.NombreCompleto);

            // Retornar perfil actualizado
            return await GetProfileAsync(userId, cancellationToken);
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "UpdateProfile", entityId: userId, exception: ex);
            return CommonErrors.DatabaseError("actualizar el perfil");
        }
    }

    public async Task<ErrorOr<bool>> HasFirmaAsync(int userId, CancellationToken cancellationToken = default)
    {
        try
        {
            var tieneFirma = await _appContext.UsuariosDetalle
                .AsNoTracking()
                .AnyAsync(ud => ud.IdUsuario == userId && !string.IsNullOrEmpty(ud.FirmaPath), cancellationToken);

            return tieneFirma;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "HasFirma", entityId: userId, exception: ex);
            return CommonErrors.DatabaseError("verificar la firma digital");
        }
    }

    public async Task<ErrorOr<bool>> TieneFirmaEnComprobacionAsync(int userId, CancellationToken cancellationToken = default)
    {
        try
        {
            var firmaControlJson = await _appContext.UsuariosDetalle
                .AsNoTracking()
                .Where(ud => ud.IdUsuario == userId)
                .Select(ud => ud.FirmaControlJson)
                .FirstOrDefaultAsync(cancellationToken);

            return FirmaControl.Parse(firmaControlJson).EnComprobacion;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "TieneFirmaEnComprobacion", entityId: userId, exception: ex);
            return CommonErrors.DatabaseError("verificar la comprobación de la firma digital");
        }
    }

    public async Task<ErrorOr<string>> UploadSignatureAsync(int userId, IFormFile file, IFormFile ine, string fileName, string contentType, CancellationToken cancellationToken)
    {
        try
        {
            var extension = Path.GetExtension(fileName).ToLowerInvariant();
            if (extension != ".png" && extension != ".jpg" && extension != ".jpeg")
                return CommonErrors.Validation("Firma.Extension", "Solo se permiten archivos PNG, JPG o JPEG");

            if (file.Length > 2 * 1024 * 1024)
                return CommonErrors.Validation("Firma.Tamaño", "El archivo no puede exceder 2 MB");

            if (ine == null || ine.Length == 0)
                return CommonErrors.Validation("Ine.Requerida", "Debes adjuntar una foto de tu INE para comprobación.");

            var ineExtension = Path.GetExtension(ine.FileName).ToLowerInvariant();
            if (ineExtension != ".png" && ineExtension != ".jpg" && ineExtension != ".jpeg")
                return CommonErrors.Validation("Ine.Extension", "La foto del INE solo puede ser PNG, JPG o JPEG");

            if (ine.Length > 5 * 1024 * 1024)
                return CommonErrors.Validation("Ine.Tamaño", "La foto del INE no puede exceder 5 MB");

            var detalle = await EnsureUsuarioDetalleAsync(userId, cancellationToken);

            // Toda firma (primera o cambio habilitado) pasa por comprobación de RH:
            // se guarda como PENDIENTE y la vigente no cambia hasta la aprobación.
            var control = FirmaControl.Parse(detalle.FirmaControlJson);
            var subidasEfectivas = Math.Max(control.Subidas, string.IsNullOrEmpty(detalle.FirmaPath) ? 0 : 1);

            if (control.EnComprobacion)
                return CommonErrors.Validation("Firma.EnComprobacion",
                    "Ya tienes una firma en comprobación por Recursos Humanos.");

            if (!control.PuedeEnviarRemision(subidasEfectivas))
                return CommonErrors.Validation("Firma.CambioBloqueado",
                    "Tu firma ya fue registrada. Solicita a Recursos Humanos que habilite un cambio.");

            var timestamp = DateTime.Now.ToString("yyyyMMddHHmmss");

            // Firma pendiente: vive bajo BasePath/firmas_usuarios/pendientes hasta que RH resuelva.
            var pendientesFolder = Path.Combine(_archivosSettings.Value.BasePath, "firmas_usuarios", "pendientes");
            Directory.CreateDirectory(pendientesFolder);

            var pendienteFileName = $"{userId}_{timestamp}{extension}";
            var pendienteFullPath = Path.Combine(pendientesFolder, pendienteFileName);
            await using (var stream = new FileStream(pendienteFullPath, FileMode.Create, FileAccess.Write))
            {
                await file.CopyToAsync(stream, cancellationToken);
            }
            var pendienteRelativePath = $"firmas_usuarios/pendientes/{pendienteFileName}";

            // Foto del INE: carpeta privada, solo accesible por endpoint autenticado.
            var ineFolder = Path.Combine(_archivosSettings.Value.PrivatePath, "ine_usuarios");
            Directory.CreateDirectory(ineFolder);

            var ineFileName = $"{userId}_{timestamp}{ineExtension}";
            var ineFullPath = Path.Combine(ineFolder, ineFileName);
            await using (var stream = new FileStream(ineFullPath, FileMode.Create, FileAccess.Write))
            {
                await ine.CopyToAsync(stream, cancellationToken);
            }

            // La remisión consume la habilitación RH (estado derivado del historial).
            // FirmaPath no se toca: sigue apuntando a la firma vigente.
            control.AgregarRemision(userId, DateTime.Now, pendienteRelativePath, ineFileName);
            detalle.FirmaControlJson = control.Serialize();
            detalle.FechaModificacion = DateTime.Now;
            await _appContext.SaveChangesAsync(cancellationToken);

            EnrichWideEvent(action: "UploadSignature", entityId: userId, nombre: pendienteFileName);

            // Avisar a RH que hay una firma en comprobación (no debe romper la remisión si falla).
            await NotificarRemisionRhAsync(userId, cancellationToken);

            return pendienteRelativePath;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "UploadSignature", entityId: userId, exception: ex);
            return CommonErrors.DatabaseError("subir la firma digital");
        }
    }

    public async Task<ErrorOr<string>> DeleteSignatureAsync(int userId, CancellationToken cancellationToken)
    {
        try
        {
            var detalle = await _appContext.UsuariosDetalle
                .FirstOrDefaultAsync(ud => ud.IdUsuario == userId, cancellationToken);

            if (detalle == null || string.IsNullOrEmpty(detalle.FirmaPath))
                return CommonErrors.NotFound("Firma");

            // Eliminar también cuenta como cambio: requiere habilitación RH si ya registró firma.
            var control = FirmaControl.Parse(detalle.FirmaControlJson);

            if (control.EnComprobacion)
                return CommonErrors.Validation("Firma.EnComprobacion",
                    "Tienes una firma en comprobación por Recursos Humanos. Espera la resolución.");

            var subidasEfectivas = Math.Max(control.Subidas, 1);
            if (!FirmaCambioPolicy.PuedeGuardar(subidasEfectivas, control.CambioHabilitado))
                return CommonErrors.Validation("Firma.CambioBloqueado",
                    "Tu firma ya fue registrada. Solicita a Recursos Humanos que habilite un cambio.");

            // La firma vive bajo ArchivosSettings:BasePath (no wwwroot).
            var oldPhysicalPath = Path.Combine(_archivosSettings.Value.BasePath, detalle.FirmaPath.TrimStart('/'));
            if (File.Exists(oldPhysicalPath))
                File.Delete(oldPhysicalPath);

            // La habilitación RH se consume sola al registrar la eliminación en el historial.
            control.AgregarEliminacion(userId, DateTime.Now);
            detalle.FirmaControlJson = control.Serialize();

            detalle.FirmaPath = null;
            detalle.FechaModificacion = DateTime.Now;
            await _appContext.SaveChangesAsync(cancellationToken);

            EnrichWideEvent(action: "DeleteSignature", entityId: userId);
            return "Firma eliminada";
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "DeleteSignature", entityId: userId, exception: ex);
            return CommonErrors.DatabaseError("eliminar la firma digital");
        }
    }

    public async Task<ErrorOr<bool>> SolicitarCambioFirmaAsync(int userId, CancellationToken cancellationToken = default)
    {
        try
        {
            var detalle = await _appContext.UsuariosDetalle
                .FirstOrDefaultAsync(ud => ud.IdUsuario == userId, cancellationToken);

            if (detalle == null || string.IsNullOrEmpty(detalle.FirmaPath))
                return CommonErrors.NotFound("Firma");

            var control = FirmaControl.Parse(detalle.FirmaControlJson);

            if (control.CambioHabilitado)
                return CommonErrors.Validation("Firma.CambioYaHabilitado",
                    "Ya tienes un cambio de firma habilitado por Recursos Humanos.");

            if (control.SolicitudPendiente)
                return CommonErrors.Validation("Firma.SolicitudPendiente",
                    "Ya tienes una solicitud de cambio de firma pendiente.");

            control.AgregarSolicitud(userId, DateTime.Now);
            detalle.FirmaControlJson = control.Serialize();
            detalle.FechaModificacion = DateTime.Now;
            await _appContext.SaveChangesAsync(cancellationToken);

            EnrichWideEvent(action: "SolicitarCambioFirma", entityId: userId);

            // La notificación a RH no debe romper la solicitud si falla.
            await NotificarSolicitudRhAsync(userId, cancellationToken);

            return true;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "SolicitarCambioFirma", entityId: userId, exception: ex);
            return CommonErrors.DatabaseError("solicitar el cambio de firma");
        }
    }

    /// <summary>
    /// Notifica (in-app + correo) a los usuarios con permiso de habilitar cambios de firma.
    /// </summary>
    private async Task NotificarSolicitudRhAsync(int userId, CancellationToken cancellationToken)
    {
        try
        {
            var nombre = await _asokamContext.Usuarios
                .AsNoTracking()
                .Where(u => u.IdUsuario == userId)
                .Select(u => u.NombreCompleto)
                .FirstOrDefaultAsync(cancellationToken) ?? $"Usuario {userId}";

            var destinatarios = await GetUsuariosConPermisoAsync(
                Permissions.Usuarios.HabilitarCambioFirma, userId, cancellationToken);

            if (destinatarios.Count == 0)
            {
                EnrichWideEvent(action: "SolicitarCambioFirma.NotificacionSinDestinatarios", entityId: userId);
                return;
            }

            await _notificationService.SendAsync(new SendNotificationRequest
            {
                Title = "Solicitud de cambio de firma",
                Message = $"{nombre} solicita habilitar el cambio de su firma digital. " +
                          "Revísalo en la página de firmas de la aplicación de RH.",
                Type = "info",
                Category = "firmas",
                Priority = "normal",
                Channels =
                [
                    new NotificationChannelRequest { ChannelType = "in-app", UserIds = destinatarios },
                    new NotificationChannelRequest { ChannelType = "email", UserIds = destinatarios }
                ]
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "SolicitarCambioFirma.NotificacionError", entityId: userId, exception: ex);
        }
    }

    /// <summary>
    /// Notifica (in-app + correo) a los usuarios con permiso de habilitar cambios de firma
    /// que hay una firma con INE esperando comprobación.
    /// </summary>
    private async Task NotificarRemisionRhAsync(int userId, CancellationToken cancellationToken)
    {
        try
        {
            var nombre = await _asokamContext.Usuarios
                .AsNoTracking()
                .Where(u => u.IdUsuario == userId)
                .Select(u => u.NombreCompleto)
                .FirstOrDefaultAsync(cancellationToken) ?? $"Usuario {userId}";

            var destinatarios = await GetUsuariosConPermisoAsync(
                Permissions.Usuarios.HabilitarCambioFirma, userId, cancellationToken);

            if (destinatarios.Count == 0)
            {
                EnrichWideEvent(action: "RemisionFirma.NotificacionSinDestinatarios", entityId: userId);
                return;
            }

            await _notificationService.SendAsync(new SendNotificationRequest
            {
                Title = "Firma en comprobación",
                Message = $"{nombre} envió su firma digital con foto de INE para comprobación. " +
                          "Revísala en la página de firmas de la aplicación de RH.",
                Type = "info",
                Category = "firmas",
                Priority = "normal",
                Channels =
                [
                    new NotificationChannelRequest { ChannelType = "in-app", UserIds = destinatarios },
                    new NotificationChannelRequest { ChannelType = "email", UserIds = destinatarios }
                ]
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "RemisionFirma.NotificacionError", entityId: userId, exception: ex);
        }
    }

    /// <summary>
    /// Resuelve los usuarios que tienen un permiso, por rol o de forma directa
    /// (misma semántica que UserPermissionService: roles activos y permisos concedidos no expirados).
    /// </summary>
    private async Task<List<int>> GetUsuariosConPermisoAsync(string codigoPermiso, int excluirIdUsuario, CancellationToken cancellationToken)
    {
        var now = DateTime.Now;

        var rolIds = await _asokamContext.RolesPermisos
            .AsNoTracking()
            .Where(rp => rp.Permiso.EsActivo && rp.Permiso.CodigoPermiso == codigoPermiso)
            .Select(rp => rp.IdRol)
            .ToListAsync(cancellationToken);

        var porRol = await _asokamContext.UsuariosRoles
            .AsNoTracking()
            .Where(ur => rolIds.Contains(ur.IdRol)
                         && ur.Rol.EsActivo
                         && (ur.FechaExpiracion == null || ur.FechaExpiracion > now))
            .Select(ur => ur.IdUsuario)
            .ToListAsync(cancellationToken);

        var directos = await _asokamContext.UsuariosPermisos
            .AsNoTracking()
            .Where(up => up.EsConcedido
                         && up.Permiso.EsActivo
                         && up.Permiso.CodigoPermiso == codigoPermiso
                         && (up.FechaExpiracion == null || up.FechaExpiracion > now))
            .Select(up => up.IdUsuario)
            .ToListAsync(cancellationToken);

        return porRol.Concat(directos)
            .Where(id => id != excluirIdUsuario)
            .Distinct()
            .ToList();
    }

    private async Task<Domain.Entities.Catalogos.UsuarioDetalle> EnsureUsuarioDetalleAsync(int userId, CancellationToken cancellationToken)
    {
        var detalle = await _appContext.UsuariosDetalle
            .FirstOrDefaultAsync(ud => ud.IdUsuario == userId, cancellationToken);

        if (detalle != null)
            return detalle;

        var defaultEmpresa = await _appContext.Empresas.FirstOrDefaultAsync(cancellationToken);
        var defaultSucursal = defaultEmpresa != null
            ? await _appContext.Sucursales.FirstOrDefaultAsync(s => s.IdEmpresa == defaultEmpresa.IdEmpresa, cancellationToken)
            : null;

        detalle = new Domain.Entities.Catalogos.UsuarioDetalle
        {
            IdUsuario = userId,
            IdEmpresa = defaultEmpresa?.IdEmpresa ?? 1,
            IdSucursal = defaultSucursal?.IdSucursal ?? 1,
            FechaCreacion = DateTime.Now,
            FechaModificacion = DateTime.Now
        };

        _appContext.UsuariosDetalle.Add(detalle);
        await _appContext.SaveChangesAsync(cancellationToken);

        return detalle;
    }
}
