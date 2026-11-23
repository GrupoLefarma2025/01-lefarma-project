namespace Lefarma.API.Domain.Entities.Configuracion;

public class ConfigModulo
{
    public long IdModulo { get; set; }

    public string Clave { get; set; } = string.Empty;

    public string Nombre { get; set; } = string.Empty;

    public string? Descripcion { get; set; }

    public string? Color { get; set; }

    public bool Activo { get; set; } = true;

    public DateTime FechaCreacion { get; set; }

    public DateTime FechaModificacion { get; set; }

    public int? IdUsuarioCreacion { get; set; }

    public int? IdUsuarioModificacion { get; set; }

}
