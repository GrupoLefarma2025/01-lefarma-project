namespace Lefarma.API.Features.Auth.Usuarios.DTOs;

/// <summary>
/// DTO for Usuario catalog (simplified for dropdown/selection)
/// </summary>
public class UsuarioCatalogDto
{
    public int IdUsuario { get; set; }
    public string NombreCompleto { get; set; } = string.Empty;
    public string Correo { get; set; } = string.Empty;
}
