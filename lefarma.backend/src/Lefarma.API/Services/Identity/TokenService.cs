using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ErrorOr;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Lefarma.API.Services.Identity;

/// <summary>
/// Service for JWT token generation, validation, and refresh token management.
/// </summary>
public class TokenService : ITokenService
{
    private readonly JwtSettings _jwtSettings;
    private readonly AsokamDbContext _context;
    private readonly ILogger<TokenService> _logger;
    private readonly SymmetricSecurityKey _signingKey;

    public TokenService(
        IOptions<JwtSettings> jwtSettings,
        AsokamDbContext context,
        ILogger<TokenService> logger)
    {
        _jwtSettings = jwtSettings.Value;
        _context = context;
        _logger = logger;
        _signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.SecretKey));
    }

    /// <inheritdoc />
    public async Task<ErrorOr<string>> GenerateAccessTokenAsync(
        Usuario usuario,
        long? sesionId = null,
        IReadOnlyList<string>? roles = null,
        IReadOnlyList<string>? permissions = null,
        CancellationToken cancellationToken = default)
    {
        if (usuario == null)
        {
            return CommonErrors.Validation("usuario", "El usuario es requerido");
        }

        try
        {
            var jti = Guid.NewGuid().ToString();
            var now = DateTime.UtcNow;
            var expiration = now.AddMinutes(_jwtSettings.AccessTokenExpirationMinutes);

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, usuario.IdUsuario.ToString()),
                new(JwtRegisteredClaimNames.Jti, jti),
                new(JwtRegisteredClaimNames.Iat, new DateTimeOffset(now).ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
                new(ClaimTypes.NameIdentifier, usuario.IdUsuario.ToString()),
                new(ClaimTypes.Name, usuario.SamAccountName ?? usuario.NombreCompleto ?? usuario.IdUsuario.ToString()),
            };

            if (!string.IsNullOrWhiteSpace(usuario.Correo))
            {
                claims.Add(new Claim(ClaimTypes.Email, usuario.Correo));
            }

            if (sesionId.HasValue)
            {
                claims.Add(new Claim("sesion_id", sesionId.Value.ToString()));
            }

            if (!string.IsNullOrWhiteSpace(usuario.Dominio))
            {
                claims.Add(new Claim("domain", usuario.Dominio));
            }

            if (roles?.Count > 0)
            {
                foreach (var role in roles)
                {
                    if (!string.IsNullOrWhiteSpace(role))
                    {
                        claims.Add(new Claim(ClaimTypes.Role, role));
                    }
                }
            }

            if (permissions?.Count > 0)
            {
                foreach (var permission in permissions)
                {
                    if (!string.IsNullOrWhiteSpace(permission))
                    {
                        claims.Add(new Claim("permission", permission));
                    }
                }
            }

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = expiration,
                Issuer = _jwtSettings.Issuer,
                Audience = _jwtSettings.Audience,
                SigningCredentials = new SigningCredentials(_signingKey, SecurityAlgorithms.HmacSha256)
            };

            var tokenHandler = new JwtSecurityTokenHandler();
            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            _logger.LogDebug(
                "Generated access token for user {UserId} with jti {Jti}, expires at {Expiration}",
                usuario.IdUsuario, jti, expiration);

            return tokenString;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating access token for user {UserId}", usuario.IdUsuario);
            return CommonErrors.InternalServerError("Error al generar el token de acceso");
        }
    }

    /// <inheritdoc />
    public async Task<ErrorOr<string>> GenerateRefreshTokenAsync(
        Usuario usuario,
        long? sesionId = null,
        string? clientId = null,
        CancellationToken cancellationToken = default)
    {
        if (usuario == null)
        {
            return CommonErrors.Validation("usuario", "El usuario es requerido");
        }

        try
        {
            // Generate a cryptographically secure random token
            var refreshTokenValue = GenerateSecureToken();
            var tokenHash = HashToken(refreshTokenValue);
            var jtiAccess = Guid.NewGuid().ToString();

            var refreshToken = new RefreshToken
            {
                TokenHash = tokenHash,
                JtiAccess = jtiAccess,
                IdUsuario = usuario.IdUsuario,
                IdSesion = sesionId,
                ClientId = clientId,
                FechaCreacion = DateTime.UtcNow,
                FechaExpiracion = DateTime.UtcNow.AddDays(_jwtSettings.RefreshTokenExpirationDays),
                EsRevocado = false
            };

            _context.RefreshTokens.Add(refreshToken);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogDebug(
                "Generated refresh token for user {UserId}, expires at {Expiration}",
                usuario.IdUsuario, refreshToken.FechaExpiracion);

            // Return the raw token value (not hashed) - this is the only time it's available
            return refreshTokenValue;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating refresh token for user {UserId}", usuario.IdUsuario);
            return CommonErrors.InternalServerError("Error al generar el refresh token");
        }
    }

    /// <inheritdoc />
    public async Task<ErrorOr<ClaimsPrincipal>> ValidateAccessTokenAsync(
        string token,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return CommonErrors.Validation("token", "El token es requerido");
        }

        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = _jwtSettings.Issuer,
                ValidAudience = _jwtSettings.Audience,
                IssuerSigningKey = _signingKey,
                ClockSkew = TimeSpan.Zero // No clock skew tolerance
            };

            var principal = tokenHandler.ValidateToken(token, validationParameters, out var validatedToken);

            _logger.LogDebug("Access token validated successfully for user {UserId}",
                principal.FindFirst(ClaimTypes.NameIdentifier)?.Value);

            return principal;
        }
        catch (SecurityTokenExpiredException)
        {
            _logger.LogWarning("Access token validation failed: token expired");
            return CommonErrors.Validation("token", "El token ha expirado");
        }
        catch (SecurityTokenInvalidSignatureException)
        {
            _logger.LogWarning("Access token validation failed: invalid signature");
            return CommonErrors.Validation("token", "Firma del token invalida");
        }
        catch (SecurityTokenInvalidIssuerException)
        {
            _logger.LogWarning("Access token validation failed: invalid issuer");
            return CommonErrors.Validation("token", "Emisor del token invalido");
        }
        catch (SecurityTokenInvalidAudienceException)
        {
            _logger.LogWarning("Access token validation failed: invalid audience");
            return CommonErrors.Validation("token", "Audiencia del token invalida");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating access token");
            return CommonErrors.Validation("token", "Token invalido");
        }
    }

    /// <inheritdoc />
    public async Task<ErrorOr<RefreshToken>> ValidateRefreshTokenAsync(
        string token,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return CommonErrors.Validation("token", "El refresh token es requerido");
        }

        try
        {
            var tokenHash = HashToken(token);

            var refreshToken = await _context.RefreshTokens
                .Include(rt => rt.Usuario)
                .FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash, cancellationToken);

            if (refreshToken == null)
            {
                _logger.LogWarning("Refresh token not found");
                return CommonErrors.NotFound("RefreshToken", "token");
            }

            if (refreshToken.EsRevocado)
            {
                _logger.LogWarning("Refresh token is revoked for user {UserId}", refreshToken.IdUsuario);
                return CommonErrors.Validation("token", "El refresh token ha sido revocado");
            }

            if (refreshToken.FechaExpiracion < DateTime.UtcNow)
            {
                _logger.LogWarning("Refresh token expired for user {UserId}", refreshToken.IdUsuario);
                return CommonErrors.Validation("token", "El refresh token ha expirado");
            }

            // Mark as used
            refreshToken.FechaUso = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogDebug("Refresh token validated successfully for user {UserId}", refreshToken.IdUsuario);

            return refreshToken;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating refresh token");
            return CommonErrors.InternalServerError("Error al validar el refresh token");
        }
    }

    /// <inheritdoc />
    public async Task<ErrorOr<bool>> RevokeRefreshTokenAsync(
        string token,
        string? reason = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return CommonErrors.Validation("token", "El refresh token es requerido");
        }

        try
        {
            var tokenHash = HashToken(token);

            var refreshToken = await _context.RefreshTokens
                .FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash, cancellationToken);

            if (refreshToken == null)
            {
                _logger.LogWarning("Refresh token not found for revocation");
                return CommonErrors.NotFound("RefreshToken", "token");
            }

            refreshToken.EsRevocado = true;
            refreshToken.FechaRevocacion = DateTime.UtcNow;
            refreshToken.MotivoRevocacion = reason ?? "Revocado por solicitud del usuario";

            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogDebug("Refresh token revoked for user {UserId}, reason: {Reason}",
                refreshToken.IdUsuario, refreshToken.MotivoRevocacion);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error revoking refresh token");
            return CommonErrors.InternalServerError("Error al revocar el refresh token");
        }
    }

    /// <inheritdoc />
    public async Task<ErrorOr<bool>> RevokeAllUserTokensAsync(
        int usuarioId,
        string? reason = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var tokens = await _context.RefreshTokens
                .Where(rt => rt.IdUsuario == usuarioId && !rt.EsRevocado)
                .ToListAsync(cancellationToken);

            if (!tokens.Any())
            {
                return true;
            }

            var now = DateTime.UtcNow;
            var revocationReason = reason ?? "Revocado por solicitud del usuario";

            foreach (var token in tokens)
            {
                token.EsRevocado = true;
                token.FechaRevocacion = now;
                token.MotivoRevocacion = revocationReason;
            }

            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogDebug("Revoked {Count} refresh tokens for user {UserId}", tokens.Count, usuarioId);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error revoking all refresh tokens for user {UserId}", usuarioId);
            return CommonErrors.InternalServerError("Error al revocar los refresh tokens");
        }
    }

    /// <inheritdoc />
    public string? GetJwtId(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var jwtToken = tokenHandler.ReadJwtToken(token);
            return jwtToken.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Jti)?.Value;
        }
        catch
        {
            return null;
        }
    }

    /// <inheritdoc />
    public int? GetUserIdFromToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var jwtToken = tokenHandler.ReadJwtToken(token);
            var userIdClaim = jwtToken.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value
                ?? jwtToken.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Sub)?.Value;

            if (userIdClaim != null && int.TryParse(userIdClaim, out var userId))
            {
                return userId;
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    #region Private Methods

    /// <summary>
    /// Generates a cryptographically secure random token.
    /// </summary>
    private static string GenerateSecureToken()
    {
        var randomBytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }

    /// <summary>
    /// Hashes a token using SHA256 for secure storage.
    /// </summary>
    private static string HashToken(string token)
    {
        var bytes = Encoding.UTF8.GetBytes(token);
        var hash = SHA256.HashData(bytes);
        return Convert.ToBase64String(hash);
    }

    #endregion
}
