using ErrorOr;
using Lefarma.API.Features.Profile.DTOs;
using Microsoft.AspNetCore.Http;

namespace Lefarma.API.Features.Profile;
public interface IProfileService
{
    Task<ErrorOr<ProfileResponse>> GetProfileAsync(int userId, CancellationToken cancellationToken = default);

    Task<ErrorOr<ProfileResponse>> UpdateProfileAsync(int userId, UpdateProfileRequest request, CancellationToken cancellationToken = default);
    Task<ErrorOr<bool>> HasFirmaAsync(int userId, CancellationToken cancellationToken = default);

    Task<ErrorOr<bool>> TieneFirmaEnComprobacionAsync(int userId, CancellationToken cancellationToken = default);

    Task<ErrorOr<string>> UploadSignatureAsync(int userId, IFormFile file, IFormFile ine, string fileName, string contentType, CancellationToken cancellationToken = default);
    Task<ErrorOr<string>> DeleteSignatureAsync(int userId, CancellationToken cancellationToken = default);

    Task<ErrorOr<bool>> HasFirmaLegacyAsync(int userId, CancellationToken cancellationToken = default);

    Task<ErrorOr<string>> UploadSignatureLegacyAsync(int userId, IFormFile file, string fileName, string contentType, CancellationToken cancellationToken = default);

    Task<ErrorOr<string>> DeleteSignatureLegacyAsync(int userId, CancellationToken cancellationToken = default);

    Task<ErrorOr<bool>> SolicitarCambioFirmaAsync(int userId, CancellationToken cancellationToken = default);
}
