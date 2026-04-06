using ErrorOr;
using Lefarma.API.Domain.Entities.Help;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Help.DTOs;
using Lefarma.API.Shared.Errors;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Help.Services;
/// <summary>
/// Servicio para la gestión de imágenes de ayuda.
/// </summary>
public class HelpImageService : IHelpImageService
{
    private readonly IHelpImageRepository _repository;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<HelpImageService> _logger;

    /// <summary>
    /// Tamaño máximo de archivo permitido (5 MB).
    /// </summary>
    private const long MaxFileSizeBytes = 5 * 1024 * 1024;

    /// <summary>
    /// Tipos MIME permitidos para imágenes.
    /// </summary>
    private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp"
    };

    /// <summary>
    /// Extensiones de archivo permitidas según el tipo MIME.
    /// </summary>
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
            Console.WriteLine($"[DEBUG HelpImageService] UploadAsync iniciado - FileName: {originalFileName}, ContentType: {contentType}");
            _logger.LogDebug("Iniciando carga de imagen: {FileName}, ContentType: {ContentType}", originalFileName, contentType);

            // Validar tipo de contenido
            if (!AllowedMimeTypes.Contains(contentType))
            {
                _logger.LogWarning("Tipo de contenido no permitido: {ContentType}", contentType);
                return Errors.HelpImage.InvalidContentType;
            }

            // Validar tamaño del archivo
            if (stream.Length > MaxFileSizeBytes)
            {
                _logger.LogWarning("Archivo demasiado grande: {Size} bytes. Máximo permitido: {MaxSize} bytes", stream.Length, MaxFileSizeBytes);
                return Errors.HelpImage.FileTooLarge;
            }

            // Generar nombre de archivo único
            var extension = MimeTypeToExtension.GetValueOrDefault(contentType, ".bin");
            var fileName = $"{Guid.NewGuid()}{extension}";

            // Construir ruta de almacenamiento: wwwroot/media/help/{year}/{month}/
            var now = DateTime.UtcNow;
            var yearFolder = now.Year.ToString();
            var monthFolder = now.Month.ToString("D2");
            var relativeFolder = Path.Combine("media", "help", yearFolder, monthFolder);

            // Obtener ruta física del directorio wwwroot
            var webRootPath = _environment.WebRootPath;
            if (string.IsNullOrEmpty(webRootPath))
            {
                _logger.LogError("WebRootPath no está configurado");
                return CommonErrors.InternalServerError("El directorio web no está configurado.");
            }

            var fullFolderPath = Path.Combine(webRootPath, relativeFolder);

            // Crear directorio si no existe
            if (!Directory.Exists(fullFolderPath))
            {
                Directory.CreateDirectory(fullFolderPath);
                _logger.LogDebug("Directorio creado: {Directory}", fullFolderPath);
            }

            // Ruta completa del archivo
            var fullFilePath = Path.Combine(fullFolderPath, fileName);
            var relativePath = $"/api/media/help/{yearFolder}/{monthFolder}/{fileName}";

            // Guardar archivo en disco
            using (var fileStream = new FileStream(fullFilePath, FileMode.Create))
            {
                await stream.CopyToAsync(fileStream, ct);
            }

            _logger.LogDebug("Archivo guardado en: {FilePath}", fullFilePath);

            // Crear registro en base de datos
            Console.WriteLine($"[DEBUG HelpImageService] Creando entidad HelpImage...");
            var helpImage = new HelpImage
            {
                NombreOriginal = originalFileName,
                NombreArchivo = fileName,
                RutaRelativa = relativePath,
                TamanhoBytes = stream.Length,
                MimeType = contentType,
                Ancho = null, // Se podría implementar lectura de dimensiones con una librería de imágenes
                Alto = null,
                FechaSubida = DateTime.UtcNow,
                SubidoPor = uploadedBy
            };
            Console.WriteLine($"[DEBUG HelpImageService] Entidad creada, llamando a _repository.CreateAsync...");

            var savedImage = await _repository.CreateAsync(helpImage, ct);
            Console.WriteLine($"[DEBUG HelpImageService] Imagen guardada en DB - Id: {savedImage.Id}");

            _logger.LogInformation("Imagen de ayuda cargada exitosamente: {ImageId} - {FileName}", savedImage.Id, savedImage.NombreArchivo);

            return MapToResponse(savedImage);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DEBUG HelpImageService] EXCEPCIÓN: {ex.GetType().Name}");
            Console.WriteLine($"[DEBUG HelpImageService] Mensaje: {ex.Message}");
            Console.WriteLine($"[DEBUG HelpImageService] StackTrace: {ex.StackTrace}");
            if (ex.InnerException != null)
            {
                Console.WriteLine($"[DEBUG HelpImageService] InnerException: {ex.InnerException.Message}");
            }
            _logger.LogError(ex, "Error al cargar imagen de ayuda: {FileName}", originalFileName);
            return CommonErrors.InternalServerError("Error al procesar la imagen. Intente nuevamente.");
        }
    }

    /// <summary>
    /// Mapea una entidad HelpImage a HelpImageUploadResponse.
    /// </summary>
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
