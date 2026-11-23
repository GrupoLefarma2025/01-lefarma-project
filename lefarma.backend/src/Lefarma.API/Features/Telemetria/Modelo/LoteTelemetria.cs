namespace Lefarma.API.Features.Telemetria.Modelo;

public sealed record DatosPeticion(
    string? UsuarioHash,
    string? Rol,
    string Entorno,
    string? Servidor);

public sealed record LoteTelemetria(
    string LoteId,
    DateTime RecibidoEn,
    DateTime EnviadoEn,
    string? VisitaId,
    string? VersionApp,
    IReadOnlyList<EventoTelemetria> Eventos,
    DatosPeticion Peticion);
