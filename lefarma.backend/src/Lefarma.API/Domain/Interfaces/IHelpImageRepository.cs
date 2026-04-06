using Lefarma.API.Domain.Entities.Help;

namespace Lefarma.API.Domain.Interfaces;
/// <summary>
/// Repositorio para operaciones de imágenes de ayuda.
/// </summary>
public interface IHelpImageRepository
{
    /// <summary>
    /// Crea un nuevo registro de imagen de ayuda.
    /// </summary>
    /// <param name="helpImage">La entidad de imagen a crear.</param>
    /// <param name="ct">Token de cancelación.</param>
    /// <returns>La imagen creada con su ID asignado.</returns>
    Task<HelpImage> CreateAsync(HelpImage helpImage, CancellationToken ct);

    /// <summary>
    /// Obtiene una imagen de ayuda por su nombre de archivo.
    /// </summary>
    /// <param name="nombreArchivo">Nombre del archivo (GUID con extensión).</param>
    /// <param name="ct">Token de cancelación.</param>
    /// <returns>La imagen encontrada o null si no existe.</returns>
    Task<HelpImage?> GetByFileNameAsync(string nombreArchivo, CancellationToken ct);
}
