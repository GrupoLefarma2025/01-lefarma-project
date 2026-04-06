namespace Lefarma.API.Services.Identity;
/// <summary>
/// Configuration options for LDAP/Active Directory connections.
/// </summary>
public class LdapOptions
{
    /// <summary>
    /// List of LDAP domain configurations.
    /// </summary>
    public List<LdapDomainOptions> Domains { get; set; } = new();
}

/// <summary>
/// Configuration for a single LDAP domain.
/// </summary>
public class LdapDomainOptions
{
    /// <summary>
    /// Domain name (e.g., "Asokam", "Artricenter").
    /// </summary>
    public string DomainName { get; set; } = string.Empty;

    /// <summary>
    /// LDAP server hostname or IP address.
    /// </summary>
    public string Server { get; set; } = string.Empty;

    /// <summary>
    /// LDAP server port (default: 389).
    /// </summary>
    public int Port { get; set; } = 389;

    /// <summary>
    /// Base DN for the domain (e.g., "com.mx" for asokam.com.mx).
    /// </summary>
    public string BaseDn { get; set; } = string.Empty;

    /// <summary>
    /// Connection timeout in seconds.
    /// </summary>
    public int TimeoutSeconds { get; set; } = 10;
}
