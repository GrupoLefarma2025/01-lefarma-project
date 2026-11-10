using System.Text.Json;

namespace Lefarma.API.Features.Configuracion.DTOs;

/// <summary>Filtros de listado de variables de configuración.</summary>
public sealed class ConfiguracionFiltros
{
    public string? Buscar { get; set; }

    public string? Tipo { get; set; }

    /// <summary>backend | frontend | sql | integraciones</summary>
    public string? Destino { get; set; }

    public bool? Activo { get; set; }
}

/// <summary>Variable de configuración expuesta por la API.</summary>
public sealed class ConfigVariableResponse
{
    public long IdVariable { get; set; }

    public string Clave { get; set; } = string.Empty;

    public string Nombre { get; set; } = string.Empty;

    public string? Descripcion { get; set; }

    public string TipoDato { get; set; } = string.Empty;

    /// <summary>Valor como JSON real (no doblemente escapado).</summary>
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
}

/// <summary>Alta de una variable de configuración.</summary>
public sealed class CreateConfigVariableRequest
{
    /// <summary>Identificador idempotente de la operación.</summary>
    public Guid IdOperacion { get; set; }

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

/// <summary>
/// Actualización de una variable. La clave y el tipo de dato son inmutables:
/// si se envían deben coincidir con los actuales.
/// </summary>
public sealed class UpdateConfigVariableRequest
{
    public Guid IdOperacion { get; set; }

    /// <summary>Versión leída por el cliente (concurrencia optimista).</summary>
    public long VersionEsperada { get; set; }

    /// <summary>Si se envía, debe ser igual a la clave actual.</summary>
    public string? Clave { get; set; }

    /// <summary>Si se envía, debe ser igual al tipo actual.</summary>
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

/// <summary>Desactivar o reactivar una variable.</summary>
public sealed class CambiarEstadoVariableRequest
{
    public Guid IdOperacion { get; set; }

    public long VersionEsperada { get; set; }
}

/// <summary>Restaurar una versión anterior de una variable como un cambio nuevo.</summary>
public sealed class RestaurarVariableRequest
{
    public Guid IdOperacion { get; set; }

    public long IdBitacoraOrigen { get; set; }

    public long VersionEsperada { get; set; }
}

/// <summary>Entrada resumida de la bitácora.</summary>
public class BitacoraResumenResponse
{
    public long IdBitacora { get; set; }

    public long IdVariable { get; set; }

    public string Clave { get; set; } = string.Empty;

    /// <summary>crear | actualizar | desactivar | reactivar | restaurar</summary>
    public string Accion { get; set; } = string.Empty;

    public long? IdBitacoraOrigen { get; set; }

    public int? IdUsuario { get; set; }

    public DateTime FechaCreacion { get; set; }
}

/// <summary>Detalle completo de una entrada de bitácora.</summary>
public sealed class BitacoraDetalleResponse : BitacoraResumenResponse
{
    public Guid IdOperacion { get; set; }

    public JsonElement? DatosAnteriores { get; set; }

    public JsonElement DatosNuevos { get; set; }
}
