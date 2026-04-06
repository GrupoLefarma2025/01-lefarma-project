using Microsoft.AspNetCore.Authorization;

namespace Lefarma.API.Shared.Authorization;
/// <summary>
/// Shortcut attribute for permission-based authorization.
/// Usage: [HasPermission("catalogos.view")] at class or method level.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public class HasPermissionAttribute : AuthorizeAttribute
{
    public const string PolicyPrefix = "HasPermission_";

    public HasPermissionAttribute(string permission) : base($"{PolicyPrefix}{permission}")
    {
        Permission = permission;
    }

    public string Permission { get; }
}
