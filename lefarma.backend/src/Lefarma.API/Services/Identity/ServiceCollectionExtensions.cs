using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Lefarma.API.Services.Identity;
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddActiveDirectoryServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<LdapOptions>(
            configuration.GetSection("Ldap"));

        services.AddScoped<IActiveDirectoryService, ActiveDirectoryService>();

        return services;
    }

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
