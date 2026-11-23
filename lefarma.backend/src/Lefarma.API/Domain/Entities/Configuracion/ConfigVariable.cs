namespace Lefarma.API.Domain.Entities.Configuracion;

public class ConfigVariable
{
    public long IdVariable { get; set; }

    public string Clave { get; set; } = string.Empty;

    public string Nombre { get; set; } = string.Empty;

    public string? Descripcion { get; set; }

    public string TipoDato { get; set; } = string.Empty;

    public string ValorJson { get; set; } = "null";

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

    public long Version { get; set; }

    public long? IdModulo { get; set; }

    public ConfigModulo? Modulo { get; set; }

public ICollection<ConfigVariableBitacora> Bitacora { get; set; } = new List<ConfigVariableBitacora>();
}
