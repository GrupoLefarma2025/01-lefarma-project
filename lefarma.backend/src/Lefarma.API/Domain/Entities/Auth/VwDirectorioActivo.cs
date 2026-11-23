using System.ComponentModel.DataAnnotations.Schema;

namespace Lefarma.API.Domain.Entities.Auth;
[Table("vwDirectorioActivo")]
public class VwDirectorioActivo
{
    [Column("samAccountName")]
    public string? SamAccountName { get; set; }

    [Column("dominio")]
    public string? Dominio { get; set; }

    [Column("mail")]
    public string? Mail { get; set; }

    [Column("displayName")]
    public string? DisplayName { get; set; }

    [Column("givenName")]
    public string? GivenName { get; set; }

    [Column("sn")]
    public string? Sn { get; set; }

    [Column("department")]
    public string? Department { get; set; }

    [Column("numeroNomina")]
    public string? NumeroNomina { get; set; }

    [Column("telephoneNumber")]
    public string? TelephoneNumber { get; set; }

    [Column("userPrincipalName")]
    public string? UserPrincipalName { get; set; }

    [Column("LastLogon")]
    public DateTime? LastLogon { get; set; }

    [Column("TelefonoIP")]
    public string? TelefonoIP { get; set; }

    [Column("Titulo")]
    public string? Titulo { get; set; }
}
