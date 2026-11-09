using System.Text.Json;
using System.Text.Json.Serialization;

namespace Lefarma.API.Features.Viaticos.DTOs;

/// <summary>
/// Body opcional de POST /api/viaticos/solicitudes/{id}/autorizar.
/// Sin body se autoriza la ruta que ya tenia la solicitud. Con <c>Calculo</c>
/// se guarda esa version como <c>calculo_autorizado</c> (la ruta nueva que
/// genero el revisor) y, si llegan <c>Opciones</c>, se reemplaza la
/// cotizacion vigente por la de esa ruta.
/// </summary>
public class AutorizarSolicitudRequest
{
    [JsonPropertyName("calculo")]
    public JsonElement? Calculo { get; set; }

    [JsonPropertyName("opciones")]
    public JsonElement? Opciones { get; set; }
}

/// <summary>
/// Body de POST /api/viaticos/solicitudes/{id}/ajustes.
/// Un ajuste queda registrado en <c>solicitud_ajustes</c> y como evento
/// en <c>solicitud_eventos</c>; el <c>valor_anterior</c> se conserva
/// siempre (no se borra ni se sobreescribe).
/// </summary>
public class AjusteSolicitudRequest
{
    [JsonPropertyName("id_opcion")]
    public int IdOpcion { get; set; }

    [JsonPropertyName("campo")]
    public string Campo { get; set; } = string.Empty;

    [JsonPropertyName("valor_anterior")]
    public string ValorAnterior { get; set; } = string.Empty;

    [JsonPropertyName("valor_nuevo")]
    public string ValorNuevo { get; set; } = string.Empty;

    [JsonPropertyName("motivo")]
    public string Motivo { get; set; } = string.Empty;
}

/// <summary>
/// Body de POST /api/viaticos/solicitudes/{id}/rechazar. <c>Motivo</c>
/// es obligatorio y se persiste como evento del workflow.
/// </summary>
public class RechazoSolicitudRequest
{
    [JsonPropertyName("motivo")]
    public string Motivo { get; set; } = string.Empty;
}

/// <summary>
/// Salida del historial de ajustes de una solicitud. Refleja el row de
/// <c>[viaticos].[solicitud_ajustes]</c>.
/// </summary>
public class AjustesHistorialDto
{
    [JsonPropertyName("id_usuario_admin")]
    public int IdUsuarioAdmin { get; set; }

    [JsonPropertyName("campo")]
    public string Campo { get; set; } = string.Empty;

    [JsonPropertyName("valor_anterior")]
    public string ValorAnterior { get; set; } = string.Empty;

    [JsonPropertyName("valor_nuevo")]
    public string ValorNuevo { get; set; } = string.Empty;

    [JsonPropertyName("motivo")]
    public string Motivo { get; set; } = string.Empty;

    [JsonPropertyName("fecha_creacion")]
    public DateTime FechaCreacion { get; set; }
}

/// <summary>
/// Item de la bandeja de solicitudes para el admin / solicitante.
/// <c>Destino</c>, <c>Total</c> y el desglose por concepto
/// (<c>Autobus</c>, <c>Avion</c>, <c>Gasolina</c>, <c>Casetas</c>,
/// <c>VehiculoPropio</c>, <c>Hospedaje</c>, <c>Comida</c>, <c>Taxi</c>) se
/// calculan desde <c>solicitudes.datos_json</c>, el snapshot serializado del
/// wizard: son las claves <c>$.destino</c>, <c>$.total</c>, <c>$.autobus</c>,
/// <c>$.avion</c>, <c>$.gasolina</c>, <c>$.casetas</c>,
/// <c>$.vehiculo_propio</c>, <c>$.hospedaje</c>, <c>$.comida</c> y
/// <c>$.taxi</c>. Tambien se proyectan <c>$.origen</c> (columna "Origen") y
/// el rango <c>$.fecha_salida</c>/<c>$.fecha_regreso</c> (columna "Fecha").
/// Son los nombres que consume el concentrado impreso
/// ASK-ADM-FOR-008 (<c>ConcentradoViaticosPrint.tsx</c>), que pinta "—" para
/// <c>null</c>: por eso el desglose es <c>decimal?</c> y NUNCA un $0.00
/// inventado cuando la clave falta, no es numerica o el JSON no parsea.
/// <c>Total</c> tambien es <c>decimal?</c>: <c>null</c> significa "no se
/// conoce" (snapshot sin <c>$.total</c>, no numerico o JSON invalido) y se
/// imprime como "—"; nunca se coacciona a 0, porque 0 afirmaria que el viaje
/// costo nada.
/// <c>NombreSolicitante</c> viene del directorio activo
/// (<c>usuarios.nombre_completo</c>); si el solicitante no esta en el
/// directorio o esta inactivo cae a <c>"Usuario #{id}"</c>.
/// </summary>
public class SolicitudBandejaDto
{
    [JsonPropertyName("id_solicitud")]
    public int IdSolicitud { get; set; }

    /// <summary>Folio legible del viaje (<c>VIA-{SamAccountName}-{id}</c>). Es
    /// la identidad que usa la persona para referirse a su solicitud; el
    /// concentrado lo imprime en la columna "No." y la tabla lo muestra en
    /// lugar del id interno. <c>null</c> en solicitudes viejas sin folio.</summary>
    [JsonPropertyName("folio")]
    public string? Folio { get; set; }

    [JsonPropertyName("id_usuario_solicitante")]
    public int IdUsuarioSolicitante { get; set; }

    [JsonPropertyName("nombre_solicitante")]
    public string NombreSolicitante { get; set; } = string.Empty;

    [JsonPropertyName("periodo")]
    public string Periodo { get; set; } = string.Empty;

    [JsonPropertyName("gerencia")]
    public string Gerencia { get; set; } = string.Empty;

    [JsonPropertyName("estado")]
    public string Estado { get; set; } = string.Empty;

    [JsonPropertyName("destino")]
    public string? Destino { get; set; }

    /// <summary>Origen de la ruta (<c>$.origen</c>); el concentrado lo imprime
    /// en la columna "Origen". <c>null</c> imprime "—".</summary>
    [JsonPropertyName("origen")]
    public string? Origen { get; set; }

    /// <summary>Rango de fechas del viaje para la columna "Fecha" del
    /// concentrado, compuesto desde <c>$.fecha_salida</c> y
    /// <c>$.fecha_regreso</c> del snapshot en el mismo formato que documenta el
    /// componente de impresion (<c>"05/10/2026 AL 09/10/2026"</c>).
    /// <c>null</c> imprime "—".</summary>
    [JsonPropertyName("fecha")]
    public string? Fecha { get; set; }

    /// <summary>Fecha de salida del snapshot tal como esta guardada (ISO
    /// <c>aaaa-mm-dd</c>). Existe para que el filtro "fecha de viaje" del
    /// concentrado compare fechas reales y no parsee el texto ya formateado de
    /// <see cref="Fecha"/>. <c>null</c> cuando el snapshot no la trae.</summary>
    [JsonPropertyName("fecha_salida")]
    public string? FechaSalida { get; set; }

    /// <summary>Fecha de regreso del snapshot tal como esta guardada (ISO
    /// <c>aaaa-mm-dd</c>). <c>null</c> cuando el snapshot no la trae.</summary>
    [JsonPropertyName("fecha_regreso")]
    public string? FechaRegreso { get; set; }

    [JsonPropertyName("autobus")]
    public decimal? Autobus { get; set; }

    [JsonPropertyName("avion")]
    public decimal? Avion { get; set; }

    [JsonPropertyName("gasolina")]
    public decimal? Gasolina { get; set; }

    [JsonPropertyName("casetas")]
    public decimal? Casetas { get; set; }

    /// <summary>Cotizacion del automovil propio; el concentrado la imprime en
    /// la columna "Automovil propio", separada de transporte.</summary>
    [JsonPropertyName("vehiculo_propio")]
    public decimal? VehiculoPropio { get; set; }

    [JsonPropertyName("hospedaje")]
    public decimal? Hospedaje { get; set; }

    [JsonPropertyName("comida")]
    public decimal? Comida { get; set; }

    [JsonPropertyName("taxi")]
    public decimal? Taxi { get; set; }

    [JsonPropertyName("total")]
    public decimal? Total { get; set; }

    [JsonPropertyName("fecha_creacion")]
    public DateTime FechaCreacion { get; set; }

    /// <summary>Ultima modificacion de la solicitud. Es la fecha que manda con
    /// el filtro "última actualización": una solicitud creada ayer y enviada
    /// hoy tiene que aparecer hoy en el concentrado.</summary>
    [JsonPropertyName("fecha_modificacion")]
    public DateTime FechaModificacion { get; set; }

    /// <summary>
    /// La solicitud pasó por los cálculos: tiene cotización guardada
    /// (<c>datos.calculo</c>) u opciones de vuelo/hotel. Es lo que el
    /// concentrado necesita para autorizar; sin esto no hay nada que revisar.
    /// </summary>
    [JsonPropertyName("recalculada")]
    public bool Recalculada { get; set; }

    /// <summary>
    /// Medio de transporte del viaje, ya resuelto por el servidor:
    /// <c>aereo</c> | <c>autobus</c> | <c>propio</c> | <c>solicitado</c> |
    /// <c>sin-clasificar</c>. El wizard no escribe <c>$.avion</c> ni
    /// <c>$.autobus</c> en el snapshot: el medio real vive en la opción
    /// FUE_ELEGIDA (<c>vuelo</c>, <c>autobus</c>, <c>auto</c>, <c>renta</c>) y
    /// el modo en <c>datos.transporte.modo</c>. <c>solicitado</c> significa
    /// "la empresa gestiona el viaje y aún no se elige medio"; no es
    /// "sin clasificar", que se reserva para cuando no hay ningún dato.
    /// </summary>
    [JsonPropertyName("tipo_transporte")]
    public string TipoTransporte { get; set; } = "sin-clasificar";

    /// <summary>
    /// Nombre de la persona que viaja (<c>datos.persona.nombre</c>), que puede
    /// diferir del solicitante. <c>null</c> cae al nombre del directorio.
    /// </summary>
    [JsonPropertyName("persona_nombre")]
    public string? PersonaNombre { get; set; }

    /// <summary>Motivo del viaje (<c>datos.persona.motivo</c>); null imprime "—".</summary>
    [JsonPropertyName("motivo")]
    public string? Motivo { get; set; }

    /// <summary>
    /// Puesto del viajero según <c>Asistencias.vwEmpleados</c> (la misma fuente
    /// que usan las órdenes de compra; <c>app.Usuarios.Puesto</c> está en
    /// "Sin asignar" en producción). Solo se resuelve cuando la persona que
    /// viaja es el solicitante; en otro caso queda null y el documento imprime
    /// "—". No es un dato de la solicitud: es del directorio de personal.
    /// </summary>
    [JsonPropertyName("puesto")]
    public string? Puesto { get; set; }

    /// <summary>
    /// Fecha de nacimiento del viajero (ISO <c>aaaa-mm-dd</c>) desde
    /// <c>vwEmpleados</c>; el formato de solicitud de avión la pide la agencia
    /// para emitir el boleto. Null imprime "—".
    /// </summary>
    [JsonPropertyName("fecha_nacimiento")]
    public string? FechaNacimiento { get; set; }

    /// <summary>
    /// Itinerario imprimible del formato "Solicitud de avión": ida y vuelta
    /// (máximo dos). Sale de <c>datos.calculo_autorizado</c> y, si no existe,
    /// de <c>datos.calculo</c>; sin cálculo se compone del rango y los destinos
    /// del snapshot. Lista vacía cuando no hay ningún dato legible.
    /// </summary>
    [JsonPropertyName("trayectos")]
    public List<TrayectoBandejaDto> Trayectos { get; set; } = new();
}

/// <summary>
/// Un tramo imprimible del formato "Solicitud de avión" (ida o vuelta). Todos
/// los campos son opcionales: el documento imprime "—" cuando faltan, nunca un
/// dato inventado.
/// </summary>
public class TrayectoBandejaDto
{
    /// <summary>Fecha de salida ISO (<c>aaaa-mm-dd</c>).</summary>
    [JsonPropertyName("fecha")]
    public string? Fecha { get; set; }

    /// <summary>Hora planeada de salida (<c>HH:mm</c>).</summary>
    [JsonPropertyName("hora")]
    public string? Hora { get; set; }

    /// <summary>Ciudad/punto de origen.</summary>
    [JsonPropertyName("origen")]
    public string? Origen { get; set; }

    /// <summary>Ciudad/punto de destino.</summary>
    [JsonPropertyName("destino")]
    public string? Destino { get; set; }
}
