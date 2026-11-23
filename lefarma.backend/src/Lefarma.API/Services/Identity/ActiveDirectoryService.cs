using System.DirectoryServices.Protocols;
using System.Net;
using ErrorOr;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Services.Identity.Models;
using Lefarma.API.Shared.Errors;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Services.Identity;
public class ActiveDirectoryService : IActiveDirectoryService
{
    private readonly LdapOptions _options;
    private readonly ILogger<ActiveDirectoryService> _logger;
    private readonly AsokamDbContext _db;
    private readonly IReadOnlyDictionary<string, LdapDomainOptions> _domainsByCode;

    public ActiveDirectoryService(
        IOptions<LdapOptions> options,
        ILogger<ActiveDirectoryService> logger,
        AsokamDbContext db)
    {
        _options = options.Value;
        _logger = logger;
        _db = db;
        _domainsByCode = _options.Domains
            .GroupBy(d => d.DomainName.ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
    }

    public IReadOnlyList<LdapDomainOptions> GetConfiguredDomains()
    {
        return _options.Domains.AsReadOnly();
    }

    public async Task<DominioConfig?> GetDominioConfigByDominioAsync(string dominio, CancellationToken cancellationToken = default)
    {
        return await _db.DominioConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(dc => dc.Dominio == dominio, cancellationToken);
    }

    public async Task<ErrorOr<bool>> AuthenticateAsync(
        string username,
        string password,
        string domain,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return CommonErrors.Validation("username", "El nombre de usuario es requerido");
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            return CommonErrors.Validation("password", "La contrasena es requerida");
        }

        var domainConfig = await GetDominioConfigByDominioAsync(domain, cancellationToken);
        if (domainConfig == null)
        {
            _logger.LogWarning("Dominio no configurado: {Domain}", domain);
            return CommonErrors.NotFound("dominio", domain);
        }

        try
        {
            var result = await Task.Run(
                () => ValidateCredentialsInternalAsync(username, password, domainConfig),
                cancellationToken);

            return result;
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Operacion de autenticacion cancelada para usuario {Username}", username);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error inesperado al autenticar usuario {Username} en dominio {Domain}",
                username, domain);
            return CommonErrors.InternalServerError("Error al autenticar el usuario");
        }
    }

    public async Task<ErrorOr<ActiveDirectoryUser?>> GetUserAsync(
        string username,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return CommonErrors.Validation("username", "El nombre de usuario es requerido");
        }

        try
        {

            await Task.CompletedTask;
            _logger.LogDebug("GetUserAsync llamado para usuario {Username}", username);

            return (ActiveDirectoryUser?)null;
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Operacion de obtencion de usuario cancelada para {Username}", username);
            return (ActiveDirectoryUser?)null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener informacion del usuario {Username}", username);
            return CommonErrors.InternalServerError("Error al obtener informacion del usuario");
        }
    }

    private bool ValidateCredentialsInternalAsync(
        string username,
        string password,
        DominioConfig domainConfig)
    {
        var domainBaseDn = BuildBaseDn(domainConfig);

        _logger.LogInformation(
            "ValidateCredentialsAsync: Server={Server}:{Port}, Domain={Domain}, User={User}, BaseDN={BaseDN}",
            domainConfig.Servidor, domainConfig.Puerto, domainConfig.Dominio, username, domainBaseDn);

        try
        {
            using var connection = new LdapConnection(
                new LdapDirectoryIdentifier(domainConfig.Servidor, domainConfig.Puerto));

            connection.SessionOptions.ProtocolVersion = 3;
            connection.SessionOptions.SecureSocketLayer = false;
            connection.AuthType = domainConfig.AuthType == 1
                ? AuthType.Basic
                : AuthType.Negotiate;

            var timeoutSeconds = 30;
            connection.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
            connection.SessionOptions.SendTimeout = TimeSpan.FromSeconds(timeoutSeconds);
            connection.SessionOptions.TcpKeepAlive = false;

            var userPrincipalName = $"{username}@{domainConfig.Dominio.ToLowerInvariant()}.{domainConfig.BaseDn}";
            var credential = new NetworkCredential(userPrincipalName, password);

            _logger.LogDebug("Intentando bind LDAP con UPN: {UPN} en {Server}:{Port}",
                userPrincipalName, domainConfig.Servidor, domainConfig.Puerto);

            connection.Bind(credential);

            _logger.LogDebug("Bind exitoso para {UPN}", userPrincipalName);

            _logger.LogInformation(
                "Autenticacion exitosa para usuario {Username} en servidor {Server}:{Port}",
                username, domainConfig.Servidor, domainConfig.Puerto);
            return true;
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(
                "Fallo de autenticacion LDAP para usuario {Username} en servidor {Server}:{Port} - {Error}",
                username, domainConfig.Servidor, domainConfig.Puerto, ex.Message);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error inesperado al autenticar usuario {Username} en servidor {Server}:{Port}",
                username, domainConfig.Servidor, domainConfig.Puerto);
            return false;
        }
    }

    private static string BuildBaseDn(DominioConfig config)
    {
        var parts = new List<string> { $"DC={config.Dominio.ToLowerInvariant()}" };
        parts.AddRange(config.BaseDn!.Split('.').Select(p => $"DC={p.ToLowerInvariant()}"));
        return string.Join(",", parts);
    }

    private static string EscapeLdapFilter(string value)
    {
        if (string.IsNullOrEmpty(value))
            return value;

        var escaped = new System.Text.StringBuilder();
        foreach (var c in value)
        {
            switch (c)
            {
                case '*':
                    escaped.Append("\\2a");
                    break;
                case '(':
                    escaped.Append("\\28");
                    break;
                case ')':
                    escaped.Append("\\29");
                    break;
                case '\\':
                    escaped.Append("\\5c");
                    break;
                case '\0':
                    escaped.Append("\\00");
                    break;
                default:
                    escaped.Append(c);
                    break;
            }
        }
        return escaped.ToString();
    }
}
