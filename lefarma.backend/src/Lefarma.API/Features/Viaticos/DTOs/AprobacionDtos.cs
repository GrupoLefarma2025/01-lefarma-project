using System.Text.Json.Serialization;

namespace Lefarma.API.Features.Viaticos.DTOs;

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
}
