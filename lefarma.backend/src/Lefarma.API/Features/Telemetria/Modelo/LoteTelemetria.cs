namespace Lefarma.API.Features.Telemetria.Modelo;

/// <summary>
/// Datos que pone el servidor al recibir un lote. Nunca llegan desde el navegador.
/// </summary>
public sealed record DatosPeticion(
    string? UsuarioHash,
    string? Rol,
    string Entorno,
    string? Servidor);

/// <summary>
/// Un lote recibido del SDK, ya validado y atribuido por el servidor. Es la unidad
/// que viaja por la cola y la que se escribe de forma idempotente por
/// <see cref="LoteId"/>.
/// </summary>
public sealed record LoteTelemetria(
    string LoteId,
    DateTime RecibidoEn,
    DateTime EnviadoEn,
    string? VisitaId,
    string? VersionApp,
    IReadOnlyList<EventoTelemetria> Eventos,
    DatosPeticion Peticion);
