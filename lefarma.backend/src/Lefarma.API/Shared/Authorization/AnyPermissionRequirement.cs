using Microsoft.AspNetCore.Authorization;

namespace Lefarma.API.Shared.Authorization;

public class AnyPermissionRequirement : IAuthorizationRequirement
{
    public IReadOnlyList<string> Permissions { get; }

    public AnyPermissionRequirement(IEnumerable<string> permissions)
    {
        Permissions = permissions.Where(p => !string.IsNullOrWhiteSpace(p)).ToArray();
    }
}
