namespace Lefarma.API.Features.Configuracion;

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
    public const string DateRange = "date_range";
    public const string DateTimeRange = "datetime_range";
    public const string IntegerRange = "integer_range";
    public const string DecimalRange = "decimal_range";

    public static readonly string[] Todos =
    [
        String, Text, Integer, Decimal, Boolean, Date, Time, DateTime, Enum, Object, Array, Json,
        DateRange, DateTimeRange, IntegerRange, DecimalRange
    ];

    public static readonly string[] Rangos =
    [
        DateRange, DateTimeRange, IntegerRange, DecimalRange
    ];

    private static readonly HashSet<string> Soportados = new(Todos, StringComparer.OrdinalIgnoreCase);

    private static readonly HashSet<string> SoportadosRango = new(Rangos, StringComparer.OrdinalIgnoreCase);

    public static bool EsRango(string? tipoDato)
        => !string.IsNullOrWhiteSpace(tipoDato) && SoportadosRango.Contains(tipoDato.Trim());

    public static bool EsValido(string? tipoDato)
        => !string.IsNullOrWhiteSpace(tipoDato) && Soportados.Contains(tipoDato.Trim());

    public static string? Normalizar(string? tipoDato)
        => string.IsNullOrWhiteSpace(tipoDato) ? null : tipoDato.Trim().ToLowerInvariant();
}

public static class ConfiguracionAcciones
{
    public const string Crear = "crear";
    public const string Actualizar = "actualizar";
    public const string Desactivar = "desactivar";
    public const string Reactivar = "reactivar";
    public const string Restaurar = "restaurar";
}
