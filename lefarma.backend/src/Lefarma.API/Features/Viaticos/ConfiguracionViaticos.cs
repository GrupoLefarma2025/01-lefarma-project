using System.Globalization;

namespace Lefarma.API.Features.Viaticos;

/// <summary>
/// Valores de configuración de viáticos que viven en la tabla
/// <c>viaticos.config_parametros</c>. Si una clave no existe (o la tabla aún no
/// está creada) se usa el valor por defecto del motor, para que la base pueda
/// empezar vacía sin romper los cálculos.
/// </summary>
public static class ConfiguracionViaticos
{
    private static Dictionary<string, string> _valores = new(StringComparer.OrdinalIgnoreCase);

    public static IReadOnlyDictionary<string, string> Valores => _valores;

    public static void Cargar(IEnumerable<(string Clave, string Valor)> filas)
    {
        var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (clave, valor) in filas) dict[clave] = valor;
        _valores = dict;
    }

    public static decimal Decimal(string clave, decimal porDefecto)
        => _valores.TryGetValue(clave, out var v)
            && decimal.TryParse(v, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : porDefecto;

    public static double Double(string clave, double porDefecto)
        => _valores.TryGetValue(clave, out var v)
            && double.TryParse(v, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : porDefecto;

    public static bool Booleano(string clave, bool porDefecto)
        => _valores.TryGetValue(clave, out var v)
            ? v.Trim() is "1" or "true" or "True" or "si" or "sí" or "SI"
            : porDefecto;

    public static string Texto(string clave, string porDefecto)
        => _valores.TryGetValue(clave, out var v) && !string.IsNullOrWhiteSpace(v) ? v.Trim() : porDefecto;
}
