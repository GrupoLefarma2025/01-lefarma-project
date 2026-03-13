using System.DirectoryServices.Protocols;
using System.Net;
using ErrorOr;
using Lefarma.API.Services.Identity.Models;
using Lefarma.API.Shared.Errors;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Services.Identity;

/// <summary>
/// Service for LDAP/Active Directory authentication and user management.
/// Uses System.DirectoryServices.Protocols for cross-platform LDAP support.
/// </summary>
public class ActiveDirectoryService : IActiveDirectoryService
{
    private readonly LdapOptions _options;
    private readonly ILogger<ActiveDirectoryService> _logger;
    private readonly IReadOnlyDictionary<string, LdapDomainOptions> _domainsByCode;

    public ActiveDirectoryService(
        IOptions<LdapOptions> options,
        ILogger<ActiveDirectoryService> logger)
    {
        _options = options.Value;
        _logger = logger;
        _domainsByCode = _options.Domains
            .GroupBy(d => d.DomainName.ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
    }

    /// <inheritdoc />
    public IReadOnlyList<LdapDomainOptions> GetConfiguredDomains()
    {
        return _options.Domains.AsReadOnly();
    }

    /// <inheritdoc />
    public LdapDomainOptions? GetDomainConfig(string domainName)
    {
        return _domainsByCode.TryGetValue(domainName.ToLowerInvariant(), out var config)
            ? config
            : null;
    }

    /// <inheritdoc />
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

        var domainConfig = GetDomainConfig(domain);
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

    /// <inheritdoc />
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
            // User information is retrieved from vwDirectorioActivo view
            // This method should be called from a service that has access to the database
            // The actual database query will be handled by a separate repository/service
            // This is a placeholder that should be implemented with actual database access

            await Task.CompletedTask;
            _logger.LogDebug("GetUserAsync llamado para usuario {Username}", username);

            // Return null - actual implementation should query vwDirectorioActivo
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

    /// <summary>
    /// Internal method to validate credentials against LDAP.
    /// </summary>
    private bool ValidateCredentialsInternalAsync(
        string username,
        string password,
        LdapDomainOptions domainConfig)
    {
        // Build the base DN for the domain
        // Example: domain "asokam" with BaseDn "com.mx" -> DC=asokam,DC=com,DC=mx
        var domainBaseDn = BuildBaseDn(domainConfig);

        _logger.LogInformation(
            "ValidateCredentialsAsync: Server={Server}:{Port}, Domain={Domain}, User={User}, BaseDN={BaseDN}",
            domainConfig.Server, domainConfig.Port, domainConfig.DomainName, username, domainBaseDn);

        try
        {
            using var connection = new LdapConnection(
                new LdapDirectoryIdentifier(domainConfig.Server, domainConfig.Port));

            connection.SessionOptions.ProtocolVersion = 3;
            connection.SessionOptions.SecureSocketLayer = false;
            connection.AuthType = AuthType.Basic;

            // Configure timeouts to prevent blocking
            connection.Timeout = TimeSpan.FromSeconds(domainConfig.TimeoutSeconds);
            connection.SessionOptions.SendTimeout = TimeSpan.FromSeconds(domainConfig.TimeoutSeconds);
            connection.SessionOptions.TcpKeepAlive = false;

            // Build the User Principal Name (UPN)
            // Format: username@domain.basedn (e.g., usuario@asokam.com.mx)
            var userPrincipalName = $"{username}@{domainConfig.DomainName.ToLowerInvariant()}.{domainConfig.BaseDn}";
            var credential = new NetworkCredential(userPrincipalName, password);

            _logger.LogDebug("Intentando bind LDAP con UPN: {UPN} en {Server}:{Port}",
                userPrincipalName, domainConfig.Server, domainConfig.Port);

            connection.Bind(credential);

            _logger.LogDebug("Bind exitoso para {UPN}", userPrincipalName);

            // Bind successful - authentication complete
            _logger.LogInformation(
                "Autenticacion exitosa para usuario {Username} en servidor {Server}:{Port}",
                username, domainConfig.Server, domainConfig.Port);
            return true;
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(
                "Fallo de autenticacion LDAP para usuario {Username} en servidor {Server}:{Port} - {Error}",
                username, domainConfig.Server, domainConfig.Port, ex.Message);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error inesperado al autenticar usuario {Username} en servidor {Server}:{Port}",
                username, domainConfig.Server, domainConfig.Port);
            return false;
        }
    }

    /// <summary>
    /// Builds the base DN from domain configuration.
    /// Example: domain "asokam" with BaseDn "com.mx" -> DC=asokam,DC=com,DC=mx
    /// </summary>
    private static string BuildBaseDn(LdapDomainOptions config)
    {
        var parts = new List<string> { $"DC={config.DomainName.ToLowerInvariant()}" };
        parts.AddRange(config.BaseDn.Split('.').Select(p => $"DC={p.ToLowerInvariant()}"));
        return string.Join(",", parts);
    }

    /// <summary>
    /// Escapes special characters in LDAP filter values.
    /// </summary>
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
