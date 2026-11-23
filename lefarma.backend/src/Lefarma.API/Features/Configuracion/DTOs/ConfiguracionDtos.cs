using System.Text.Json;

namespace Lefarma.API.Features.Configuracion.DTOs;

public sealed class ConfiguracionFiltros
{
    public string? Buscar { get; set; }

    public string? Tipo { get; set; }

    public string? Destino { get; set; }

    public bool? Activo { get; set; }

    public long? IdModulo { get; set; }
}

public sealed class ConfigVariableResponse
{
    public long IdVariable { get; set; }

    public string Clave { get; set; } = string.Empty;

    public string Nombre { get; set; } = string.Empty;

    public string? Descripcion { get; set; }

    public string TipoDato { get; set; } = string.Empty;

    public JsonElement Valor { get; set; }

    public JsonElement? Esquema { get; set; }

    public bool DisponibleBackend { get; set; }

    public bool DisponibleFrontend { get; set; }

    public bool DisponibleSql { get; set; }

    public bool DisponibleIntegraciones { get; set; }

    public bool Activo { get; set; }

    public long Version { get; set; }

    public DateTime FechaCreacion { get; set; }

    public DateTime FechaModificacion { get; set; }

    public int? IdUsuarioCreacion { get; set; }

    public int? IdUsuarioModificacion { get; set; }

    public long? IdModulo { get; set; }
}

public sealed class CreateConfigVariableRequest
{
    public Guid IdOperacion { get; set; }

    public long? IdModulo { get; set; }

    public string Clave { get; set; } = string.Empty;

    public string Nombre { get; set; } = string.Empty;

    public string? Descripcion { get; set; }

    public string TipoDato { get; set; } = string.Empty;

    public JsonElement Valor { get; set; }

    public JsonElement? Esquema { get; set; }

    public bool DisponibleBackend { get; set; } = true;

    public bool DisponibleFrontend { get; set; }

    public bool DisponibleSql { get; set; }

    public bool DisponibleIntegraciones { get; set; }
}

public sealed class UpdateConfigVariableRequest
{
    public Guid IdOperacion { get; set; }

    public long VersionEsperada { get; set; }

    public string? Clave { get; set; }

    public string? TipoDato { get; set; }

    public string Nombre { get; set; } = string.Empty;

    public string? Descripcion { get; set; }

    public JsonElement Valor { get; set; }

    public JsonElement? Esquema { get; set; }

    public bool DisponibleBackend { get; set; }

    public bool DisponibleFrontend { get; set; }

    public bool DisponibleSql { get; set; }

    public bool DisponibleIntegraciones { get; set; }
}

public sealed class CambiarEstadoVariableRequest
{
    public Guid IdOperacion { get; set; }

    public long VersionEsperada { get; set; }
}

public sealed class RestaurarVariableRequest
{
    public Guid IdOperacion { get; set; }

    public long IdBitacoraOrigen { get; set; }

    public long VersionEsperada { get; set; }
}

public class BitacoraResumenResponse
{
    public long IdBitacora { get; set; }

    public long IdVariable { get; set; }

    public string Clave { get; set; } = string.Empty;

    public string Accion { get; set; } = string.Empty;

    public long? IdBitacoraOrigen { get; set; }

    public int? IdUsuario { get; set; }

    public DateTime FechaCreacion { get; set; }
}

public sealed class BitacoraDetalleResponse : BitacoraResumenResponse
{
    public Guid IdOperacion { get; set; }

    public JsonElement? DatosAnteriores { get; set; }

    public JsonElement DatosNuevos { get; set; }
}
