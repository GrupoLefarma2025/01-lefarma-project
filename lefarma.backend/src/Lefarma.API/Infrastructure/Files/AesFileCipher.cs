using System.Security.Cryptography;
using Lefarma.API.Features.Archivos.Settings;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Infrastructure.Files;

/// <summary>
/// AES-256-GCM sobre disco. Envelope por archivo: [magic "LFC1"][nonce 12][tag 16][ciphertext].
/// La clave viene de ArchivosSettings:EncryptionKey (base64, 32 bytes).
/// </summary>
public class AesFileCipher : IFileCipher
{
    private static readonly byte[] Magic = "LFC1"u8.ToArray();
    private const int NonceSize = 12;
    private const int TagSize = 16;

    private readonly byte[] _key;

    public AesFileCipher(IOptions<ArchivosSettings> settings)
    {
        var keyB64 = settings.Value.EncryptionKey;
        if (string.IsNullOrWhiteSpace(keyB64))
            throw new InvalidOperationException(
                "ArchivosSettings:EncryptionKey no está configurada (base64 de 32 bytes). Sin clave no se pueden cifrar firmas/INE.");

        byte[] key;
        try
        {
            key = Convert.FromBase64String(keyB64);
        }
        catch (FormatException ex)
        {
            throw new InvalidOperationException("ArchivosSettings:EncryptionKey no es base64 válido.", ex);
        }

        if (key.Length != 32)
            throw new InvalidOperationException(
                $"ArchivosSettings:EncryptionKey debe decodificar a 32 bytes (AES-256); decodificó {key.Length}.");

        _key = key;
    }

    public async Task<string> SaveEncryptedAsync(Stream plain, string directorio, string nombreArchivo, CancellationToken ct = default)
    {
        ValidateNombreArchivo(nombreArchivo);
        Directory.CreateDirectory(directorio);
        var path = Path.Combine(directorio, nombreArchivo + ".enc");

        using var ms = new MemoryStream();
        await plain.CopyToAsync(ms, ct);
        var plainBytes = ms.ToArray();

        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var tag = new byte[TagSize];
        var cipherBytes = new byte[plainBytes.Length];
        using (var aes = new AesGcm(_key, TagSize))
            aes.Encrypt(nonce, plainBytes, cipherBytes, tag);

        await using var fs = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None);
        await fs.WriteAsync(Magic, ct);
        await fs.WriteAsync(nonce, ct);
        await fs.WriteAsync(tag, ct);
        await fs.WriteAsync(cipherBytes, ct);
        return path;
    }

    public async Task<byte[]?> ReadDecryptedAsync(string directorio, string nombreArchivo, CancellationToken ct = default)
    {
        ValidateNombreArchivo(nombreArchivo);
        var path = Path.Combine(directorio, nombreArchivo + ".enc");
        if (!File.Exists(path))
            return null;

        var data = await File.ReadAllBytesAsync(path, ct);
        var headerSize = Magic.Length + NonceSize + TagSize;
        if (data.Length < headerSize || !data.AsSpan(0, Magic.Length).SequenceEqual(Magic))
            throw new InvalidDataException($"El archivo cifrado no tiene el formato esperado: {path}");

        var nonce = data.AsSpan(Magic.Length, NonceSize);
        var tag = data.AsSpan(Magic.Length + NonceSize, TagSize);
        var cipherBytes = data.AsSpan(headerSize);
        var plain = new byte[cipherBytes.Length];
        using (var aes = new AesGcm(_key, TagSize))
            aes.Decrypt(nonce, cipherBytes, tag, plain);
        return plain;
    }

    public void DeleteEncrypted(string directorio, string nombreArchivo)
    {
        ValidateNombreArchivo(nombreArchivo);
        var path = Path.Combine(directorio, nombreArchivo + ".enc");
        if (File.Exists(path))
            File.Delete(path);
    }

    public IReadOnlyList<string> ListLogicalNames(string directorio, string searchPattern)
    {
        if (!Directory.Exists(directorio))
            return [];

        return Directory.EnumerateFiles(directorio, searchPattern + ".enc")
            .Select(Path.GetFileNameWithoutExtension)
            .Where(n => !string.IsNullOrEmpty(n))
            .Select(n => n!)
            .OrderByDescending(n => n, StringComparer.Ordinal)
            .ToList();
    }

    private static void ValidateNombreArchivo(string nombreArchivo)
    {
        if (string.IsNullOrWhiteSpace(nombreArchivo)
            || nombreArchivo != Path.GetFileName(nombreArchivo)
            || nombreArchivo.Contains("..", StringComparison.Ordinal))
            throw new ArgumentException($"Nombre de archivo inválido para cifrado: '{nombreArchivo}'.", nameof(nombreArchivo));
    }
}
