using ErrorOr;
using Lefarma.API.Features.Auth.DTOs;

namespace Lefarma.API.Features.Auth;
public interface IAuthService
{
    Task<ErrorOr<LoginStepOneResponse>> LoginStepOneAsync(
        LoginStepOneRequest request,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<LoginResponse>> LoginStepTwoAsync(
        LoginStepTwoRequest request,
        string? ipAddress = null,
        string? userAgent = null,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<LoginResponse>> RefreshTokenAsync(
        RefreshTokenRequest request,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<LogoutResponse>> LogoutAsync(
        string? refreshToken = null,
        int? usuarioId = null,
        CancellationToken cancellationToken = default);
}
