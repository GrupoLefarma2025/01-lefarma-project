namespace Lefarma.API.Domain.Entities.Configuracion;

public class ConfigIntegracion
{
    public int IdIntegracion { get; set; }

    public string Nombre { get; set; } = string.Empty;

    public string PrefijoLlave { get; set; } = string.Empty;

    public string HashLlave { get; set; } = string.Empty;

    public string? ClavesPermitidasJson { get; set; }

    public bool Activo { get; set; } = true;

    public DateTime FechaCreacion { get; set; }

    public DateTime? FechaExpiracion { get; set; }

    public DateTime? UltimaUtilizacion { get; set; }
}
