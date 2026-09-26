namespace Lefarma.API.Domain.Firmas;

/// <summary>
/// Evento del historial de control de firma digital (persistido en
/// config.usuario_detalle.firma_control como JSON).
/// </summary>
public class FirmaEvento
{
    /// <summary>Ver <see cref="FirmaAccion"/>.</summary>
    public string Accion { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    /// <summary>Quién realizó la acción (el propio usuario, o RH en habilitacion).</summary>
    public int IdUsuario { get; set; }
}

/// <summary>Acciones del historial de firma.</summary>
public static class FirmaAccion
{
    public const string Subida = "subida";
    public const string Eliminacion = "eliminacion";
    public const string Solicitud = "solicitud";
    public const string Habilitacion = "habilitacion";
}
