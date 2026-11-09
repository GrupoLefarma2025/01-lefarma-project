using System.Text.Json;

namespace Lefarma.API.Features.Configuracion.DTOs;

/// <summary>Alta de un cliente de integración (API key).</summary>
public sealed class CrearIntegracionRequest
{
    public string Nombre { get; set; } = string.Empty;

    public DateTime? FechaExpiracion { get; set; }

    /// <summary>Claves exactas o prefijos terminados en '*'. null/ vacío = todas las disponibles.</summary>
    public List<string>? ClavesPermitidas { get; set; }
}

/// <summary>Cliente de integración listado (nunca incluye llave completa ni hash).</summary>
public class IntegracionClienteResponse
{
    public int IdIntegracion { get; set; }

    public string Nombre { get; set; } = string.Empty;

    public string PrefijoLlave { get; set; } = string.Empty;

    public List<string>? ClavesPermitidas { get; set; }

    public bool Activo { get; set; }

    public DateTime FechaCreacion { get; set; }

    public DateTime? FechaExpiracion { get; set; }

    public DateTime? UltimaUtilizacion { get; set; }
}

/// <summary>Respuesta del alta: incluye la llave completa UNA sola vez.</summary>
public sealed class IntegracionCreadaResponse : IntegracionClienteResponse
{
    public string Llave { get; set; } = string.Empty;
}

/// <summary>Consulta por lote del API externo.</summary>
public sealed class IntegracionConsultarRequest
{
    public List<string> Claves { get; set; } = new();
}

/// <summary>Variable expuesta al API externo (sin ApiResponse).</summary>
public sealed class IntegracionVariableResponse
{
    public string Clave { get; set; } = string.Empty;

    public string TipoDato { get; set; } = string.Empty;

    public JsonElement Valor { get; set; }

    public long Revision { get; set; }
}

/// <summary>Respuesta por lote del API externo.</summary>
public sealed class IntegracionBatchResponse
{
    public List<IntegracionVariableResponse> Variables { get; set; } = new();
}
