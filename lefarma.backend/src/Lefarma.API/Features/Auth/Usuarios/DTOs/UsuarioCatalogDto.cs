namespace Lefarma.API.Features.Auth.Usuarios.DTOs;
public class UsuarioCatalogDto
{
    public int IdUsuario { get; set; }
    public string NombreCompleto { get; set; } = string.Empty;
    public string Correo { get; set; } = string.Empty;
}
