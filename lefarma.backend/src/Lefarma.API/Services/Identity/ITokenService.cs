using ErrorOr;
using Lefarma.API.Domain.Entities.Auth;

namespace Lefarma.API.Services.Identity;
public interface ITokenService
{
    Task<ErrorOr<string>> GenerateAccessTokenAsync(
        Usuario usuario,
        long? sesionId = null,
        IReadOnlyList<string>? roles = null,
        IReadOnlyList<string>? permissions = null,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<string>> GenerateRefreshTokenAsync(
        Usuario usuario,
        long? sesionId = null,
        string? clientId = null,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<System.Security.Claims.ClaimsPrincipal>> ValidateAccessTokenAsync(
        string token,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<RefreshToken>> ValidateRefreshTokenAsync(
        string token,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<bool>> RevokeRefreshTokenAsync(
        string token,
        string? reason = null,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<bool>> RevokeAllUserTokensAsync(
        int usuarioId,
        string? reason = null,
        CancellationToken cancellationToken = default);

    string? GetJwtId(string token);

    int? GetUserIdFromToken(string token);
}
