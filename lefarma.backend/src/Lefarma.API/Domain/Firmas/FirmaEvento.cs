using System.Text.Json.Serialization;

namespace Lefarma.API.Domain.Firmas;

/// <summary>
/// Evento del historial de control de firma digital (persistido en
/// config.usuario_detalle.firma_control como JSON).
/// Los campos opcionales solo se serializan cuando tienen valor.
/// </summary>
public class FirmaEvento
{
    /// <summary>Ver <see cref="FirmaAccion"/>.</summary>
    public string Accion { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    /// <summary>Quién realizó la acción (el propio usuario, o RH en habilitacion/aprobacion/rechazo).</summary>
    public int IdUsuario { get; set; }

    /// <summary>Solo en remision: ruta relativa de la firma pendiente de aprobación.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? FirmaPendiente { get; set; }

    /// <summary>Solo en remision: nombre físico del archivo INE (carpeta privada).</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Ine { get; set; }

    /// <summary>Solo en rechazo: motivo indicado por RH.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Motivo { get; set; }
}

/// <summary>Acciones del historial de firma.</summary>
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
