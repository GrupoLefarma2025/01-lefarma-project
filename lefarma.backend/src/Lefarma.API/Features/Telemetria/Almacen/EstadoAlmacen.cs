namespace Lefarma.API.Features.Telemetria.Almacen;

public sealed record EstadoAlmacen(
    bool Habilitada,
    bool Disponible,
    string Destino,
    string? Error,
    IReadOnlyDictionary<string, long> Tablas);
