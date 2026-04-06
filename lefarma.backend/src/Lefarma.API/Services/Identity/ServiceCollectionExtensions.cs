using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Lefarma.API.Services.Identity;
/// <summary>
/// Extension methods for configuring Identity services.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Adds Active Directory/LDAP authentication services.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">The configuration.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddActiveDirectoryServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<LdapOptions>(
            configuration.GetSection("Ldap"));

        services.AddScoped<IActiveDirectoryService, ActiveDirectoryService>();

        return services;
    }

    /// <summary>
    /// Adds JWT token services.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">The configuration.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddJwtTokenServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<JwtSettings>(
            configuration.GetSection("JwtSettings"));

        services.AddScoped<ITokenService, TokenService>();

        return services;
    }
}
