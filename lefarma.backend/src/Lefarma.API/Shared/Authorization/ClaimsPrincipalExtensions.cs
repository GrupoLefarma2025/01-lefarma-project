using System.Security.Claims;

namespace Lefarma.API.Shared.Authorization;

public static class ClaimsPrincipalExtensions
{
    private const string PermissionClaimType = "permission";

    public static bool TienePermiso(this ClaimsPrincipal principal, string permiso)
    {
        if (principal is null || string.IsNullOrEmpty(permiso))
        {
            return false;
        }

        return principal.Claims.Any(c => c.Type == PermissionClaimType && c.Value == permiso);
    }

    public static int GetUserId(this ClaimsPrincipal principal)
    {
        if (principal is null)
        {
            return 0;
        }

        return int.TryParse(principal.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
    }
}