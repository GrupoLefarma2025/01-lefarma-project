namespace Lefarma.API.Infrastructure.Files;

/// <summary>
/// Cifrado en reposo (AES-256-GCM) para archivos sensibles (firmas e INE).
/// Convención: en disco el archivo se guarda como {nombreArchivo}.enc dentro del
/// directorio indicado; el nombre lógico (sin .enc) es el que se persiste en
/// BD/JSON como referencia estable de la versión.
/// </summary>
public interface IFileCipher
{
    /// <summary>Cifra el contenido del stream y lo escribe como {directorio}/{nombreArchivo}.enc. Devuelve la ruta completa.</summary>
    Task<string> SaveEncryptedAsync(Stream plain, string directorio, string nombreArchivo, CancellationToken ct = default);

    /// <summary>Descifra {directorio}/{nombreArchivo}.enc. Null si no existe.</summary>
    Task<byte[]?> ReadDecryptedAsync(string directorio, string nombreArchivo, CancellationToken ct = default);

    /// <summary>Elimina {directorio}/{nombreArchivo}.enc si existe.</summary>
    void DeleteEncrypted(string directorio, string nombreArchivo);

    /// <summary>Lista nombres lógicos (sin .enc) de archivos cifrados que cumplan el patrón (p.ej. "70_*"), ordenados descendente.</summary>
    IReadOnlyList<string> ListLogicalNames(string directorio, string searchPattern);
}
