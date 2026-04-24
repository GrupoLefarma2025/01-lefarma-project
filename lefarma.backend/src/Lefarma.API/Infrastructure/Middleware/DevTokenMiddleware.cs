using System.Security.Claims;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Infrastructure.Middleware;
public sealed class DevTokenMiddleware
{
    private const string DevTokenHeader = "X-Dev-Token";
    private readonly RequestDelegate _next;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DevTokenMiddleware> _logger;
    private readonly bool _isDevelopment;

    public DevTokenMiddleware(
        RequestDelegate next,
        IConfiguration configuration,
        ILogger<DevTokenMiddleware> logger,
        IHostEnvironment env)
    {
        _next = next;
        _configuration = configuration;
        _logger = logger;
        _isDevelopment = env.IsDevelopment();
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!_isDevelopment)
        {
            await _next(context);
            return;
        }

        var devTokenValue = _configuration["DevToken:Value"];
        if (string.IsNullOrEmpty(devTokenValue))
        {
            await _next(context);
            return;
        }

        var providedToken = context.Request.Headers[DevTokenHeader].FirstOrDefault();
        if (string.IsNullOrEmpty(providedToken) || providedToken != devTokenValue)
        {
            await _next(context);
            return;
        }

        var impersonateUserIdStr = _configuration["DevToken:ImpersonateUserId"];
        if (string.IsNullOrEmpty(impersonateUserIdStr) || !int.TryParse(impersonateUserIdStr, out var impersonateUserId))
        {
            _logger.LogWarning("DevToken: ImpersonateUserId not configured or invalid");
            await _next(context);
            return;
        }

        var db = context.RequestServices.GetRequiredService<AsokamDbContext>();
        var usuario = await db.Usuarios
            .Include(u => u.UsuariosRoles.Where(ur => ur.FechaExpiracion == null || ur.FechaExpiracion > DateTime.UtcNow))
                .ThenInclude(ur => ur.Rol)
                    .ThenInclude(r => r.RolesPermisos)
                        .ThenInclude(rp => rp.Permiso)
            .Include(u => u.UsuariosPermisos.Where(up => up.FechaExpiracion == null || up.FechaExpiracion > DateTime.UtcNow))
                .ThenInclude(up => up.Permiso)
            .FirstOrDefaultAsync(u => u.IdUsuario == impersonateUserId);

        if (usuario == null)
        {
            _logger.LogWarning("DevToken: User with ID {UserId} not found for impersonation", impersonateUserId);
            await _next(context);
            return;
        }

        if (!usuario.EsActivo)
        {
            _logger.LogWarning("DevToken: User {UserId} is inactive, cannot impersonate", impersonateUserId);
            await _next(context);
            return;
        }

        var activeRoles = usuario.UsuariosRoles
            .Where(ur => ur.Rol.EsActivo)
            .Select(ur => ur.Rol)
            .ToList();

        var roles = activeRoles
            .Select(r => r.NombreRol)
            .ToList();

        var permissionsFromRoles = activeRoles
            .SelectMany(r => r.RolesPermisos)
            .Where(rp => rp.Permiso.EsActivo)
            .Select(rp => rp.Permiso.CodigoPermiso);

        var directPermissions = usuario.UsuariosPermisos
            .Where(up => up.Permiso.EsActivo)
            .Select(up => up.Permiso.CodigoPermiso);

        var allPermissions = permissionsFromRoles
            .Union(directPermissions)
            .Distinct()
            .ToList();

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, usuario.IdUsuario.ToString()),
            new(ClaimTypes.Name, usuario.SamAccountName ?? usuario.NombreCompleto ?? usuario.IdUsuario.ToString()),
            new("sub", usuario.IdUsuario.ToString()),
            new("jti", Guid.NewGuid().ToString()),
            new("iat", new DateTimeOffset(DateTime.UtcNow).ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            new("dev_token", "true")
        };

        if (!string.IsNullOrWhiteSpace(usuario.Correo))
        {
            claims.Add(new Claim(ClaimTypes.Email, usuario.Correo));
        }

        if (!string.IsNullOrWhiteSpace(usuario.Dominio))
        {
            claims.Add(new Claim("domain", usuario.Dominio));
        }

        foreach (var role in roles)
        {
            if (!string.IsNullOrWhiteSpace(role))
            {
                claims.Add(new Claim(ClaimTypes.Role, role));
            }
        }

        foreach (var permission in allPermissions)
        {
            if (!string.IsNullOrWhiteSpace(permission))
            {
                claims.Add(new Claim("permission", permission));
            }
        }

        var identity = new ClaimsIdentity(claims, "DevToken");
        var principal = new ClaimsPrincipal(identity);

        context.User = principal;

        _logger.LogInformation(
            "DevToken: Impersonating user {UserId} ({Username}) with {RoleCount} roles and {PermissionCount} permissions",
            usuario.IdUsuario,
            usuario.SamAccountName,
            roles.Count,
            allPermissions.Count);

        await _next(context);
    }
}

public static class DevTokenMiddlewareExtensions
{
    public static IApplicationBuilder UseDevToken(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<DevTokenMiddleware>();
    }
}
