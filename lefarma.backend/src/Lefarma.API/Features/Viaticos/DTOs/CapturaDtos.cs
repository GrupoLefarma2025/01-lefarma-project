using System.Text.Json;
using System.Text.Json.Serialization;

namespace Lefarma.API.Features.Viaticos.DTOs;

public class CapturaRequest
{
    [JsonPropertyName("urls")]
    public List<JsonElement>? Urls { get; set; }
}

public class CapturaItem
{
    public string Url { get; set; } = string.Empty;
    public string? Nombre { get; set; }
    public string? Tipo { get; set; }
    public string? Linea { get; set; }
    public decimal? Precio { get; set; }
    public string? Salida { get; set; }
    public string? Llegada { get; set; }
    public string? Objetivo { get; set; }
}

public class CapturaResultDto
{
    [JsonPropertyName("url")]
    public string? Url { get; set; }

    [JsonPropertyName("ok")]
    public bool Ok { get; set; }

    [JsonPropertyName("archivo")]
    public string? Archivo { get; set; }

    [JsonPropertyName("alcance")]
    public string? Alcance { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }
}

public class AdjuntarCapturaRequest
{
    public IFormFile? Archivo { get; set; }

    public string? Nombre { get; set; }
}

public class CapturarEvidenciasRequest
{
    [JsonPropertyName("forzar")]
    public bool Forzar { get; set; }

    [JsonPropertyName("opcion_id")]
    public int? OpcionId { get; set; }
}

public class EvidenciaOpcionDto
{
    [JsonPropertyName("id_opcion")]
    public int IdOpcion { get; set; }

    [JsonPropertyName("tipo")]
    public string Tipo { get; set; } = string.Empty;

    [JsonPropertyName("linea")]
    public string Linea { get; set; } = string.Empty;

    [JsonPropertyName("precio")]
    public decimal? Precio { get; set; }

    [JsonPropertyName("moneda")]
    public string? Moneda { get; set; }

    [JsonPropertyName("fuente")]
    public string Fuente { get; set; } = string.Empty;

    [JsonPropertyName("fue_elegida")]
    public bool FueElegida { get; set; }

    [JsonPropertyName("url_compra")]
    public string? UrlCompra { get; set; }

    [JsonPropertyName("ruta_captura")]
    public string? RutaCaptura { get; set; }

    [JsonPropertyName("url_captura")]
    public string? UrlCaptura { get; set; }

    [JsonPropertyName("capturada_en")]
    public DateTime? CapturadaEn { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }

    [JsonPropertyName("datos")]
    public JsonElement? Datos { get; set; }

    [JsonPropertyName("buscado_en")]
    public DateTime? BuscadoEn { get; set; }
}

public class EvidenciasSolicitudDto
{
    [JsonPropertyName("id_solicitud")]
    public int IdSolicitud { get; set; }

    [JsonPropertyName("folio")]
    public string? Folio { get; set; }

    [JsonPropertyName("opciones")]
    public List<EvidenciaOpcionDto> Opciones { get; set; } = new();

    [JsonPropertyName("generadas")]
    public int Generadas { get; set; }

    [JsonPropertyName("reutilizadas")]
    public int Reutilizadas { get; set; }

    [JsonPropertyName("fallidas")]
    public int Fallidas { get; set; }

    [JsonPropertyName("aviso")]
    public string? Aviso { get; set; }
}

public class BusquedaCapturaResult
{
    public CapturaResultDto Captura { get; init; } = new();

    public JsonElement? Datos { get; init; }

    public string? Modelo { get; init; }

    public string? Advertencia { get; init; }

    public DateTime BuscadoEn { get; init; } = DateTime.UtcNow;
}

public class BuscarCapturaRequest
{
    [JsonPropertyName("url")]
    public string? Url { get; set; }

    [JsonPropertyName("nombre")]
    public string? Nombre { get; set; }

    [JsonPropertyName("contexto")]
    public string? Contexto { get; set; }
}

public class CapturaBuscadaDto
{
    [JsonPropertyName("archivo")]
    public string? Archivo { get; set; }

    [JsonPropertyName("url_captura")]
    public string? UrlCaptura { get; set; }

    [JsonPropertyName("datos")]
    public JsonElement? Datos { get; set; }

    [JsonPropertyName("modelo")]
    public string? Modelo { get; set; }

    [JsonPropertyName("buscado_en")]
    public DateTime? BuscadoEn { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }
}

public class BuscarEvidenciasRequest
{
    [JsonPropertyName("opcion_id")]
    public int? OpcionId { get; set; }
}
