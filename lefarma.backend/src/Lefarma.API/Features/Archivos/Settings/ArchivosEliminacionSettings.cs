namespace Lefarma.API.Features.Archivos.Settings;

/// <summary>
/// Configuración del aviso por correo que se envía al eliminar un archivo de una
/// orden de compra. Los correos del creador de la OC no se configuran aquí: se
/// resuelven con el propio creador del archivo.
/// </summary>
public class ArchivosEliminacionSettings
{
    /// <summary>
    /// Correos adicionales que reciben el aviso además del creador de la OC.
    /// Mientras esté vacío, el aviso solo se envía al creador.
    /// </summary>
    public List<string> CorreosAdicionales { get; set; } = [];
}
