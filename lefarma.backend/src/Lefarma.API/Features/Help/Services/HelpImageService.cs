using ErrorOr;
using Lefarma.API.Domain.Entities.Help;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Help.DTOs;
using Lefarma.API.Shared.Errors;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Help.Services;
public class HelpImageService : IHelpImageService
{
    private readonly IHelpImageRepository _repository;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<HelpImageService> _logger;

    private const long MaxFileSizeBytes = 5 * 1024 * 1024;

    private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp"
    };

    private static readonly Dictionary<string, string> MimeTypeToExtension = new(StringComparer.OrdinalIgnoreCase)
    {
        { "image/png", ".png" },
        { "image/jpeg", ".jpg" },
        { "image/gif", ".gif" },
        { "image/webp", ".webp" }
    };

    public HelpImageService(
        IHelpImageRepository repository,
        IWebHostEnvironment environment,
        ILogger<HelpImageService> logger)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        _environment = environment ?? throw new ArgumentNullException(nameof(environment));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<ErrorOr<HelpImageUploadResponse>> UploadAsync(
        Stream stream,
        string originalFileName,
        string contentType,
        string uploadedBy,
        CancellationToken ct)
    {
        try
        {
            _logger.LogDebug("Iniciando carga de imagen: {FileName}, ContentType: {ContentType}", originalFileName, contentType);

            if (!AllowedMimeTypes.Contains(contentType))
            {
                _logger.LogWarning("Tipo de contenido no permitido: {ContentType}", contentType);
                return CommonErrors.Validation("ImageContentType", "El tipo de archivo no es válido. Solo se permiten imágenes PNG, JPEG, GIF y WebP.");
            }

            if (stream.Length > MaxFileSizeBytes)
            {
                _logger.LogWarning("Archivo demasiado grande: {Size} bytes. Máximo permitido: {MaxSize} bytes", stream.Length, MaxFileSizeBytes);
                return CommonErrors.Validation("ImageFileTooLarge", "El archivo es demasiado grande. El tamaño máximo permitido es 5 MB.");
            }

            var extension = MimeTypeToExtension.GetValueOrDefault(contentType, ".bin");
            var fileName = $"{Guid.NewGuid()}{extension}";

            var now = DateTime.UtcNow;
            var yearFolder = now.Year.ToString();
            var monthFolder = now.Month.ToString("D2");
            var relativeFolder = Path.Combine("media", "help", yearFolder, monthFolder);

            var webRootPath = _environment.WebRootPath;
            if (string.IsNullOrEmpty(webRootPath))
            {
                _logger.LogError("WebRootPath no está configurado");
                return CommonErrors.InternalServerError("El directorio web no está configurado.");
            }

            var fullFolderPath = Path.Combine(webRootPath, relativeFolder);

            if (!Directory.Exists(fullFolderPath))
            {
                Directory.CreateDirectory(fullFolderPath);
                _logger.LogDebug("Directorio creado: {Directory}", fullFolderPath);
            }

            var fullFilePath = Path.Combine(fullFolderPath, fileName);
            var relativePath = $"/api/media/help/{yearFolder}/{monthFolder}/{fileName}";

            using (var fileStream = new FileStream(fullFilePath, FileMode.Create))
            {
                await stream.CopyToAsync(fileStream, ct);
            }

            _logger.LogDebug("Archivo guardado en: {FilePath}", fullFilePath);

            var helpImage = new HelpImage
            {
                NombreOriginal = originalFileName,
                NombreArchivo = fileName,
                RutaRelativa = relativePath,
                TamanhoBytes = stream.Length,
                MimeType = contentType,
                Ancho = null, 
                Alto = null,
                FechaSubida = DateTime.UtcNow,
                SubidoPor = uploadedBy
            };
            var savedImage = await _repository.CreateAsync(helpImage, ct);

            _logger.LogInformation("Imagen de ayuda cargada exitosamente: {ImageId} - {FileName}", savedImage.Id, savedImage.NombreArchivo);

            return MapToResponse(savedImage);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al cargar imagen de ayuda: {FileName}", originalFileName);
            return CommonErrors.InternalServerError("Error al procesar la imagen. Intente nuevamente.");
        }
    }

    private static HelpImageUploadResponse MapToResponse(HelpImage image)
    {
        return new HelpImageUploadResponse
        {
            Id = image.Id,
            NombreOriginal = image.NombreOriginal,
            NombreArchivo = image.NombreArchivo,
            RutaRelativa = image.RutaRelativa,
            TamanhoBytes = image.TamanhoBytes,
            MimeType = image.MimeType,
            Ancho = image.Ancho,
            Alto = image.Alto,
            FechaSubida = image.FechaSubida
        };
    }
}
