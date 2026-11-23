using System.Security.Cryptography;
using Lefarma.API.Features.Sigma.Config;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Sigma;

public sealed class SigmaDocumentStorage
{
    private const string NombreArchivoInicial = "archivo_inicial.pdf";
    private const string NombreArchivoFirmado = "archivo_firmado.pdf";

    private readonly string _raiz;
    private readonly long _maxUploadBytes;
    private readonly ILogger<SigmaDocumentStorage> _logger;

    public SigmaDocumentStorage(
        IOptions<SigmaOptions> options,
        IHostEnvironment environment,
        ILogger<SigmaDocumentStorage> logger)
    {
        _logger = logger;

        var configurada = options.Value.StoragePath;
        if (string.IsNullOrWhiteSpace(configurada))
        {
            configurada = "App_Data/sigma-documentos";
        }

        _raiz = Path.IsPathRooted(configurada)
            ? Path.GetFullPath(configurada)
            : Path.GetFullPath(Path.Combine(environment.ContentRootPath, configurada));

        _maxUploadBytes = options.Value.MaxUploadBytes > 0 ? options.Value.MaxUploadBytes : 52_428_800;
    }

    public string Raiz => _raiz;

    public long MaxUploadBytes => _maxUploadBytes;

    public string? ValidarPdf(IFormFile? archivo)
    {
        if (archivo is null || archivo.Length == 0)
        {
            return "Debe proporcionar un archivo PDF";
        }

        if (!string.Equals(Path.GetExtension(archivo.FileName), ".pdf", StringComparison.OrdinalIgnoreCase))
        {
            return "El archivo debe ser un PDF";
        }

        if (archivo.Length > _maxUploadBytes)
        {
            return $"El archivo supera el tamaño máximo permitido ({_maxUploadBytes / (1024 * 1024)} MB)";
        }

        return null;
    }

    public Task<ArchivoGuardado> GuardarInicialAsync(Guid idDocumento, IFormFile archivo, CancellationToken ct = default)
    {
        var directorio = Path.Combine(_raiz, idDocumento.ToString("D"));
        var ruta = Path.Combine(directorio, NombreArchivoInicial);
        return GuardarAsync(directorio, ruta, archivo, ct);
    }

    public Task<ArchivoGuardado> GuardarInicialGrupoAsync(Guid idGrupo, Guid idDocumento, IFormFile archivo, CancellationToken ct = default)
    {
        var directorio = Path.Combine(_raiz, idGrupo.ToString("D"));
        var ruta = Path.Combine(directorio, $"{idDocumento:D}_inicial.pdf");
        return GuardarAsync(directorio, ruta, archivo, ct);
    }

    public string? PrepararArchivoFirmado(string? rutaArchivoInicial)
    {
        if (string.IsNullOrWhiteSpace(rutaArchivoInicial) || !File.Exists(rutaArchivoInicial))
        {
            return null;
        }

        var rutaFirmado = DerivarRutaFirmado(rutaArchivoInicial);
        var directorio = Path.GetDirectoryName(rutaFirmado);
        if (!string.IsNullOrWhiteSpace(directorio))
        {
            Directory.CreateDirectory(directorio);
        }

        if (!File.Exists(rutaFirmado))
        {
            File.Copy(rutaArchivoInicial, rutaFirmado, overwrite: true);
            _logger.LogInformation("Copia inicial→firmado generada en {Ruta}", rutaFirmado);
        }

        return rutaFirmado;
    }

    public string RutaFirmado(Guid idDocumento) =>
        Path.Combine(_raiz, idDocumento.ToString("D"), NombreArchivoFirmado);

    public static string SanearNombreArchivo(string? nombre)
    {
        if (string.IsNullOrWhiteSpace(nombre))
        {
            return "documento.pdf";
        }

        var soloNombre = Path.GetFileName(nombre.Trim());
        var invalidos = Path.GetInvalidFileNameChars();
        var limpio = new string(soloNombre.Where(c => !invalidos.Contains(c)).ToArray()).Trim();
        return string.IsNullOrWhiteSpace(limpio) ? "documento.pdf" : limpio;
    }

    private async Task<ArchivoGuardado> GuardarAsync(string directorio, string rutaDestino, IFormFile archivo, CancellationToken ct)
    {
        Directory.CreateDirectory(directorio);

        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        await using (var destino = new FileStream(rutaDestino, FileMode.Create, FileAccess.Write, FileShare.None, 81920, useAsync: true))
        await using (var origen = archivo.OpenReadStream())
        {
            var buffer = new byte[81920];
            int leidos;
            while ((leidos = await origen.ReadAsync(buffer, ct)) > 0)
            {
                hash.AppendData(buffer, 0, leidos);
                await destino.WriteAsync(buffer.AsMemory(0, leidos), ct);
            }
        }

        var sha256 = Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant();
        _logger.LogInformation("PDF guardado en {Ruta} ({Bytes} bytes)", rutaDestino, archivo.Length);

        return new ArchivoGuardado(rutaDestino, archivo.Length, sha256);
    }

    private static string DerivarRutaFirmado(string rutaArchivoInicial)
    {
        var directorio = Path.GetDirectoryName(rutaArchivoInicial) ?? string.Empty;
        var nombre = Path.GetFileName(rutaArchivoInicial);

        if (nombre.EndsWith("_inicial.pdf", StringComparison.OrdinalIgnoreCase))
        {
            return Path.Combine(directorio, nombre[..^"_inicial.pdf".Length] + "_firmado.pdf");
        }

        return Path.Combine(directorio, NombreArchivoFirmado);
    }
}

public sealed record ArchivoGuardado(string RutaAbsoluta, long TamanoBytes, string HashSHA256);
