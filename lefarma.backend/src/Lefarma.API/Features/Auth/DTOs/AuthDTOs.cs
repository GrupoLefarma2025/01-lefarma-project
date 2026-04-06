using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.Auth.DTOs;
/// <summary>
/// Request for login step one - find user domains
/// </summary>
public class LoginStepOneRequest
{
    /// <summary>
    /// The sAMAccountName (username) to look up
    /// </summary>
    [Required(ErrorMessage = "El nombre de usuario es requerido")]
    public required string Username { get; set; }
}

/// <summary>
/// Response for login step one - available domains for user
/// </summary>
public class LoginStepOneResponse
{
    /// <summary>
    /// List of domains where the user exists
    /// </summary>
    public List<string> Domains { get; set; } = new();

    /// <summary>
    /// Whether domain selection is required (true if multiple domains)
    /// </summary>
    public bool RequiresDomainSelection { get; set; }

    /// <summary>
    /// User display name from Active Directory (if available)
    /// </summary>
    public string? DisplayName { get; set; }
}

/// <summary>
/// Request for login step two - authenticate with credentials
/// </summary>
public class LoginStepTwoRequest
{
    /// <summary>
    /// The sAMAccountName (username)
    /// </summary>
    [Required(ErrorMessage = "El nombre de usuario es requerido")]
    public required string Username { get; set; }

    /// <summary>
    /// The user's password
    /// </summary>
    [Required(ErrorMessage = "La contrasena es requerida")]
    public required string Password { get; set; }

    /// <summary>
    /// The domain to authenticate against
    /// </summary>
    [Required(ErrorMessage = "El dominio es requerido")]
    public required string Domain { get; set; }
}

/// <summary>
/// Response for successful login
/// </summary>
public class LoginResponse
{
    /// <summary>
    /// JWT access token
    /// </summary>
    public string AccessToken { get; set; } = string.Empty;

    /// <summary>
    /// Refresh token for obtaining new access tokens
    /// </summary>
    public string RefreshToken { get; set; } = string.Empty;

    /// <summary>
    /// Token type (typically "Bearer")
    /// </summary>
    public string TokenType { get; set; } = "Bearer";

    /// <summary>
    /// Access token expiration in seconds
    /// </summary>
    public int ExpiresIn { get; set; }

    /// <summary>
    /// Authenticated user information
    /// </summary>
    public UserInfo User { get; set; } = new();
}

/// <summary>
/// User information returned after successful authentication
/// </summary>
public class UserInfo
{
    /// <summary>
    /// User ID in the application
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// User's sAMAccountName
    /// </summary>
    public string Username { get; set; } = string.Empty;

    /// <summary>
    /// User's full name
    /// </summary>
    public string? Nombre { get; set; }

    /// <summary>
    /// User's email address
    /// </summary>
    public string? Correo { get; set; }

    /// <summary>
    /// User's domain
    /// </summary>
    public string? Dominio { get; set; }

    /// <summary>
    /// User's assigned roles
    /// </summary>
    public List<RoleInfo> Roles { get; set; } = new();

    /// <summary>
    /// User's effective permissions
    /// </summary>
    public List<PermissionInfo> Permisos { get; set; } = new();
}

/// <summary>
/// Role information
/// </summary>
public class RoleInfo
{
    /// <summary>
    /// Role ID
    /// </summary>
    public int IdRol { get; set; }

    /// <summary>
    /// Role name
    /// </summary>
    public string NombreRol { get; set; } = string.Empty;

    /// <summary>
    /// Role description
    /// </summary>
    public string? Descripcion { get; set; }
}

/// <summary>
/// Permission information
/// </summary>
public class PermissionInfo
{
    /// <summary>
    /// Permission ID
    /// </summary>
    public int IdPermiso { get; set; }

    /// <summary>
    /// Permission code (unique identifier)
    /// </summary>
    public string CodigoPermiso { get; set; } = string.Empty;

    /// <summary>
    /// Permission display name
    /// </summary>
    public string NombrePermiso { get; set; } = string.Empty;

    /// <summary>
    /// Permission category
    /// </summary>
    public string? Categoria { get; set; }

    /// <summary>
    /// Resource this permission applies to
    /// </summary>
    public string? Recurso { get; set; }

    /// <summary>
    /// Action allowed (e.g., "read", "write", "delete")
    /// </summary>
    public string? Accion { get; set; }
}

/// <summary>
/// Request for refreshing access token
/// </summary>
public class RefreshTokenRequest
{
    /// <summary>
    /// The refresh token
    /// </summary>
    [Required(ErrorMessage = "El refresh token es requerido")]
    public required string RefreshToken { get; set; }
}

/// <summary>
/// Request for logout
/// </summary>
public class LogoutRequest
{
    /// <summary>
    /// The refresh token to revoke
    /// </summary>
    public string? RefreshToken { get; set; }
}

/// <summary>
/// Response for logout operation
/// </summary>
public class LogoutResponse
{
    /// <summary>
    /// Whether logout was successful
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// Message describing the result
    /// </summary>
    public string Message { get; set; } = string.Empty;
}
