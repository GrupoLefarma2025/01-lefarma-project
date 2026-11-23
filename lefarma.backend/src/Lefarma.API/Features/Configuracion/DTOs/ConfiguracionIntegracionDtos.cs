using System.Text.Json;

namespace Lefarma.API.Features.Configuracion.DTOs;

public sealed class CrearIntegracionRequest
{
    public string Nombre { get; set; } = string.Empty;

    public DateTime? FechaExpiracion { get; set; }

    public List<string>? ClavesPermitidas { get; set; }
}

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

public sealed class IntegracionCreadaResponse : IntegracionClienteResponse
{
    public string Llave { get; set; } = string.Empty;
}

public sealed class IntegracionConsultarRequest
{
    public List<string> Claves { get; set; } = new();
}

public sealed class IntegracionVariableResponse
{
    public string Clave { get; set; } = string.Empty;

    public string TipoDato { get; set; } = string.Empty;

    public JsonElement Valor { get; set; }

    public long Revision { get; set; }
}

public sealed class IntegracionBatchResponse
{
    public List<IntegracionVariableResponse> Variables { get; set; } = new();
}
