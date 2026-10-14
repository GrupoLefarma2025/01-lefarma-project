using System.Text.Json;
using System.Text.Json.Serialization;

namespace Lefarma.API.Features.Viaticos.DTOs;

/// <summary>
/// Cuerpo del POST /api/viaticos/capturas. Acepta una lista mixta:
/// strings (solo URL) u objetos { url, nombre } (mismo contrato que el script
/// captura-viaticos.mjs de T7). El model binder recibe JsonElements y el
/// controller los normaliza a <see cref="CapturaItem"/>.
/// </summary>
public class CapturaRequest
{
    [JsonPropertyName("urls")]
    public List<JsonElement>? Urls { get; set; }
}

/// <summary>Item normalizado que el servicio procesa.</summary>
public class CapturaItem
{
    public string Url { get; set; } = string.Empty;
    public string? Nombre { get; set; }
}

/// <summary>Salida por URL (mismo shape que captura-viaticos.mjs).</summary>
public class CapturaResultDto
{
    [JsonPropertyName("url")]
    public string? Url { get; set; }

    [JsonPropertyName("ok")]
    public bool Ok { get; set; }

    [JsonPropertyName("archivo")]
    public string? Archivo { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }
}
