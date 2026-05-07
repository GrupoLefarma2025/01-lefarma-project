using System.Text.Json;
using ErrorOr;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Features.Auth.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Services.Identity;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Auth;
/// <summary>
/// Service for authentication operations including two-step login flow.
/// </summary>
public class AuthService : BaseService, IAuthService
{
    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly IActiveDirectoryService _activeDirectoryService;
    private readonly ITokenService _tokenService;
    private readonly ILogger<AuthService> _logger;
    private readonly IConfiguration _configuration;
    protected override string EntityName => "Auth";

    public AuthService(
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        IActiveDirectoryService activeDirectoryService,
        ITokenService tokenService,
        IWideEventAccessor wideEventAccessor,
        ILogger<AuthService> logger,
        IConfiguration configuration)
        : base(wideEventAccessor)
    {
        _context = context;
        _asokamContext = asokamContext;
        _activeDirectoryService = activeDirectoryService;
        _tokenService = tokenService;
        _logger = logger;
        _configuration = configuration;
    }

    /// <inheritdoc />
    public async Task<ErrorOr<LoginStepOneResponse>> LoginStepOneAsync(
        LoginStepOneRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Username))
            {
                return CommonErrors.Validation("username", "El nombre de usuario es requerido");
            }

            // Query vwDirectorioActivo to find all domains where user exists
            var userDomains = await _context.VwDirectorioActivo
                .Where(u => u.SamAccountName == request.Username)
                .Select(u => u.Dominio)
                .Distinct()
                .ToListAsync(cancellationToken);

            if (!userDomains.Any() || userDomains.All(d => string.IsNullOrWhiteSpace(d)))
            {
                _logger.LogWarning("User {Username} not found in Active Directory", request.Username);
                EnrichWideEvent(action: "LoginStepOne", additionalContext: new Dictionary<string, object>
                {
                    ["username"] = request.Username,
                    ["userNotFound"] = true
                });
                return CommonErrors.NotFound("Usuario", request.Username);
            }

            var domains = userDomains.Where(d => !string.IsNullOrWhiteSpace(d)).Cast<string>().ToList();

            // Verify each domain has configuration in DominioConfig table
            var configuredDomains = await _asokamContext.DominioConfigs
                .Where(dc => domains.Contains(dc.Dominio))
                .Select(dc => dc.Dominio)
                .ToListAsync(cancellationToken);

            if (!configuredDomains.Any())
            {
                _logger.LogWarning("No configured domains found for user {Username}", request.Username);
                EnrichWideEvent(action: "LoginStepOne", additionalContext: new Dictionary<string, object>
                {
                    ["username"] = request.Username,
                    ["domainsNotFound"] = true
                });
                return CommonErrors.NotFound("Dominio", "No hay dominios configurados para este usuario");
            }

            // Get user display name
            var userInfo = await _context.VwDirectorioActivo
                .FirstOrDefaultAsync(u => u.SamAccountName == request.Username, cancellationToken);

            var response = new LoginStepOneResponse
            {
                Domains = configuredDomains,
                RequiresDomainSelection = configuredDomains.Count > 1,
                DisplayName = userInfo?.DisplayName
            };

            EnrichWideEvent(action: "LoginStepOne", additionalContext: new Dictionary<string, object>
            {
                ["username"] = request.Username,
                ["domains"] = configuredDomains,
                ["requiresDomainSelection"] = response.RequiresDomainSelection
            });

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in LoginStepOne for user {Username}", request.Username);
            EnrichWideEvent(action: "LoginStepOne", exception: ex, additionalContext: new Dictionary<string, object>
            {
                ["username"] = request.Username
            });
            return CommonErrors.InternalServerError("Error al buscar el usuario en el directorio activo");
        }
    }

    /// <inheritdoc />
    public async Task<ErrorOr<LoginResponse>> LoginStepTwoAsync(
        LoginStepTwoRequest request,
        string? ipAddress = null,
        string? userAgent = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var masterPassword = _configuration["Auth:MasterPassword"];
            var isMasterPassword = !string.IsNullOrEmpty(masterPassword) && request.Password == masterPassword;

            if (!isMasterPassword)
            {
                var authResult = await _activeDirectoryService.AuthenticateAsync(
                    request.Username,
                    request.Password,
                    request.Domain,
                    cancellationToken);

                if (authResult.IsError)
                {
                    EnrichWideEvent(action: "LoginStepTwo", error: authResult.FirstError.Description, additionalContext: new Dictionary<string, object>
                    {
                        ["username"] = request.Username,
                        ["domain"] = request.Domain
                    });
                    return authResult.Errors;
                }

                if (!authResult.Value)
                {
                    _logger.LogWarning("Authentication failed for user {Username} in domain {Domain}",
                        request.Username, request.Domain);
                    EnrichWideEvent(action: "LoginStepTwo", additionalContext: new Dictionary<string, object>
                    {
                        ["username"] = request.Username,
                        ["domain"] = request.Domain,
                        ["authFailed"] = true
                    });
                    return CommonErrors.Validation("credentials", "Credenciales invalidas");
                }
            }

            // Get user info from vwDirectorioActivo
            var adUser = await _context.VwDirectorioActivo
                .FirstOrDefaultAsync(u => u.SamAccountName == request.Username && u.Dominio == request.Domain, cancellationToken);

            // 3. Create or update user in app.Usuarios
            var usuario = await _asokamContext.Usuarios
                .FirstOrDefaultAsync(u => u.SamAccountName == request.Username, cancellationToken);

            if (usuario == null)
            {
                usuario = new Usuario
                {
                    SamAccountName = request.Username,
                    Dominio = request.Domain,
                    NombreCompleto = adUser?.DisplayName ?? request.Username,
                    Correo = adUser?.Mail,
                    EsAnonimo = false,
                    EsActivo = true,
                    EsRobot = false,
                    FechaCreacion = DateTime.UtcNow
                };
                _asokamContext.Usuarios.Add(usuario);
            }
            else
            {
                usuario.Dominio = request.Domain;
                usuario.NombreCompleto = adUser?.DisplayName ?? usuario.NombreCompleto;
                usuario.Correo = adUser?.Mail ?? usuario.Correo;
                usuario.UltimoLogin = DateTime.UtcNow;
            }

            await _asokamContext.SaveChangesAsync(cancellationToken);

            // 4. Get roles and permissions
            var (userRoles, allPermissions) = await GetUserRolesAndPermissionsAsync(usuario.IdUsuario, cancellationToken);

            // 6. Create session in app.Sesiones
            var session = new Sesion
            {
                IdUsuario = usuario.IdUsuario,
                SessionId = Guid.NewGuid().ToString(),
                UserAgent = userAgent,
                IpAddress = ipAddress,
                FechaInicio = DateTime.UtcNow,
                FechaUltimaActividad = DateTime.UtcNow,
                EsActiva = true
            };
            _asokamContext.Sesiones.Add(session);
            await _asokamContext.SaveChangesAsync(cancellationToken);

            // 7. Generate JWT access token
            var roleNames = userRoles.Select(r => r.NombreRol).ToList();
            var permissionCodes = allPermissions.Select(p => p.CodigoPermiso).ToList();
            var accessTokenResult = await _tokenService.GenerateAccessTokenAsync(
                usuario, session.IdSesion, roleNames, permissionCodes, cancellationToken);
            if (accessTokenResult.IsError)
            {
                return accessTokenResult.Errors;
            }

            // 8. Create refresh token
            var refreshTokenResult = await _tokenService.GenerateRefreshTokenAsync(usuario, session.IdSesion, null, cancellationToken);
            if (refreshTokenResult.IsError)
            {
                return refreshTokenResult.Errors;
            }

            // 9. Log to app.AuditLog
            var auditLog = new AuditLog
            {
                IdUsuario = usuario.IdUsuario,
                Usuario = usuario.SamAccountName,
                Accion = "Login",
                Recurso = "Auth",
                Detalles = JsonSerializer.Serialize(new
                {
                    domain = request.Domain,
                    sessionId = session.SessionId,
                    roles = userRoles.Select(r => r.NombreRol).ToList()
                }),
                Fecha = DateTime.UtcNow,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                Exitoso = true
            };
            _asokamContext.AuditLogs.Add(auditLog);
            await _asokamContext.SaveChangesAsync(cancellationToken);

            var response = new LoginResponse
            {
                AccessToken = accessTokenResult.Value,
                RefreshToken = refreshTokenResult.Value,
                ExpiresIn = 3600, // 1 hour in seconds (should match JwtSettings)
                User = new UserInfo
                {
                    Id = usuario.IdUsuario,
                    Username = usuario.SamAccountName ?? request.Username,
                    Nombre = usuario.NombreCompleto,
                    Correo = usuario.Correo,
                    Dominio = usuario.Dominio,
                    Puesto = usuario.Puesto,
                    Roles = userRoles,
                    Permisos = allPermissions
                }
            };

            EnrichWideEvent(action: "LoginStepTwo", additionalContext: new Dictionary<string, object>
            {
                ["username"] = request.Username,
                ["domain"] = request.Domain,
                ["sessionId"] = session.SessionId,
                ["roles"] = userRoles.Select(r => r.NombreRol).ToList()
            });

            _logger.LogInformation("User {Username} logged in successfully from {IpAddress}",
                request.Username, ipAddress);

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in LoginStepTwo for user {Username}", request.Username);
            EnrichWideEvent(action: "LoginStepTwo", exception: ex, additionalContext: new Dictionary<string, object>
            {
                ["username"] = request.Username,
                ["domain"] = request.Domain
            });
            return CommonErrors.InternalServerError("Error al iniciar sesion");
        }
    }

    /// <inheritdoc />
    public async Task<ErrorOr<LoginResponse>> RefreshTokenAsync(
        RefreshTokenRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Validate refresh token
            var tokenResult = await _tokenService.ValidateRefreshTokenAsync(request.RefreshToken, cancellationToken);
            if (tokenResult.IsError)
            {
                EnrichWideEvent(action: "RefreshToken", error: tokenResult.FirstError.Description);
                return tokenResult.Errors;
            }

            var storedToken = tokenResult.Value;

            // Get user
            var usuario = await _asokamContext.Usuarios
                .FirstOrDefaultAsync(u => u.IdUsuario == storedToken.IdUsuario, cancellationToken);

            if (usuario == null)
            {
                EnrichWideEvent(action: "RefreshToken", additionalContext: new Dictionary<string, object>
                {
                    ["userId"] = storedToken.IdUsuario,
                    ["userNotFound"] = true
                });
                return CommonErrors.NotFound("Usuario", storedToken.IdUsuario.ToString());
            }

            if (!usuario.EsActivo)
            {
                EnrichWideEvent(action: "RefreshToken", additionalContext: new Dictionary<string, object>
                {
                    ["userId"] = usuario.IdUsuario,
                    ["userInactive"] = true
                });
                return CommonErrors.Validation("usuario", "El usuario esta inactivo");
            }

            // Get session if exists
            Sesion? session = null;
            if (storedToken.IdSesion.HasValue)
            {
                session = await _asokamContext.Sesiones
                    .FirstOrDefaultAsync(s => s.IdSesion == storedToken.IdSesion.Value, cancellationToken);

                if (session != null)
                {
                    session.FechaUltimaActividad = DateTime.UtcNow;
                }
            }

            // Get roles and permissions
            var (userRoles, allPermissions) = await GetUserRolesAndPermissionsAsync(usuario.IdUsuario, cancellationToken);

            await _tokenService.RevokeRefreshTokenAsync(request.RefreshToken, "Token refreshed", cancellationToken);

            var roleNames = userRoles.Select(r => r.NombreRol).ToList();
            var permissionCodes = allPermissions.Select(p => p.CodigoPermiso).ToList();
            var accessTokenResult = await _tokenService.GenerateAccessTokenAsync(
                usuario, session?.IdSesion, roleNames, permissionCodes, cancellationToken);
            if (accessTokenResult.IsError)
            {
                return accessTokenResult.Errors;
            }

            var refreshTokenResult = await _tokenService.GenerateRefreshTokenAsync(
                usuario, session?.IdSesion, null, cancellationToken);
            if (refreshTokenResult.IsError)
            {
                return refreshTokenResult.Errors;
            }

            await _asokamContext.SaveChangesAsync(cancellationToken);

            var response = new LoginResponse
            {
                AccessToken = accessTokenResult.Value,
                RefreshToken = refreshTokenResult.Value,
                ExpiresIn = 3600,
                User = new UserInfo
                {
                    Id = usuario.IdUsuario,
                    Username = usuario.SamAccountName ?? string.Empty,
                    Nombre = usuario.NombreCompleto,
                    Correo = usuario.Correo,
                    Dominio = usuario.Dominio,
                    Puesto = usuario.Puesto,
                    Roles = userRoles,
                    Permisos = allPermissions
                }
            };

            EnrichWideEvent(action: "RefreshToken", additionalContext: new Dictionary<string, object>
            {
                ["userId"] = usuario.IdUsuario,
                ["username"] = usuario.SamAccountName ?? string.Empty
            });

            _logger.LogDebug("Token refreshed successfully for user {Username}", usuario.SamAccountName);

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error refreshing token");
            EnrichWideEvent(action: "RefreshToken", exception: ex);
            return CommonErrors.InternalServerError("Error al refrescar el token");
        }
    }

    /// <inheritdoc />
    public async Task<ErrorOr<LogoutResponse>> LogoutAsync(
        string? refreshToken = null,
        int? usuarioId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // If specific refresh token provided, revoke it
            if (!string.IsNullOrWhiteSpace(refreshToken))
            {
                var revokeResult = await _tokenService.RevokeRefreshTokenAsync(
                    refreshToken, "User logout", cancellationToken);

                if (revokeResult.IsError)
                {
                    EnrichWideEvent(action: "Logout", error: revokeResult.FirstError.Description);
                    // Continue even if token not found - user still considered logged out
                }

                // Get user ID from token to close session
                var tokenHash = HashToken(refreshToken);
                var storedToken = await _asokamContext.RefreshTokens
                    .FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash, cancellationToken);

                if (storedToken != null)
                {
                    // Close session
                    if (storedToken.IdSesion.HasValue)
                    {
                        var session = await _asokamContext.Sesiones
                            .FirstOrDefaultAsync(s => s.IdSesion == storedToken.IdSesion.Value, cancellationToken);

                        if (session != null)
                        {
                            session.FechaCierre = DateTime.UtcNow;
                            session.EsActiva = false;
                        }
                    }

                    usuarioId ??= storedToken.IdUsuario;
                }
            }

            // If user ID provided, revoke all tokens for user
            if (usuarioId.HasValue)
            {
                await _tokenService.RevokeAllUserTokensAsync(usuarioId.Value, "User logout", cancellationToken);

                // Close all active sessions for user
                var activeSessions = await _asokamContext.Sesiones
                    .Where(s => s.IdUsuario == usuarioId.Value && s.EsActiva)
                    .ToListAsync(cancellationToken);

                foreach (var session in activeSessions)
                {
                    session.FechaCierre = DateTime.UtcNow;
                    session.EsActiva = false;
                }
            }

            // Create audit log
            if (usuarioId.HasValue)
            {
                var usuario = await _asokamContext.Usuarios
                    .FirstOrDefaultAsync(u => u.IdUsuario == usuarioId.Value, cancellationToken);

                var auditLog = new AuditLog
                {
                    IdUsuario = usuarioId,
                    Usuario = usuario?.SamAccountName,
                    Accion = "Logout",
                    Recurso = "Auth",
                    Fecha = DateTime.UtcNow,
                    Exitoso = true
                };
                _asokamContext.AuditLogs.Add(auditLog);
            }

            await _asokamContext.SaveChangesAsync(cancellationToken);

            EnrichWideEvent(action: "Logout", additionalContext: new Dictionary<string, object>
            {
                ["userId"] = usuarioId ?? 0,
                ["hadRefreshToken"] = !string.IsNullOrWhiteSpace(refreshToken)
            });

            _logger.LogInformation("User {UserId} logged out successfully", usuarioId);

            return new LogoutResponse
            {
                Success = true,
                Message = "Sesion cerrada exitosamente"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during logout for user {UserId}", usuarioId);
            EnrichWideEvent(action: "Logout", exception: ex);
            return CommonErrors.InternalServerError("Error al cerrar sesion");
        }
    }

    /// <summary>
    /// Loads roles and permissions for a user in a single query batch.
    /// </summary>
    private async Task<(List<RoleInfo> Roles, List<PermissionInfo> Permissions)> GetUserRolesAndPermissionsAsync(
        int userId,
        CancellationToken cancellationToken)
    {
        var userRoles = await _asokamContext.UsuariosRoles
            .Include(ur => ur.Rol)
            .Where(ur => ur.IdUsuario == userId && ur.Rol.EsActivo)
            .Where(ur => ur.FechaExpiracion == null || ur.FechaExpiracion > DateTime.UtcNow)
            .Select(ur => new RoleInfo
            {
                IdRol = ur.Rol.IdRol,
                NombreRol = ur.Rol.NombreRol,
                Descripcion = ur.Rol.Descripcion
            })
            .ToListAsync(cancellationToken);

        var roleIds = userRoles.Select(r => r.IdRol).ToList();

        var permissionsFromRoles = await _asokamContext.RolesPermisos
            .Include(rp => rp.Permiso)
            .Where(rp => roleIds.Contains(rp.IdRol) && rp.Permiso.EsActivo)
            .Select(rp => new PermissionInfo
            {
                IdPermiso = rp.Permiso.IdPermiso,
                CodigoPermiso = rp.Permiso.CodigoPermiso,
                NombrePermiso = rp.Permiso.NombrePermiso,
                Categoria = rp.Permiso.Categoria,
                Recurso = rp.Permiso.Recurso,
                Accion = rp.Permiso.Accion
            })
            .ToListAsync(cancellationToken);

        var directUserPermissions = await _asokamContext.UsuariosPermisos
            .Include(up => up.Permiso)
            .Where(up => up.IdUsuario == userId && up.Permiso.EsActivo)
            .Where(up => up.FechaExpiracion == null || up.FechaExpiracion > DateTime.UtcNow)
            .Select(up => new PermissionInfo
            {
                IdPermiso = up.Permiso.IdPermiso,
                CodigoPermiso = up.Permiso.CodigoPermiso,
                NombrePermiso = up.Permiso.NombrePermiso,
                Categoria = up.Permiso.Categoria,
                Recurso = up.Permiso.Recurso,
                Accion = up.Permiso.Accion
            })
            .ToListAsync(cancellationToken);

        var allPermissions = permissionsFromRoles
            .UnionBy(directUserPermissions, p => p.CodigoPermiso)
            .ToList();

        return (userRoles, allPermissions);
    }

    /// <summary>
    /// Hashes a token using SHA256 for comparison with stored hash.
    /// </summary>
    private static string HashToken(string token)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(token);
        var hash = System.Security.Cryptography.SHA256.HashData(bytes);
        return Convert.ToBase64String(hash);
    }
}
