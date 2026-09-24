using System.Text.Json;

namespace Lefarma.API.Domain.Firmas;

/// <summary>
/// Historial de eventos de la firma digital de un usuario, persistido como JSON
/// (arreglo) en config.usuario_detalle.firma_control.
/// Es la unica fuente de verdad: el estado se DERIVA de los eventos.
///   - Subidas:            numero de eventos "subida".
///   - CambioHabilitado:   el ultimo evento entre subida/eliminacion/habilitacion
///                         es "habilitacion" (una subida o eliminacion posterior
///                         la consume, por ser de un solo uso).
///   - SolicitudPendiente: el ultimo evento entre solicitud/habilitacion es
///                         "solicitud" (la habilitacion la atiende).
/// </summary>
public class FirmaControl
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public List<FirmaEvento> Eventos { get; set; } = [];

    public int Subidas => Eventos.Count(e => e.Accion == FirmaAccion.Subida);

    public bool CambioHabilitado => Eventos
        .Where(e => e.Accion is FirmaAccion.Subida or FirmaAccion.Eliminacion or FirmaAccion.Habilitacion)
        .LastOrDefault()?.Accion == FirmaAccion.Habilitacion;

    public bool SolicitudPendiente => Eventos
        .Where(e => e.Accion is FirmaAccion.Solicitud or FirmaAccion.Habilitacion)
        .LastOrDefault()?.Accion == FirmaAccion.Solicitud;

    public FirmaEvento? UltimaHabilitacion => Eventos.LastOrDefault(e => e.Accion == FirmaAccion.Habilitacion);

    public FirmaEvento? UltimaSolicitud => Eventos.LastOrDefault(e => e.Accion == FirmaAccion.Solicitud);

    /// <summary>Parse defensivo: JSON nulo/vacío/corrupto se trata como historial vacío.</summary>
    public static FirmaControl Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new FirmaControl();

        try
        {
            var eventos = JsonSerializer.Deserialize<List<FirmaEvento>>(json, JsonOptions);
            return new FirmaControl { Eventos = eventos ?? [] };
        }
        catch (JsonException)
        {
            return new FirmaControl();
        }
    }

    public string Serialize() => JsonSerializer.Serialize(Eventos, JsonOptions);

    public void AgregarSubida(int idUsuario, DateTime fecha) => Agregar(FirmaAccion.Subida, idUsuario, fecha);

    public void AgregarEliminacion(int idUsuario, DateTime fecha) => Agregar(FirmaAccion.Eliminacion, idUsuario, fecha);

    public void AgregarSolicitud(int idUsuario, DateTime fecha) => Agregar(FirmaAccion.Solicitud, idUsuario, fecha);

    /// <param name="idUsuarioRh">Usuario de RH que habilita el cambio.</param>
    public void AgregarHabilitacion(int idUsuarioRh, DateTime fecha) => Agregar(FirmaAccion.Habilitacion, idUsuarioRh, fecha);

    private void Agregar(string accion, int idUsuario, DateTime fecha)
    {
        Eventos.Add(new FirmaEvento { Accion = accion, Fecha = fecha, IdUsuario = idUsuario });
    }
}
