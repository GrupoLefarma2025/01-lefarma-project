using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Lefarma.API.Services.Identity;

/// <summary>
/// Shared permission cache for both PermissionHandler and the my-permissions endpoint.
/// Single source of truth for "what permissions does user X have right now".
/// Cache duration: 5 minutes. Changes in app.RolesPermisos / app.UsuariosPermisos
/// are reflected within that window with no restart or re-login.
/// </summary>
public class UserPermissionService
{
    private readonly AsokamDbContext _db;
    private readonly IMemoryCache _cache;
    public static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

    public UserPermissionService(AsokamDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    /// <summary>
    /// Returns the set of permission codes for a user. Uses the shared IMemoryCache
    /// with key "user_permissions_{userId}" — the same key the PermissionHandler uses.
    /// </summary>
    public async Task<HashSet<string>> GetPermissionsAsync(int userId)
    {
        var cacheKey = $"user_permissions_{userId}";
        if (_cache.TryGetValue(cacheKey, out HashSet<string>? cached) && cached is not null)
        {
            return cached;
        }

        var permissions = await LoadFromDbAsync(userId);
        _cache.Set(cacheKey, permissions, CacheDuration);
        return permissions;
    }

    /// <summary>
    /// Force-refresh a user's permissions (call when admin changes their roles/permissions).
    /// </summary>
    public async Task<HashSet<string>> RefreshAsync(int userId)
    {
        var permissions = await LoadFromDbAsync(userId);
        _cache.Set($"user_permissions_{userId}", permissions, CacheDuration);
        return permissions;
    }

    private async Task<HashSet<string>> LoadFromDbAsync(int userId)
    {
        var roleIds = await _db.UsuariosRoles
            .Where(ur => ur.IdUsuario == userId && ur.Rol.EsActivo)
            .Select(ur => ur.IdRol)
            .ToListAsync();

        var rolePermissions = await _db.RolesPermisos
            .Where(rp => roleIds.Contains(rp.IdRol) && rp.Permiso.EsActivo)
            .Select(rp => rp.Permiso.CodigoPermiso)
            .ToListAsync();

        var now = DateTime.UtcNow;
        var userPermissions = await _db.UsuariosPermisos
            .Where(up => up.IdUsuario == userId
                         && up.Permiso.EsActivo
                         && up.EsConcedido
                         && (up.FechaExpiracion == null || up.FechaExpiracion > now))
            .Select(up => up.Permiso.CodigoPermiso)
            .ToListAsync();

        return new HashSet<string>(rolePermissions.Concat(userPermissions), StringComparer.Ordinal);
    }
}
