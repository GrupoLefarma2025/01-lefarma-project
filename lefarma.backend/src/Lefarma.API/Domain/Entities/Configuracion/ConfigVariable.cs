namespace Lefarma.API.Domain.Entities.Configuracion;

/// <summary>
/// Variable global de configuración del sistema (schema config.variables).
/// El valor se persiste siempre como JSON canónico en <see cref="ValorJson"/>.
/// La clave y el tipo de dato son inmutables una vez creada la variable.
/// </summary>
public class ConfigVariable
{
    public long IdVariable { get; set; }

    public string Clave { get; set; } = string.Empty;

    public string Nombre { get; set; } = string.Empty;

    public string? Descripcion { get; set; }

    /// <summary>string | text | integer | decimal | boolean | date | time | datetime | enum | object | array | json</summary>
    public string TipoDato { get; set; } = string.Empty;

    /// <summary>Valor serializado como JSON canónico (siempre JSON válido).</summary>
    public string ValorJson { get; set; } = "null";

    /// <summary>Subconjunto de JSON Schema usado por la UI y por la validación.</summary>
    public string? EsquemaJson { get; set; }

    public bool DisponibleBackend { get; set; }

    public bool DisponibleFrontend { get; set; }

    public bool DisponibleSql { get; set; }

    public bool DisponibleIntegraciones { get; set; }

    public bool Activo { get; set; } = true;

    public DateTime FechaCreacion { get; set; }

    public DateTime FechaModificacion { get; set; }

    public int? IdUsuarioCreacion { get; set; }

    public int? IdUsuarioModificacion { get; set; }

    /// <summary>Versión para control de concurrencia optimista (arranca en 1).</summary>
    public long Version { get; set; }

    // NOTA: la columna row_version (ROWVERSION de SQL Server) existe en la tabla pero
    // no se mapea en EF: el control de concurrencia optimista del módulo usa Version.

    public ICollection<ConfigVariableBitacora> Bitacora { get; set; } = new List<ConfigVariableBitacora>();
}
