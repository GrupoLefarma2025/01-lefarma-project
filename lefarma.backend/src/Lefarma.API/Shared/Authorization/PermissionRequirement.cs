using Microsoft.AspNetCore.Authorization;

namespace Lefarma.API.Shared.Authorization;
public class PermissionRequirement : IAuthorizationRequirement
{
    public string Permission { get; }

    public PermissionRequirement(string permission)
    {
        Permission = permission;
    }
}
