using ErrorOr;
using Lefarma.API.Features.Help.DTOs;

namespace Lefarma.API.Features.Help.Services;

/// <summary>
/// Interfaz del servicio de imágenes de ayuda.
/// </summary>
public interface IHelpImageService
{
    /// <summary>
    /// Carga una imagen para usar en artículos de ayuda.
    /// </summary>
    /// <param name="stream">Flujo de datos de la imagen.</param>
    /// <param name="originalFileName">Nombre original del archivo.</param>
    /// <param name="contentType">Tipo de contenido MIME de la imagen.</param>
    /// <param name="uploadedBy">Usuario que carga la imagen.</param>
    /// <param name="ct">Token de cancelación.</param>
    /// <returns>Respuesta con los datos de la imagen cargada o un error.</returns>
    Task<ErrorOr<HelpImageUploadResponse>> UploadAsync(
        Stream stream,
        string originalFileName,
        string contentType,
        string uploadedBy,
        CancellationToken ct);
}
