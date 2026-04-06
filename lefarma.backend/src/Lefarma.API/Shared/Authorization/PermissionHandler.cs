using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace Lefarma.API.Shared.Authorization;
/// <summary>
/// Handles permission-based authorization by checking for permission claims in the JWT token.
/// </summary>
public class PermissionHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        if (context.User?.Identity?.IsAuthenticated != true)
        {
            return Task.CompletedTask;
        }

        var permissionClaim = context.User.FindFirst("permission");
        if (permissionClaim != null && permissionClaim.Value == requirement.Permission)
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        var permissions = context.User.Claims
            .Where(c => c.Type == "permission")
            .Select(c => c.Value)
            .ToList();

        if (permissions.Contains(requirement.Permission))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
