namespace Lefarma.API.Domain.Entities.Configuracion;

/// <summary>
/// Cliente externo autorizado a consumir variables de configuración
/// (schema config.integraciones). Solo se guarda el hash SHA-256 de la llave.
/// </summary>
public class ConfigIntegracion
{
    public int IdIntegracion { get; set; }

    public string Nombre { get; set; } = string.Empty;

    /// <summary>Prefijo visible de la llave (nunca la llave completa).</summary>
    public string PrefijoLlave { get; set; } = string.Empty;

    /// <summary>SHA-256 en hexadecimal (64 caracteres) de la llave completa.</summary>
    public string HashLlave { get; set; } = string.Empty;

    /// <summary>Array JSON de claves o prefijos terminados en '*' (null = todas).</summary>
    public string? ClavesPermitidasJson { get; set; }

    public bool Activo { get; set; } = true;

    public DateTime FechaCreacion { get; set; }

    public DateTime? FechaExpiracion { get; set; }

    public DateTime? UltimaUtilizacion { get; set; }
}
