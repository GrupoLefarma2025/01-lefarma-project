namespace Lefarma.API.Features.Configuracion.DTOs;

public sealed class ConfigModuloResponse
{
    public long IdModulo { get; set; }

    public string Clave { get; set; } = string.Empty;

    public string Nombre { get; set; } = string.Empty;

    public string? Descripcion { get; set; }

    public string? Color { get; set; }

    public bool Activo { get; set; }

    public int TotalVariables { get; set; }

    public DateTime FechaCreacion { get; set; }

    public DateTime FechaModificacion { get; set; }
}

public sealed class CreateConfigModuloRequest
{
    public string Clave { get; set; } = string.Empty;

    public string Nombre { get; set; } = string.Empty;

    public string? Descripcion { get; set; }

    public string? Color { get; set; }
}

public sealed class UpdateConfigModuloRequest
{
    public string Nombre { get; set; } = string.Empty;

    public string? Descripcion { get; set; }

    public string? Color { get; set; }
}
