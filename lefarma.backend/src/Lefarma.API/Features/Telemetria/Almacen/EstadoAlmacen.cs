namespace Lefarma.API.Features.Telemetria.Almacen;

/// <summary>Estado del almacén de telemetría (SQL Server, esquema `telemetria`).</summary>
public sealed record EstadoAlmacen(
    bool Habilitada,
    bool Disponible,
    string Destino,
    string? Error,
    IReadOnlyDictionary<string, long> Tablas);
