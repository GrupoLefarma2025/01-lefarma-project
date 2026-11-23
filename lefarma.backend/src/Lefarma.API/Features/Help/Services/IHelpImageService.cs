using ErrorOr;
using Lefarma.API.Features.Help.DTOs;

namespace Lefarma.API.Features.Help.Services;

public interface IHelpImageService
{
    Task<ErrorOr<HelpImageUploadResponse>> UploadAsync(
        Stream stream,
        string originalFileName,
        string contentType,
        string uploadedBy,
        CancellationToken ct);
}
