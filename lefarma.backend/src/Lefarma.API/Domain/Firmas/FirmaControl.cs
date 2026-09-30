using System.Text.Json;

namespace Lefarma.API.Domain.Firmas;

/// <summary>
/// Historial de eventos de la firma digital de un usuario, persistido como JSON
/// (arreglo) en config.usuario_detalle.firma_control.
/// Es la unica fuente de verdad: el estado se DERIVA de los eventos.
///   - Subidas:            numero de eventos "subida".
///   - CambioHabilitado:   el ultimo evento entre subida/eliminacion/habilitacion/remision
///                         es "habilitacion" (una subida, eliminacion o remision posterior
///                         la consume, por ser de un solo uso).
///   - SolicitudPendiente: el ultimo evento entre solicitud/habilitacion es
///                         "solicitud" (la habilitacion la atiende).
///   - EnComprobacion:     el ultimo evento entre remision/aprobacion/rechazo es
///                         "remision" (RH aun no resuelve la firma enviada).
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
        .Where(e => e.Accion is FirmaAccion.Subida or FirmaAccion.Eliminacion or FirmaAccion.Habilitacion or FirmaAccion.Remision)
        .LastOrDefault()?.Accion == FirmaAccion.Habilitacion;

    public bool SolicitudPendiente => Eventos
        .Where(e => e.Accion is FirmaAccion.Solicitud or FirmaAccion.Habilitacion)
        .LastOrDefault()?.Accion == FirmaAccion.Solicitud;

    /// <summary>Hay una firma (con INE) esperando aprobación de RH.</summary>
    public bool EnComprobacion => Eventos
        .Where(e => e.Accion is FirmaAccion.Remision or FirmaAccion.Aprobacion or FirmaAccion.Rechazo)
        .LastOrDefault()?.Accion == FirmaAccion.Remision;

    /// <summary>
    /// El usuario puede enviar firma + INE a revisión: primera firma (subidasEfectivas == 0)
    /// o cambio habilitado por RH, y nunca mientras haya otra remisión en comprobación.
    /// </summary>
    public bool PuedeEnviarRemision(int subidasEfectivas) =>
        !EnComprobacion && (subidasEfectivas == 0 || CambioHabilitado);

    public FirmaEvento? UltimaHabilitacion => Eventos.LastOrDefault(e => e.Accion == FirmaAccion.Habilitacion);

    public FirmaEvento? UltimaSolicitud => Eventos.LastOrDefault(e => e.Accion == FirmaAccion.Solicitud);

    public FirmaEvento? UltimaRemision => Eventos.LastOrDefault(e => e.Accion == FirmaAccion.Remision);

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

    /// <summary>El usuario remite firma + INE a revisión de RH (consume la habilitación si la había).</summary>
    public void AgregarRemision(int idUsuario, DateTime fecha, string firmaPendiente, string ine)
    {
        Eventos.Add(new FirmaEvento
        {
            Accion = FirmaAccion.Remision,
            Fecha = fecha,
            IdUsuario = idUsuario,
            FirmaPendiente = firmaPendiente,
            Ine = ine
        });
    }

    /// <param name="idUsuarioRh">Usuario de RH que aprueba.</param>
    public void AgregarAprobacion(int idUsuarioRh, DateTime fecha) => Agregar(FirmaAccion.Aprobacion, idUsuarioRh, fecha);

    /// <param name="idUsuarioRh">Usuario de RH que rechaza.</param>
    public void AgregarRechazo(int idUsuarioRh, DateTime fecha, string motivo)
    {
        Eventos.Add(new FirmaEvento
        {
            Accion = FirmaAccion.Rechazo,
            Fecha = fecha,
            IdUsuario = idUsuarioRh,
            Motivo = motivo
        });
    }

    private void Agregar(string accion, int idUsuario, DateTime fecha)
    {
        Eventos.Add(new FirmaEvento { Accion = accion, Fecha = fecha, IdUsuario = idUsuario });
    }
}
