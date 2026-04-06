namespace Lefarma.API.Features.Auth.Roles.DTOs;
/// <summary>
/// DTO for Rol catalog (simplified for dropdown/selection)
/// </summary>
public class RolCatalogDto
{
    public int IdRol { get; set; }
    public string NombreRol { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
}
