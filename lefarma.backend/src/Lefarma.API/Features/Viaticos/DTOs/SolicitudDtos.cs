using System.Text.Json;
using System.Text.Json.Serialization;

namespace Lefarma.API.Features.Viaticos.DTOs;

/// <summary>
/// Body de POST /api/viaticos/solicitudes.
/// <c>Gerencia</c> es opcional: si llega vacía, el server usa el valor
/// por defecto documentado (ver SolicitudesController.GerenciaPorDefecto).
/// <c>id_usuario_solicitante</c> NUNCA se lee del body — siempre se toma
/// del claim NameIdentifier vía <c>User.GetUserId()</c>.
/// <c>Datos</c> es el snapshot del wizard (pasos 1..N) y se persiste
/// tal cual en <c>solicitudes.datos_json</c>.
/// </summary>
public class CrearSolicitudRequest
{
    [JsonPropertyName("gerencia")]
    public string? Gerencia { get; set; }

    /// <summary>
    /// Sistema que originó la solicitud: <c>viaticos</c> (valor por defecto)
    /// o <c>educacion_medica</c>. Se valida contra una lista permitida.
    /// </summary>
    [JsonPropertyName("sistema_origen")]
    public string? SistemaOrigen { get; set; }

    [JsonPropertyName("datos")]
    public JsonElement Datos { get; set; }
}

/// <summary>
/// Body de PUT /api/viaticos/solicitudes/{id}/opciones.
/// <c>Cotizacion</c> es un JSON con forma <c>{ "opciones": [...] }</c> en
/// el que cada elemento requiere <c>fuente</c>; <c>url_compra</c> es
/// opcional (ausente, null o vacia se guarda como null).
/// <c>precio</c> puede ser <c>null</c> únicamente cuando <c>fuente</c>
/// indica que es un estimado.
/// </summary>
public class CotizacionRequest
{
    [JsonPropertyName("cotizacion")]
    public JsonElement Cotizacion { get; set; }

    /// <summary>
    /// Cálculo de la ruta hecho al enviar (kilómetros, tiempos y casetas por
    /// tramo). Se guarda dentro del snapshot, en <c>datos.calculo</c>.
    /// </summary>
    [JsonPropertyName("calculo")]
    public JsonElement? Calculo { get; set; }
}

/// <summary>
/// Body de PUT /api/viaticos/solicitudes/{id}/opciones/{idOpcion}/precio.
/// Registra el precio REAL de una opcion estimada, con su captura y enlace.
/// <c>precio</c> debe ser mayor que cero y <c>fuente</c> no puede declarar
/// "estimado": esa capa vive en <c>datos.precio_estimado</c>.
/// </summary>
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

/// <summary>
/// Resultado de POST /solicitudes/{id}/opciones/{idOpcion}/detectar-precio.
/// <c>aplicado</c> indica si la cotización se actualizó; si es false, la UI
/// muestra <c>motivo</c> y puede abrir el respaldo manual.
/// </summary>
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

/// <summary>
/// Vista previa del precio de una opción que aún no está guardada. La usa el
/// wizard al seleccionar una tarjeta; no escribe en la base de datos y devuelve
/// la captura para que el frontend la adjunte a la opción.
/// </summary>
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

    /// <summary>
    /// Si es false, el wizard solo confirma precios y deja la captura para el
    /// guardado. Evita generar PNG por cada selección.
    /// </summary>
    [JsonPropertyName("capturar")]
    public bool Capturar { get; set; } = true;

    /// <summary>Nombre descriptivo opcional para el PNG (folio/ruta/línea).</summary>
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

/// <summary>Precio detectado genérico: vuelo, autobús o hotel.</summary>
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

/// <summary>
/// Body de POST /api/viaticos/solicitudes/{id}/enviar. Solo lleva el cálculo
/// de la ruta; el estado borrador -> enviada lo pone el endpoint.
/// </summary>
public class EnviarSolicitudRequest
{
    [JsonPropertyName("calculo")]
    public JsonElement? Calculo { get; set; }
}

/// <summary>
/// Body de POST /api/viaticos/solicitudes/desde-educacion-medica (ADR-00014).
/// `id_ruta_visitas` son las visitas seleccionadas; el servidor las usa para
/// bloquear visitas ya cotizadas y para deduplicar por conjunto exacto.
/// </summary>
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

/// <summary>Respuesta de crear/reutilizar una cotización desde Educación Médica.</summary>
public class SolicitudDesdeEducacionMedicaDto
{
    [JsonPropertyName("id_solicitud")]
    public int IdSolicitud { get; set; }

    [JsonPropertyName("folio")]
    public string? Folio { get; set; }

    [JsonPropertyName("reutilizado")]
    public bool Reutilizado { get; set; }
}

/// <summary>
/// Resumen de una cotización ligada a una ruta de Educación Médica.
/// `total` es null mientras la cotización no tenga precios persistidos.
/// </summary>
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

    /// <summary>Solo precios reales: es lo que se puede autorizar.</summary>
    [JsonPropertyName("total_cotizado")]
    public decimal? TotalCotizado { get; set; }

    /// <summary>Referencias estimadas/tabulador; se muestran aparte.</summary>
    [JsonPropertyName("total_estimado")]
    public decimal? TotalEstimado { get; set; }

    [JsonPropertyName("fecha_creacion")]
    public DateTime FechaCreacion { get; set; }

    [JsonPropertyName("id_ruta_visitas")]
    public List<int> IdRutaVisitas { get; set; } = new();
}

/// <summary>
/// Salida de las acciones del controller. <c>Opciones</c> y
/// <c>Eventos</c> se hidratan en el GET por id y en el POST de creación
/// (queda vacío hasta que el usuario persista la cotización).
/// </summary>
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

    /// <summary>Suma de precios reales de las opciones elegidas; null si no hay.</summary>
    [JsonPropertyName("total_cotizado")]
    public decimal? TotalCotizado { get; set; }

    /// <summary>Suma de referencias estimadas/tabulador; null si no hay.</summary>
    [JsonPropertyName("total_estimado")]
    public decimal? TotalEstimado { get; set; }

    /// <summary>Total completo (cotizado + referencia) para el presupuesto.</summary>
    [JsonPropertyName("total")]
    public decimal? Total { get; set; }

    [JsonPropertyName("opciones")]
    public List<SolicitudOpcionDto> Opciones { get; set; } = new();

    [JsonPropertyName("eventos")]
    public List<SolicitudEventoDto> Eventos { get; set; } = new();
}

/// <summary>
/// Una opción de vuelo/hotel persistida. Refleja el row de
/// [viaticos].[solicitud_opciones].
/// </summary>
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

    /// <summary>
    /// Metadatos de la opcion guardados en <c>solicitud_opciones.datos_json</c>
    /// (<c>tramo</c>, <c>de</c>, <c>a</c>, ...). El concentrado los usa para
    /// comparar la cotizacion original contra una ruta recalculada sin depender
    /// del orden del arreglo. <c>null</c> cuando la fila no tiene datos o no son
    /// un JSON valido.
    /// </summary>
    [JsonPropertyName("datos")]
    public JsonElement? Datos { get; set; }
}

/// <summary>
/// Un evento del workflow. Refleja el row de
/// [viaticos].[solicitud_eventos].
/// <c>Payload</c> es el <c>payload_json</c> ya parseado (detalle del
/// ajuste: <c>campo</c>, <c>valor_anterior</c>, <c>valor_nuevo</c>,
/// <c>motivo</c>). Es <c>null</c> cuando la columna viene vacia o su
/// contenido no es JSON valido: nunca rompe el detalle.
/// </summary>
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

/// <summary>
/// Gerencia que el wizard propone al capturar: la ultima que registro el
/// usuario en una solicitud propia. <c>null</c> cuando aun no tiene ninguna
/// clasificada (el combo arranca vacio y la persona la elige).
/// </summary>
public class GerenciaSugeridaDto
{
    [JsonPropertyName("gerencia")]
    public string? Gerencia { get; set; }
}

