using System.Text.Json;

namespace Lefarma.API.Domain.Firmas;

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

    public bool EnComprobacion => Eventos
        .Where(e => e.Accion is FirmaAccion.Remision or FirmaAccion.Aprobacion or FirmaAccion.Rechazo)
        .LastOrDefault()?.Accion == FirmaAccion.Remision;

    public bool PuedeEnviarRemision(int subidasEfectivas) =>
        !EnComprobacion && (subidasEfectivas == 0 || CambioHabilitado);

    public FirmaEvento? UltimaHabilitacion => Eventos.LastOrDefault(e => e.Accion == FirmaAccion.Habilitacion);

    public FirmaEvento? UltimaSolicitud => Eventos.LastOrDefault(e => e.Accion == FirmaAccion.Solicitud);

    public FirmaEvento? UltimaRemision => Eventos.LastOrDefault(e => e.Accion == FirmaAccion.Remision);

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

    public void AgregarHabilitacion(int idUsuarioRh, DateTime fecha) => Agregar(FirmaAccion.Habilitacion, idUsuarioRh, fecha);

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

    public void AgregarAprobacion(int idUsuarioRh, DateTime fecha, string? firmaArchivo = null, string? ineArchivo = null)
    {
        Eventos.Add(new FirmaEvento
        {
            Accion = FirmaAccion.Aprobacion,
            Fecha = fecha,
            IdUsuario = idUsuarioRh,
            FirmaArchivo = firmaArchivo,
            IneArchivo = ineArchivo
        });
    }

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
