using Microsoft.AspNetCore.Authorization;

namespace Lefarma.API.Shared.Authorization;

/// <summary>
/// Permission requirement that succeeds when the user has at least one of the
/// listed permission codes (OR semantics).
/// </summary>
public class AnyPermissionRequirement : IAuthorizationRequirement
{
    public IReadOnlyList<string> Permissions { get; }

    public AnyPermissionRequirement(IEnumerable<string> permissions)
    {
        Permissions = permissions.Where(p => !string.IsNullOrWhiteSpace(p)).ToArray();
    }
}
