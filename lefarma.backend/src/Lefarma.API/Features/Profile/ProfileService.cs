using ErrorOr;
using Lefarma.API.Features.Profile.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Profile;

/// <summary>
/// Implementación del servicio de perfil de usuario
/// </summary>
public class ProfileService : BaseService, IProfileService
{
    private readonly AsokamDbContext _asokamContext;
    private readonly ApplicationDbContext _appContext;
    protected override string EntityName => "Profile";

    public ProfileService(
        AsokamDbContext asokamContext,
        ApplicationDbContext appContext,
        IWideEventAccessor wideEventAccessor)
        : base(wideEventAccessor)
    {
        _asokamContext = asokamContext;
        _appContext = appContext;
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

            // Obtener detalles del usuario
            var detalle = await _appContext.UsuariosDetalle
                .FirstOrDefaultAsync(ud => ud.IdUsuario == userId, cancellationToken);

            // Obtener roles activos del usuario
            var roles = await _asokamContext.UsuariosRoles
                .Include(ur => ur.Rol)
                .Where(ur => ur.IdUsuario == userId && ur.Rol.EsActivo)
                .Where(ur => ur.FechaExpiracion == null || ur.FechaExpiracion > DateTime.UtcNow)
                .Select(ur => ur.Rol.NombreRol)
                .ToListAsync(cancellationToken);

            // Obtener permisos (de roles + directos)
            var roleIds = await _asokamContext.UsuariosRoles
                .Where(ur => ur.IdUsuario == userId)
                .Select(ur => ur.IdRol)
                .ToListAsync(cancellationToken);

            var permisosFromRoles = await _asokamContext.RolesPermisos
                .Include(rp => rp.Permiso)
                .Where(rp => roleIds.Contains(rp.IdRol) && rp.Permiso.EsActivo)
                .Select(rp => rp.Permiso.CodigoPermiso)
                .ToListAsync(cancellationToken);

            var permisosDirectos = await _asokamContext.UsuariosPermisos
                .Include(up => up.Permiso)
                .Where(up => up.IdUsuario == userId && up.Permiso.EsActivo)
                .Where(up => up.FechaExpiracion == null || up.FechaExpiracion > DateTime.UtcNow)
                .Select(up => up.Permiso.CodigoPermiso)
                .ToListAsync(cancellationToken);

            var permisos = permisosFromRoles.Union(permisosDirectos).Distinct().ToList();

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
                Permisos = permisos,
                Detalle = detalle != null ? new UsuarioDetalleData
                {
                    IdCentroCosto = detalle.IdCentroCosto,
                    Puesto = detalle.Puesto,
                    NumeroEmpleado = detalle.NumeroEmpleado,
                    FirmaDigital = detalle.FirmaDigital,
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

            // Actualizar datos básicos del usuario
            if (!string.IsNullOrWhiteSpace(request.NombreCompleto))
                usuario.NombreCompleto = request.NombreCompleto;

            if (!string.IsNullOrWhiteSpace(request.Correo))
                usuario.Correo = request.Correo;

            // Actualizar o crear detalles del usuario
            var detalle = await _appContext.UsuariosDetalle
                .FirstOrDefaultAsync(ud => ud.IdUsuario == userId, cancellationToken);

            if (detalle == null)
            {
                // Si no existe detalle, no se puede actualizar (debería existir)
                EnrichWideEvent(action: "UpdateProfile", entityId: userId, additionalContext: new Dictionary<string, object>
                {
                    ["detalleNotFound"] = true
                });
                await _asokamContext.SaveChangesAsync(cancellationToken);
                return await GetProfileAsync(userId, cancellationToken);
            }

            // Actualizar campos de detalle (solo los que vienen en el request)
            if (request.IdCentroCosto.HasValue)
                detalle.IdCentroCosto = request.IdCentroCosto.Value;

            if (!string.IsNullOrWhiteSpace(request.Puesto))
                detalle.Puesto = request.Puesto;

            if (!string.IsNullOrWhiteSpace(request.NumeroEmpleado))
                detalle.NumeroEmpleado = request.NumeroEmpleado;

            if (!string.IsNullOrWhiteSpace(request.FirmaDigital))
                detalle.FirmaDigital = request.FirmaDigital;

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

            detalle.FechaModificacion = DateTime.UtcNow;

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
}
