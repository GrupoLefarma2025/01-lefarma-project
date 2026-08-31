using ErrorOr;
using Lefarma.API.Features.Auth.DTOs;

namespace Lefarma.API.Features.Auth;
/// <summary>
/// Service for authentication operations including two-step login flow.
/// </summary>
public interface IAuthService
{
    /// <summary>
    /// Step 1: Find user in Active Directory and get available domains.
    /// </summary>
    /// <param name="request">The login step one request containing username.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Available domains for the user.</returns>
    Task<ErrorOr<LoginStepOneResponse>> LoginStepOneAsync(
        LoginStepOneRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Step 2: Authenticate user with credentials and create session.
    /// </summary>
    /// <param name="request">The login step two request with credentials and domain.</param>
    /// <param name="ipAddress">Client IP address.</param>
    /// <param name="userAgent">Client user agent.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Login response with tokens and user info.</returns>
    Task<ErrorOr<LoginResponse>> LoginStepTwoAsync(
        LoginStepTwoRequest request,
        string? ipAddress = null,
        string? userAgent = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Refresh access token using refresh token.
    /// </summary>
    /// <param name="request">The refresh token request.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>New login response with fresh tokens.</returns>
    Task<ErrorOr<LoginResponse>> RefreshTokenAsync(
        RefreshTokenRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Logout user by revoking tokens.
    /// </summary>
    /// <param name="refreshToken">The refresh token to revoke.</param>
    /// <param name="usuarioId">Optional user ID to revoke all tokens for.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Logout response.</returns>
    Task<ErrorOr<LogoutResponse>> LogoutAsync(
        string? refreshToken = null,
        int? usuarioId = null,
        CancellationToken cancellationToken = default);
}
