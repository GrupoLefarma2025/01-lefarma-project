using System.Text.Json.Serialization;

namespace Lefarma.API.Domain.Firmas;

public class FirmaEvento
{
    public string Accion { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public int IdUsuario { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? FirmaPendiente { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Ine { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? FirmaArchivo { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? IneArchivo { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Motivo { get; set; }
}

public static class FirmaAccion
{
    public const string Subida = "subida";
    public const string Eliminacion = "eliminacion";
    public const string Solicitud = "solicitud";
    public const string Habilitacion = "habilitacion";
    public const string Remision = "remision";
    public const string Aprobacion = "aprobacion";
    public const string Rechazo = "rechazo";
}
