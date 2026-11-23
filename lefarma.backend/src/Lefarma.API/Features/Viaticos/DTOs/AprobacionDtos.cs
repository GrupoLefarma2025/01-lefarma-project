using System.Text.Json;
using System.Text.Json.Serialization;

namespace Lefarma.API.Features.Viaticos.DTOs;

public class AutorizarSolicitudRequest
{
    [JsonPropertyName("calculo")]
    public JsonElement? Calculo { get; set; }

    [JsonPropertyName("opciones")]
    public JsonElement? Opciones { get; set; }
}

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

public class RechazoSolicitudRequest
{
    [JsonPropertyName("motivo")]
    public string Motivo { get; set; } = string.Empty;
}

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

public class SolicitudBandejaDto
{
    [JsonPropertyName("id_solicitud")]
    public int IdSolicitud { get; set; }

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

    [JsonPropertyName("origen")]
    public string? Origen { get; set; }

    [JsonPropertyName("fecha")]
    public string? Fecha { get; set; }

    [JsonPropertyName("fecha_salida")]
    public string? FechaSalida { get; set; }

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

    [JsonPropertyName("total_cotizado")]
    public decimal? TotalCotizado { get; set; }

    [JsonPropertyName("total_estimado")]
    public decimal? TotalEstimado { get; set; }

    [JsonPropertyName("precios_pendientes")]
    public int PreciosPendientes { get; set; }

    [JsonPropertyName("fecha_creacion")]
    public DateTime FechaCreacion { get; set; }

    [JsonPropertyName("fecha_modificacion")]
    public DateTime FechaModificacion { get; set; }

    [JsonPropertyName("recalculada")]
    public bool Recalculada { get; set; }

    [JsonPropertyName("tipo_transporte")]
    public string TipoTransporte { get; set; } = "sin-clasificar";

    [JsonPropertyName("persona_nombre")]
    public string? PersonaNombre { get; set; }

    [JsonPropertyName("motivo")]
    public string? Motivo { get; set; }

    [JsonPropertyName("puesto")]
    public string? Puesto { get; set; }

    [JsonPropertyName("fecha_nacimiento")]
    public string? FechaNacimiento { get; set; }

    [JsonPropertyName("trayectos")]
    public List<TrayectoBandejaDto> Trayectos { get; set; } = new();
}

public class TrayectoBandejaDto
{
    [JsonPropertyName("fecha")]
    public string? Fecha { get; set; }

    [JsonPropertyName("hora")]
    public string? Hora { get; set; }

    [JsonPropertyName("origen")]
    public string? Origen { get; set; }

    [JsonPropertyName("destino")]
    public string? Destino { get; set; }
}
