namespace Lefarma.API.Features.Configuracion;

/// <summary>
/// Tipos de dato soportados por las variables de configuración.
/// El valor siempre se persiste como JSON canónico.
/// </summary>
public static class ConfiguracionTiposDato
{
    public const string String = "string";
    public const string Text = "text";
    public const string Integer = "integer";
    public const string Decimal = "decimal";
    public const string Boolean = "boolean";
    public const string Date = "date";
    public const string Time = "time";
    public const string DateTime = "datetime";
    public const string Enum = "enum";
    public const string Object = "object";
    public const string Array = "array";
    public const string Json = "json";

    public static readonly string[] Todos =
    [
        String, Text, Integer, Decimal, Boolean, Date, Time, DateTime, Enum, Object, Array, Json
    ];

    private static readonly HashSet<string> Soportados = new(Todos, StringComparer.OrdinalIgnoreCase);

    public static bool EsValido(string? tipoDato)
        => !string.IsNullOrWhiteSpace(tipoDato) && Soportados.Contains(tipoDato.Trim());

    /// <summary>Normaliza a minúsculas sin espacios; null si viene vacío.</summary>
    public static string? Normalizar(string? tipoDato)
        => string.IsNullOrWhiteSpace(tipoDato) ? null : tipoDato.Trim().ToLowerInvariant();
}

/// <summary>Acciones registradas en la bitácora de variables de configuración.</summary>
public static class ConfiguracionAcciones
{
    public const string Crear = "crear";
    public const string Actualizar = "actualizar";
    public const string Desactivar = "desactivar";
    public const string Reactivar = "reactivar";
    public const string Restaurar = "restaurar";
}
