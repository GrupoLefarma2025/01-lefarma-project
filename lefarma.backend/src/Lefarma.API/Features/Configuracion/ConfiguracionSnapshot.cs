using System.Text.Json;

namespace Lefarma.API.Features.Configuracion;

/// <summary>
/// Snapshot completo de una variable tal como se guarda en la bitácora (camelCase).
/// </summary>
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

/// <summary>
/// Campos editables recuperados de un snapshot de bitácora para restaurar una versión.
/// Las banderas indican si la propiedad venía presente en el JSON (para distinguir
/// "no definida" de "definida como null").
/// </summary>
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
