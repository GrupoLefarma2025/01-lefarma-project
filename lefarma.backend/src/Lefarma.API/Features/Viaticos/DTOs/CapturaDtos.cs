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

/// <summary>
/// Cuerpo multipart de POST /api/viaticos/capturas/adjuntar: una captura PNG
/// tomada fuera del backend. Va como DTO (no como parametros sueltos) porque
/// Swashbuckle no genera el schema de un <c>[FromForm] IFormFile</c> suelto.
/// </summary>
public class AdjuntarCapturaRequest
{
    public IFormFile? Archivo { get; set; }

    public string? Nombre { get; set; }
}

/// <summary>
/// Body opcional de POST /api/viaticos/solicitudes/{id}/capturas.
/// <c>forzar=false</c> respeta las capturas ya guardadas; <c>true</c> vuelve a
/// tomar todas (util cuando el precio viejo ya no coincide con la pagina).
/// </summary>
public class CapturarEvidenciasRequest
{
    [JsonPropertyName("forzar")]
    public bool Forzar { get; set; }
}

/// <summary>
/// Evidencia de una opcion del viaje: link de compra + captura de pantalla.
/// <c>ruta_captura</c> es la ruta persistida en la BD
/// (<c>capturas-viaticos/x.png</c>); <c>url_captura</c> es esa misma captura
/// resuelta contra el endpoint autenticado de este backend.
/// </summary>
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

    /// <summary>Motivo por el que esa opcion no tiene captura (si aplica).</summary>
    [JsonPropertyName("error")]
    public string? Error { get; set; }

    /// <summary>
    /// Informacion del viaje extraida por el agente (transportista, horarios,
    /// duracion, precio, asientos, notas). <c>null</c> si aun no se ha buscado.
    /// </summary>
    [JsonPropertyName("datos")]
    public JsonElement? Datos { get; set; }

    /// <summary>Cuando se hizo la ultima busqueda agentica de esta opcion.</summary>
    [JsonPropertyName("buscado_en")]
    public DateTime? BuscadoEn { get; set; }
}

/// <summary>
/// Respuesta de GET/POST /api/viaticos/solicitudes/{id}/capturas: las opciones
/// del viaje con su link de compra y su captura.
/// </summary>
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

    /// <summary>Aviso cuando hubo mas opciones de las que se pueden capturar de golpe.</summary>
    [JsonPropertyName("aviso")]
    public string? Aviso { get; set; }
}

/// <summary>
/// Resultado de una busqueda agentica: la captura de pantalla y los datos del
/// viaje (transportista, horarios, precio...) que devolvio el agente en la
/// misma corrida. <see cref="Datos"/> queda en null si solo se pudo capturar.
/// </summary>
public class BusquedaCapturaResult
{
    public CapturaResultDto Captura { get; init; } = new();

    public JsonElement? Datos { get; init; }

    public string? Modelo { get; init; }

    public string? Advertencia { get; init; }

    public DateTime BuscadoEn { get; init; } = DateTime.UtcNow;
}

/// <summary>
/// Cuerpo de POST /api/viaticos/capturas/buscar: pide al agente buscar la
/// oferta en la URL del proveedor (llenando el buscador con el contexto de la
/// ruta) y devolver la captura de los RESULTADOS y el costo.
/// </summary>
public class BuscarCapturaRequest
{
    [JsonPropertyName("url")]
    public string? Url { get; set; }

    [JsonPropertyName("nombre")]
    public string? Nombre { get; set; }

    /// <summary>Texto con origen, destino y fecha para que el agente llene el buscador.</summary>
    [JsonPropertyName("contexto")]
    public string? Contexto { get; set; }
}

/// <summary>
/// Respuesta de POST /api/viaticos/capturas/buscar: la captura publicada y la
/// informacion del viaje extraida por el agente.
/// </summary>
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

/// <summary>
/// Body opcional de POST /api/viaticos/solicitudes/{id}/buscar: si viene
/// <c>opcion_id</c> solo se busca esa opcion (la UI las pide una por una).
/// </summary>
public class BuscarEvidenciasRequest
{
    [JsonPropertyName("opcion_id")]
    public int? OpcionId { get; set; }
}
