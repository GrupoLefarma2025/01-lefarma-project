using Lefarma.API.Services.Identity;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace Lefarma.API.Shared.Authorization;

public class PermissionHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly UserPermissionService _permissionService;

    public PermissionHandler(UserPermissionService permissionService)
    {
        _permissionService = permissionService;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
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

        if (permissions.Contains(requirement.Permission))
        {
            context.Succeed(requirement);
        }
    }
}
