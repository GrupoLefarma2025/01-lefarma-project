namespace Lefarma.API.Services.Identity;
public class LdapOptions
{
    public List<LdapDomainOptions> Domains { get; set; } = new();
}

public class LdapDomainOptions
{
    public string DomainName { get; set; } = string.Empty;

    public string Server { get; set; } = string.Empty;

    public int Port { get; set; } = 389;

    public string BaseDn { get; set; } = string.Empty;

    public int TimeoutSeconds { get; set; } = 10;
}
