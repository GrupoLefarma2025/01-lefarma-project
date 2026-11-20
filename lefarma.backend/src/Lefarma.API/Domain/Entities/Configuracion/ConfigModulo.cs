namespace Lefarma.API.Domain.Entities.Configuracion;

/// <summary>
/// Módulo del catálogo de configuración (schema config.modulos).
/// Agrupa variables y su clave es el prefijo estable de la clave de éstas
/// (modulo.namespace.clave). El módulo global acoge las variables compartidas.
/// </summary>
public class ConfigModulo
{
    public long IdModulo { get; set; }

    /// <summary>Slug en minúsculas (letras, números y guion bajo). Inmutable.</summary>
    public string Clave { get; set; } = string.Empty;

    public string Nombre { get; set; } = string.Empty;

    public string? Descripcion { get; set; }

    /// <summary>Color hex #rrggbb con el que se identifica el módulo en la UI.</summary>
    public string? Color { get; set; }

    public bool Activo { get; set; } = true;

    public DateTime FechaCreacion { get; set; }

    public DateTime FechaModificacion { get; set; }

    public int? IdUsuarioCreacion { get; set; }

    public int? IdUsuarioModificacion { get; set; }

    // NOTA: row_version (ROWVERSION) existe en la tabla pero no se mapea en EF.
}
