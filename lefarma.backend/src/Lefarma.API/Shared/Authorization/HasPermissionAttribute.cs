using Microsoft.AspNetCore.Authorization;

namespace Lefarma.API.Shared.Authorization;
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
