using ErrorOr;
using Lefarma.API.Features.Archivos.Settings;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Archivos.Conversores;

public interface IOfficeToPdfConverter
{
    bool CanConvert(string extension);
    Task<ErrorOr<string>> ConvertToPdfAsync(string inputPath, string outputDirectory, CancellationToken cancellationToken = default);
}

public class OfficeToPdfConverter : IOfficeToPdfConverter
{
    private readonly ArchivosSettings _settings;
    private readonly ILogger<OfficeToPdfConverter> _logger;

    private static readonly string[] OfficeExtensions = { ".docx", ".xlsx", ".pptx", ".doc", ".xls", ".ppt" };

    public OfficeToPdfConverter(
        IOptions<ArchivosSettings> settings,
        ILogger<OfficeToPdfConverter> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public bool CanConvert(string extension)
    {
        return OfficeExtensions.Contains(extension.ToLowerInvariant());
    }

    public async Task<ErrorOr<string>> ConvertToPdfAsync(string inputPath, string outputDirectory, CancellationToken cancellationToken = default)
    {
        try
        {
            if (!File.Exists(inputPath))
                return Error.Failure("Archivo.NotFound", "El archivo no existe");

            var fileNameWithoutExt = Path.GetFileNameWithoutExtension(inputPath);
            var outputPath = Path.Combine(outputDirectory, $"{fileNameWithoutExt}.pdf");

            var startInfo = new System.Diagnostics.ProcessStartInfo
            {
                FileName = _settings.LibreOfficePath,
                Arguments = $"--headless --convert-to pdf --outdir \"{outputDirectory}\" \"{inputPath}\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };

            _logger.LogInformation("Convirtiendo {InputPath} a PDF usando LibreOffice", inputPath);

            using var process = System.Diagnostics.Process.Start(startInfo);
            if (process == null)
            {
                _logger.LogError("No se pudo iniciar el proceso de LibreOffice");
                return Error.Failure("Archivo.ConversionFailed", "No se pudo iniciar LibreOffice");
            }

            await process.WaitForExitAsync(cancellationToken);

            if (process.ExitCode != 0)
            {
                var error = await process.StandardError.ReadToEndAsync(cancellationToken);
                _logger.LogError("LibreOffice falló con código {ExitCode}: {Error}", process.ExitCode, error);
                return Error.Failure("Archivo.ConversionFailed", $"LibreOffice falló: {error}");
            }

            if (!File.Exists(outputPath))
            {
                _logger.LogError("El archivo PDF no fue generado en {OutputPath}", outputPath);
                return Error.Failure("Archivo.ConversionFailed", "El archivo PDF no fue generado");
            }

            _logger.LogInformation("Archivo convertido exitosamente a {OutputPath}", outputPath);
            return outputPath;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error convirtiendo archivo a PDF");
            return Error.Failure("Archivo.ConversionFailed", ex.Message);
        }
    }
}
