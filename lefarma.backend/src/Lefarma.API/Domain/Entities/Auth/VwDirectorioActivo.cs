using System.ComponentModel.DataAnnotations.Schema;

namespace Lefarma.API.Domain.Entities.Auth;
/// <summary>
/// Entity representing the vwDirectorioActivo view from the linked server.
/// This view provides read-only access to Active Directory user information.
/// </summary>
[Table("vwDirectorioActivo")]
public class VwDirectorioActivo
{
    /// <summary>
    /// The sAMAccountName (username) of the user.
    /// </summary>
    [Column("samAccountName")]
    public string? SamAccountName { get; set; }

    /// <summary>
    /// The domain the user belongs to.
    /// </summary>
    [Column("dominio")]
    public string? Dominio { get; set; }

    /// <summary>
    /// User's email address.
    /// </summary>
    [Column("mail")]
    public string? Mail { get; set; }

    /// <summary>
    /// User's display name.
    /// </summary>
    [Column("displayName")]
    public string? DisplayName { get; set; }

    /// <summary>
    /// User's first name (given name).
    /// </summary>
    [Column("givenName")]
    public string? GivenName { get; set; }

    /// <summary>
    /// User's last name (surname).
    /// </summary>
    [Column("sn")]
    public string? Sn { get; set; }

    /// <summary>
    /// User's department.
    /// </summary>
    [Column("department")]
    public string? Department { get; set; }

    /// <summary>
    /// User's payroll number.
    /// </summary>
    [Column("numeroNomina")]
    public string? NumeroNomina { get; set; }

    /// <summary>
    /// User's telephone number.
    /// </summary>
    [Column("telephoneNumber")]
    public string? TelephoneNumber { get; set; }

    /// <summary>
    /// User's user principal name (email format).
    /// </summary>
    [Column("userPrincipalName")]
    public string? UserPrincipalName { get; set; }

    /// <summary>
    /// Last logon time.
    /// </summary>
    [Column("LastLogon")]
    public DateTime? LastLogon { get; set; }

    /// <summary>
    /// IP phone number.
    /// </summary>
    [Column("TelefonoIP")]
    public string? TelefonoIP { get; set; }

    /// <summary>
    /// User's title/job title.
    /// </summary>
    [Column("Titulo")]
    public string? Titulo { get; set; }
}
