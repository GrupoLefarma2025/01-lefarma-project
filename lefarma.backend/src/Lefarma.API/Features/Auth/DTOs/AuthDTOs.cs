using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.Auth.DTOs;
public class LoginStepOneRequest
{
    [Required(ErrorMessage = "El nombre de usuario es requerido")]
    public required string Username { get; set; }
}

public class LoginStepOneResponse
{
    public List<string> Domains { get; set; } = new();

    public bool RequiresDomainSelection { get; set; }

    public string? DisplayName { get; set; }
}

public class LoginStepTwoRequest
{
    [Required(ErrorMessage = "El nombre de usuario es requerido")]
    public required string Username { get; set; }

    [Required(ErrorMessage = "La contrasena es requerida")]
    public required string Password { get; set; }

    [Required(ErrorMessage = "El dominio es requerido")]
    public required string Domain { get; set; }
}

public class LoginResponse
{
    public string AccessToken { get; set; } = string.Empty;

    public string RefreshToken { get; set; } = string.Empty;

    public string TokenType { get; set; } = "Bearer";

    public int ExpiresIn { get; set; }

    public UserInfo User { get; set; } = new();
}

public class UserInfo
{
    public int Id { get; set; }

    public string Username { get; set; } = string.Empty;

    public string? Nombre { get; set; }

    public string? Correo { get; set; }

    public string? Dominio { get; set; }

    public string? Puesto { get; set; }

    public List<RoleInfo> Roles { get; set; } = new();

    public List<PermissionInfo> Permisos { get; set; } = new();
}

public class RoleInfo
{
    public int IdRol { get; set; }

    public string NombreRol { get; set; } = string.Empty;

    public string? Descripcion { get; set; }
}

public class PermissionInfo
{
    public int IdPermiso { get; set; }

    public string CodigoPermiso { get; set; } = string.Empty;

    public string NombrePermiso { get; set; } = string.Empty;

    public string? Categoria { get; set; }

    public string? Recurso { get; set; }

    public string? Accion { get; set; }
}

public class RefreshTokenRequest
{
    [Required(ErrorMessage = "El refresh token es requerido")]
    public required string RefreshToken { get; set; }
}

public class LogoutRequest
{
    public string? RefreshToken { get; set; }
}

public class LogoutResponse
{
    public bool Success { get; set; }

    public string Message { get; set; } = string.Empty;
}
