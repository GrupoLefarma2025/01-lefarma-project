using ErrorOr;
using Lefarma.API.Domain.Entities.Auth;

namespace Lefarma.API.Services.Identity;

/// <summary>
/// Service for JWT token generation, validation, and refresh token management.
/// </summary>
public interface ITokenService
{
    /// <summary>
    /// Generates a JWT access token for the specified user with roles and permissions.
    /// </summary>
    /// <param name="usuario">The user entity.</param>
    /// <param name="sesionId">Optional session ID for token tracking.</param>
    /// <param name="roles">Optional list of role names for the user.</param>
    /// <param name="permissions">Optional list of permission codes for the user.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The generated JWT access token.</returns>
    Task<ErrorOr<string>> GenerateAccessTokenAsync(
        Usuario usuario,
        long? sesionId = null,
        IReadOnlyList<string>? roles = null,
        IReadOnlyList<string>? permissions = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Generates and stores a new refresh token for the specified user.
    /// </summary>
    /// <param name="usuario">The user entity.</param>
    /// <param name="sesionId">Optional session ID for token tracking.</param>
    /// <param name="clientId">Optional client identifier.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The generated refresh token value (not hashed).</returns>
    Task<ErrorOr<string>> GenerateRefreshTokenAsync(
        Usuario usuario,
        long? sesionId = null,
        string? clientId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Validates a JWT access token and returns the principal.
    /// </summary>
    /// <param name="token">The JWT token to validate.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The claims principal if valid, or an error.</returns>
    Task<ErrorOr<System.Security.Claims.ClaimsPrincipal>> ValidateAccessTokenAsync(
        string token,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Validates a refresh token and returns the stored token entity.
    /// </summary>
    /// <param name="token">The refresh token value.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The refresh token entity if valid, or an error.</returns>
    Task<ErrorOr<RefreshToken>> ValidateRefreshTokenAsync(
        string token,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes a refresh token.
    /// </summary>
    /// <param name="token">The refresh token value to revoke.</param>
    /// <param name="reason">Optional reason for revocation.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Success or error.</returns>
    Task<ErrorOr<bool>> RevokeRefreshTokenAsync(
        string token,
        string? reason = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes all refresh tokens for a user.
    /// </summary>
    /// <param name="usuarioId">The user ID.</param>
    /// <param name="reason">Optional reason for revocation.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Success or error.</returns>
    Task<ErrorOr<bool>> RevokeAllUserTokensAsync(
        int usuarioId,
        string? reason = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the JWT ID (jti) from an access token.
    /// </summary>
    /// <param name="token">The JWT access token.</param>
    /// <returns>The JWT ID or null if not found.</returns>
    string? GetJwtId(string token);

    /// <summary>
    /// Gets the user ID from an access token.
    /// </summary>
    /// <param name="token">The JWT access token.</param>
    /// <returns>The user ID or null if not found.</returns>
    int? GetUserIdFromToken(string token);
}
