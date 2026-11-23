namespace Lefarma.API.Infrastructure.Files;

public interface IFileCipher
{
    Task<string> SaveEncryptedAsync(Stream plain, string directorio, string nombreArchivo, CancellationToken ct = default);

    Task<byte[]?> ReadDecryptedAsync(string directorio, string nombreArchivo, CancellationToken ct = default);

    void DeleteEncrypted(string directorio, string nombreArchivo);

    IReadOnlyList<string> ListLogicalNames(string directorio, string searchPattern);
}
