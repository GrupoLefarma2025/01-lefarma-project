using System.Text.Json;

namespace Lefarma.API.Features.Configuracion;

public sealed record ConfiguracionSnapshot(
    long IdVariable,
    string Clave,
    string Nombre,
    string? Descripcion,
    string TipoDato,
    JsonElement Valor,
    JsonElement? Esquema,
    bool DisponibleBackend,
    bool DisponibleFrontend,
    bool DisponibleSql,
    bool DisponibleIntegraciones,
    bool Activo,
    long Version);

public sealed record ConfiguracionValoresRestaurables
{
    public string? Nombre { get; init; }

    public bool DescripcionDefinida { get; init; }

    public string? Descripcion { get; init; }

    public JsonElement? Valor { get; init; }

    public bool EsquemaDefinido { get; init; }

    public JsonElement? Esquema { get; init; }

    public bool? DisponibleBackend { get; init; }

    public bool? DisponibleFrontend { get; init; }

    public bool? DisponibleSql { get; init; }

    public bool? DisponibleIntegraciones { get; init; }
}
