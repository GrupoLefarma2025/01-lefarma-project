using Microsoft.AspNetCore.Authorization;

namespace Lefarma.API.Shared.Authorization;

/// <summary>
/// Requires at least one of the provided permissions (OR semantics).
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class HasAnyPermissionAttribute : AuthorizeAttribute
{
    public const string PolicyPrefix = "HasAnyPermission_";

    public IReadOnlyList<string> Permissions { get; }

    public HasAnyPermissionAttribute(params string[] permissions)
        : base($"{PolicyPrefix}{string.Join('|', permissions)}")
    {
        Permissions = permissions;
    }
}
