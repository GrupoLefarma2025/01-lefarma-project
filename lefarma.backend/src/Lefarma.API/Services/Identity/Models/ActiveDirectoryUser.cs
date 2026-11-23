namespace Lefarma.API.Services.Identity.Models;

public class ActiveDirectoryUser
{
    public string SamAccountName { get; set; } = string.Empty;

    public string Dominio { get; set; } = string.Empty;

    public string? Mail { get; set; }

    public string? DisplayName { get; set; }

    public string? GivenName { get; set; }

    public string? Sn { get; set; }

    public string? Department { get; set; }

    public string? NumeroNomina { get; set; }

    public string? TelephoneNumber { get; set; }

    public string? UserPrincipalName { get; set; }

    public DateTime? LastLogon { get; set; }

    public string? TelefonoIP { get; set; }

    public string? Titulo { get; set; }
}
