using System.Security.Claims;
using Lefarma.API.Services.Identity;
using Microsoft.AspNetCore.Authorization;

namespace Lefarma.API.Shared.Authorization;

public class AnyPermissionHandler : AuthorizationHandler<AnyPermissionRequirement>
{
    private readonly UserPermissionService _permissionService;

    public AnyPermissionHandler(UserPermissionService permissionService)
    {
        _permissionService = permissionService;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        AnyPermissionRequirement requirement)
    {
        if (context.User?.Identity?.IsAuthenticated != true)
        {
            return;
        }

        var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                          ?? context.User.FindFirst("sub")?.Value;
        if (userIdClaim == null || !int.TryParse(userIdClaim, out var userId))
        {
            return;
        }

        var permissions = await _permissionService.GetPermissionsAsync(userId);

        if (requirement.Permissions.Any(permissions.Contains))
        {
            context.Succeed(requirement);
        }
    }
}
