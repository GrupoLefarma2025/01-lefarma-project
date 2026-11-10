namespace Lefarma.API.Features.Archivos.Notifications;

/// <summary>
/// Datos mínimos de un archivo eliminado que viajan al notificador fuera del
/// scope del request. Se capturan antes del borrado lógico porque la entidad
/// queda inactiva y fuera de seguimiento al terminar la petición.
/// </summary>
public sealed record ArchivoEliminadoEvento(
    int IdArchivo,
    string EntidadTipo,
    int EntidadId,
    string Carpeta,
    string NombreOriginal,
    string Extension,
    long TamanoBytes,
    string? Metadata,
    DateTime FechaCreacion,
    int? IdUsuarioSubio,
    int? IdUsuarioElimina,
    DateTime FechaEliminacion);
