using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Lefarma.API.Services.Identity;

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
        var directPermissions = await _db.UsuariosPermisos
            .Where(up => up.IdUsuario == userId
                         && up.Permiso.EsActivo
                         && (up.FechaExpiracion == null || up.FechaExpiracion > now))
            .Select(up => new { up.EsConcedido, up.Permiso.CodigoPermiso })
            .ToListAsync();

        var denied = directPermissions
            .Where(up => !up.EsConcedido)
            .Select(up => up.CodigoPermiso)
            .ToHashSet(StringComparer.Ordinal);

        var grantedDirectly = directPermissions
            .Where(up => up.EsConcedido)
            .Select(up => up.CodigoPermiso);

        return rolePermissions
            .Where(codigo => !denied.Contains(codigo))
            .Concat(grantedDirectly)
            .ToHashSet(StringComparer.Ordinal);
    }
}
