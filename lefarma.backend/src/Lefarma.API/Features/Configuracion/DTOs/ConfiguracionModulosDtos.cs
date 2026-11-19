namespace Lefarma.API.Features.Configuracion.DTOs;

/// <summary>Módulo de configuración expuesto por la API.</summary>
public sealed class ConfigModuloResponse
{
    public long IdModulo { get; set; }

    public string Clave { get; set; } = string.Empty;

    public string Nombre { get; set; } = string.Empty;

    public string? Descripcion { get; set; }

    public int Orden { get; set; }

    public bool Activo { get; set; }

    /// <summary>Variables ligadas al módulo (incluye inactivas).</summary>
    public int TotalVariables { get; set; }

    public DateTime FechaCreacion { get; set; }

    public DateTime FechaModificacion { get; set; }
}

/// <summary>Alta de un módulo.</summary>
public sealed class CreateConfigModuloRequest
{
    /// <summary>Slug en minúsculas; será el prefijo de las claves del módulo.</summary>
    public string Clave { get; set; } = string.Empty;

    public string Nombre { get; set; } = string.Empty;

    public string? Descripcion { get; set; }

    public int Orden { get; set; }
}

/// <summary>Actualización de un módulo. La clave es inmutable.</summary>
public sealed class UpdateConfigModuloRequest
{
    public string Nombre { get; set; } = string.Empty;

    public string? Descripcion { get; set; }

    public int Orden { get; set; }
}
