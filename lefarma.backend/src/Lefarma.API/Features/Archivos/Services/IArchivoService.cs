using ErrorOr;
using Lefarma.API.Features.Archivos.DTOs;

namespace Lefarma.API.Features.Archivos.Services;

public interface IArchivoService
{
    Task<ErrorOr<ArchivoResponse>> SubirAsync(
        Stream fileStream,
        string fileName,
        string contentType,
        SubirArchivoRequest request,
        int? usuarioId = null,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<ArchivoResponse>> ReemplazarAsync(
        int id,
        Stream fileStream,
        string fileName,
        string contentType,
        string? metadata = null,
        int? usuarioId = null,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<ArchivoResponse>> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    
    Task<ErrorOr<IEnumerable<ArchivoListItemResponse>>> GetAllAsync(
        ListarArchivosQuery query,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<(Stream Stream, string FileName, string ContentType)>> DownloadAsync(
        int id,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<(Stream Stream, string FileName, string ContentType)>> PreviewAsync(
        int id,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<bool>> DeleteAsync(int id, CancellationToken cancellationToken = default);
}
