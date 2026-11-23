using System.Text.Json;
using System.Text.Json.Serialization;

namespace Lefarma.API.Features.Viaticos.DTOs;

public class CrearSolicitudRequest
{
    [JsonPropertyName("gerencia")]
    public string? Gerencia { get; set; }

    [JsonPropertyName("sistema_origen")]
    public string? SistemaOrigen { get; set; }

    [JsonPropertyName("datos")]
    public JsonElement Datos { get; set; }
}

public class CotizacionRequest
{
    [JsonPropertyName("cotizacion")]
    public JsonElement Cotizacion { get; set; }

    [JsonPropertyName("calculo")]
    public JsonElement? Calculo { get; set; }
}

public class PrecioRealRequest
{
    [JsonPropertyName("linea")]
    public string? Linea { get; set; }

    [JsonPropertyName("precio")]
    public decimal Precio { get; set; }

    [JsonPropertyName("moneda")]
    public string? Moneda { get; set; }

    [JsonPropertyName("fuente")]
    public string Fuente { get; set; } = string.Empty;

    [JsonPropertyName("url_compra")]
    public string? UrlCompra { get; set; }

    [JsonPropertyName("ruta_captura")]
    public string? RutaCaptura { get; set; }

    [JsonPropertyName("salida")]
    public string? Salida { get; set; }

    [JsonPropertyName("llegada")]
    public string? Llegada { get; set; }
}

public class DeteccionPrecioResponse
{
    [JsonPropertyName("aplicado")]
    public bool Aplicado { get; set; }

    [JsonPropertyName("mensaje")]
    public string? Mensaje { get; set; }

    [JsonPropertyName("motivo")]
    public string? Motivo { get; set; }

    [JsonPropertyName("fuente")]
    public string? Fuente { get; set; }

    [JsonPropertyName("ruta_captura")]
    public string? RutaCaptura { get; set; }

    [JsonPropertyName("elegido")]
    public PrecioDetectadoDto? Elegido { get; set; }

    [JsonPropertyName("opciones")]
    public List<PrecioDetectadoDto> Opciones { get; set; } = new();
}

public class DeteccionPrecioPreviewRequest
{
    [JsonPropertyName("tipo")]
    public string Tipo { get; set; } = string.Empty;

    [JsonPropertyName("linea")]
    public string Linea { get; set; } = string.Empty;

    [JsonPropertyName("url_compra")]
    public string? UrlCompra { get; set; }

    [JsonPropertyName("salida")]
    public string? Salida { get; set; }

    [JsonPropertyName("llegada")]
    public string? Llegada { get; set; }

    [JsonPropertyName("datos")]
    public JsonElement? Datos { get; set; }

    [JsonPropertyName("solicitud_datos")]
    public JsonElement? SolicitudDatos { get; set; }

    [JsonPropertyName("capturar")]
    public bool Capturar { get; set; } = true;

    [JsonPropertyName("nombre")]
    public string? Nombre { get; set; }
}

public class DeteccionPrecioPreviewResponse
{
    [JsonPropertyName("detectado")]
    public bool Detectado { get; set; }

    [JsonPropertyName("motivo")]
    public string? Motivo { get; set; }

    [JsonPropertyName("fuente")]
    public string? Fuente { get; set; }

    [JsonPropertyName("ruta_captura")]
    public string? RutaCaptura { get; set; }

    [JsonPropertyName("elegido")]
    public PrecioDetectadoDto? Elegido { get; set; }

    [JsonPropertyName("opciones")]
    public List<PrecioDetectadoDto> Opciones { get; set; } = new();
}

public class PrecioDetectadoDto
{
    [JsonPropertyName("tipo")]
    public string Tipo { get; set; } = string.Empty;

    [JsonPropertyName("linea")]
    public string Linea { get; set; } = string.Empty;

    [JsonPropertyName("precio")]
    public decimal Precio { get; set; }

    [JsonPropertyName("moneda")]
    public string Moneda { get; set; } = "MXN";

    [JsonPropertyName("fuente")]
    public string? Fuente { get; set; }

    [JsonPropertyName("url_compra")]
    public string? UrlCompra { get; set; }

    [JsonPropertyName("detalle")]
    public string? Detalle { get; set; }

    [JsonPropertyName("salida")]
    public string? Salida { get; set; }

    [JsonPropertyName("llegada")]
    public string? Llegada { get; set; }

    [JsonPropertyName("dias_llegada")]
    public int DiasLlegada { get; set; }

    [JsonPropertyName("duracion_min")]
    public int? DuracionMin { get; set; }

    [JsonPropertyName("asientos")]
    public int? Asientos { get; set; }

    [JsonPropertyName("noches")]
    public int? Noches { get; set; }

    [JsonPropertyName("patrocinado")]
    public bool Patrocinado { get; set; }
}

public class EnviarSolicitudRequest
{
    [JsonPropertyName("calculo")]
    public JsonElement? Calculo { get; set; }
}

public class CrearSolicitudDesdeEducacionMedicaRequest
{
    [JsonPropertyName("id_ruta")]
    public int IdRuta { get; set; }

    [JsonPropertyName("id_seleccion_mensual")]
    public int? IdSeleccionMensual { get; set; }

    [JsonPropertyName("id_ruta_visitas")]
    public List<int> IdRutaVisitas { get; set; } = new();

    [JsonPropertyName("gerencia")]
    public string? Gerencia { get; set; }

    [JsonPropertyName("datos")]
    public JsonElement Datos { get; set; }
}

public class SolicitudDesdeEducacionMedicaDto
{
    [JsonPropertyName("id_solicitud")]
    public int IdSolicitud { get; set; }

    [JsonPropertyName("folio")]
    public string? Folio { get; set; }

    [JsonPropertyName("reutilizado")]
    public bool Reutilizado { get; set; }
}

public class SolicitudOrigenEmResumenDto
{
    [JsonPropertyName("id_solicitud")]
    public int IdSolicitud { get; set; }

    [JsonPropertyName("folio")]
    public string? Folio { get; set; }

    [JsonPropertyName("estado")]
    public string Estado { get; set; } = string.Empty;

    [JsonPropertyName("num_puntos")]
    public int NumPuntos { get; set; }

    [JsonPropertyName("total")]
    public decimal? Total { get; set; }

    [JsonPropertyName("total_cotizado")]
    public decimal? TotalCotizado { get; set; }

    [JsonPropertyName("total_estimado")]
    public decimal? TotalEstimado { get; set; }

    [JsonPropertyName("fecha_creacion")]
    public DateTime FechaCreacion { get; set; }

    [JsonPropertyName("id_ruta_visitas")]
    public List<int> IdRutaVisitas { get; set; } = new();
}

public class SolicitudDto
{
    [JsonPropertyName("id_solicitud")]
    public int IdSolicitud { get; set; }

    [JsonPropertyName("id_usuario_solicitante")]
    public int IdUsuarioSolicitante { get; set; }

    [JsonPropertyName("periodo")]
    public string Periodo { get; set; } = string.Empty;

    [JsonPropertyName("gerencia")]
    public string Gerencia { get; set; } = string.Empty;

    [JsonPropertyName("estado")]
    public string Estado { get; set; } = string.Empty;

    [JsonPropertyName("folio")]
    public string? Folio { get; set; }

    [JsonPropertyName("persona_solicitante")]
    public string? PersonaSolicitante { get; set; }

    [JsonPropertyName("persona_viajera")]
    public string? PersonaViajera { get; set; }

    [JsonPropertyName("sistema_origen")]
    public string SistemaOrigen { get; set; } = "viaticos";

    [JsonPropertyName("id_usuario_creacion")]
    public int IdUsuarioCreacion { get; set; }

    [JsonPropertyName("num_puntos")]
    public int NumPuntos { get; set; }

    [JsonPropertyName("nombre_creador")]
    public string? NombreCreador { get; set; }

    [JsonPropertyName("activo")]
    public bool Activo { get; set; }

    [JsonPropertyName("fecha_creacion")]
    public DateTime FechaCreacion { get; set; }

    [JsonPropertyName("fecha_modificacion")]
    public DateTime FechaModificacion { get; set; }

    [JsonPropertyName("datos")]
    public JsonElement? Datos { get; set; }

    [JsonPropertyName("total_cotizado")]
    public decimal? TotalCotizado { get; set; }

    [JsonPropertyName("total_estimado")]
    public decimal? TotalEstimado { get; set; }

    [JsonPropertyName("total")]
    public decimal? Total { get; set; }

    [JsonPropertyName("opciones")]
    public List<SolicitudOpcionDto> Opciones { get; set; } = new();

    [JsonPropertyName("eventos")]
    public List<SolicitudEventoDto> Eventos { get; set; } = new();
}

public class SolicitudOpcionDto
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

    [JsonPropertyName("url_compra")]
    public string? UrlCompra { get; set; }

    [JsonPropertyName("fuente")]
    public string Fuente { get; set; } = string.Empty;

    [JsonPropertyName("fue_elegida")]
    public bool FueElegida { get; set; }

    [JsonPropertyName("ruta_captura")]
    public string? RutaCaptura { get; set; }

    [JsonPropertyName("datos")]
    public JsonElement? Datos { get; set; }
}

public class SolicitudEventoDto
{
    [JsonPropertyName("id_evento")]
    public int IdEvento { get; set; }

    [JsonPropertyName("tipo")]
    public string Tipo { get; set; } = string.Empty;

    [JsonPropertyName("id_usuario")]
    public int IdUsuario { get; set; }

    [JsonPropertyName("fecha_creacion")]
    public DateTime FechaCreacion { get; set; }

    [JsonPropertyName("payload")]
    public JsonElement? Payload { get; set; }
}

public class GerenciaSugeridaDto
{
    [JsonPropertyName("gerencia")]
    public string? Gerencia { get; set; }
}

