using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using ErrorOr;
using Lefarma.API.Shared.Errors;

namespace Lefarma.API.Features.Configuracion;

/// <summary>
/// Validador recursivo del valor de una variable de configuración contra su tipo de dato
/// y el subconjunto de JSON Schema declarado en <c>esquema_json</c>.
/// </summary>
public static class ConfiguracionValueValidator
{
    /// <summary>Profundidad máxima permitida para esquemas y valores anidados.</summary>
    public const int ProfundidadMaxima = 32;

    private static readonly TimeSpan RegexTimeout = TimeSpan.FromMilliseconds(250);

    private static readonly string[] FormatosFecha =
    [
        "yyyy-MM-dd"
    ];

    private static readonly string[] FormatosHora =
    [
        "HH:mm",
        "HH:mm:ss",
        "HH:mm:ss.FFFFFFF"
    ];

    private static readonly string[] FormatosFechaHora =
    [
        "yyyy-MM-dd",
        "yyyy-MM-ddTHH:mm",
        "yyyy-MM-ddTHH:mm:ss",
        "yyyy-MM-ddTHH:mm:ss.FFFFFFF",
        "yyyy-MM-ddTHH:mm:ssK",
        "yyyy-MM-ddTHH:mm:ss.FFFFFFFK",
        "yyyy-MM-dd HH:mm:ss"
    ];

    private static readonly HashSet<string> TiposEsquema =
    [
        "string", "number", "integer", "boolean", "object", "array", "null"
    ];

    /// <summary>
    /// Valida el valor de la variable. Devuelve los errores con la ruta exacta del campo
    /// (por ejemplo <c>valor.configuracion.correo</c>).
    /// </summary>
    public static ErrorOr<Success> Validar(
        string? tipoDato,
        JsonElement valor,
        JsonElement? esquema,
        string ruta = "valor")
    {
        var tipo = ConfiguracionTiposDato.Normalizar(tipoDato);
        if (tipo is null || !ConfiguracionTiposDato.EsValido(tipo))
        {
            return CommonErrors.Validation(
                "tipoDato",
                $"El tipo de dato '{tipoDato}' no está soportado. Tipos válidos: {string.Join(", ", ConfiguracionTiposDato.Todos)}.");
        }

        JsonElement? esquemaReal = null;
        if (esquema.HasValue)
        {
            switch (esquema.Value.ValueKind)
            {
                case JsonValueKind.Undefined:
                case JsonValueKind.Null:
                    break;
                case JsonValueKind.Object:
                    esquemaReal = esquema.Value;
                    break;
                default:
                    return CommonErrors.Validation("esquema", "El esquema debe ser un objeto JSON o null.");
            }
        }

        if (esquemaReal.HasValue)
        {
            var validacionEsquema = ValidarEsquema(esquemaReal.Value);
            if (validacionEsquema.IsError)
            {
                return validacionEsquema.Errors;
            }
        }

        var validacionTipo = ValidarTipo(tipo, valor, ruta);
        if (validacionTipo.IsError)
        {
            return validacionTipo.Errors;
        }

        return esquemaReal.HasValue
            ? ValidarContraEsquema(valor, esquemaReal.Value, ruta, 0)
            : Result.Success;
    }

    /// <summary>Valida la estructura del esquema (subconjunto de JSON Schema).</summary>
    public static ErrorOr<Success> ValidarEsquema(JsonElement esquema, string ruta = "esquema")
    {
        if (esquema.ValueKind == JsonValueKind.Null || esquema.ValueKind == JsonValueKind.Undefined)
        {
            return Result.Success;
        }

        if (esquema.ValueKind != JsonValueKind.Object)
        {
            return CommonErrors.Validation(ruta, "El esquema debe ser un objeto JSON.");
        }

        return ValidarNodoEsquema(esquema, ruta, 0);
    }

    private static ErrorOr<Success> ValidarTipo(string tipo, JsonElement valor, string ruta)
    {
        if (valor.ValueKind == JsonValueKind.Undefined)
        {
            return Campo(ruta, "es obligatorio");
        }

        switch (tipo)
        {
            case ConfiguracionTiposDato.String:
            case ConfiguracionTiposDato.Text:
                return valor.ValueKind == JsonValueKind.String
                    ? Result.Success
                    : Campo(ruta, "debe ser una cadena de texto");

            case ConfiguracionTiposDato.Integer:
                if (valor.ValueKind != JsonValueKind.Number || !valor.TryGetDecimal(out var entero))
                {
                    return Campo(ruta, "debe ser un número entero");
                }

                return entero == decimal.Truncate(entero)
                    ? Result.Success
                    : Campo(ruta, "debe ser un número entero (sin decimales)");

            case ConfiguracionTiposDato.Decimal:
                return valor.ValueKind == JsonValueKind.Number
                    ? Result.Success
                    : Campo(ruta, "debe ser un número");

            case ConfiguracionTiposDato.Boolean:
                return valor.ValueKind is JsonValueKind.True or JsonValueKind.False
                    ? Result.Success
                    : Campo(ruta, "debe ser un valor booleano (true o false)");

            case ConfiguracionTiposDato.Date:
                if (valor.ValueKind != JsonValueKind.String)
                {
                    return Campo(ruta, "debe ser una fecha en formato ISO 8601 (yyyy-MM-dd)");
                }

                return DateOnly.TryParseExact(valor.GetString(), FormatosFecha, CultureInfo.InvariantCulture, DateTimeStyles.None, out _)
                    ? Result.Success
                    : Campo(ruta, "debe ser una fecha válida en formato ISO 8601 (yyyy-MM-dd)");

            case ConfiguracionTiposDato.Time:
                if (valor.ValueKind != JsonValueKind.String)
                {
                    return Campo(ruta, "debe ser una hora en formato ISO 8601 (HH:mm o HH:mm:ss)");
                }

                return TimeOnly.TryParseExact(valor.GetString(), FormatosHora, CultureInfo.InvariantCulture, DateTimeStyles.None, out _)
                    ? Result.Success
                    : Campo(ruta, "debe ser una hora válida en formato ISO 8601 (HH:mm o HH:mm:ss)");

            case ConfiguracionTiposDato.DateTime:
                if (valor.ValueKind != JsonValueKind.String)
                {
                    return Campo(ruta, "debe ser una fecha y hora en formato ISO 8601");
                }

                return DateTime.TryParseExact(
                    valor.GetString(),
                    FormatosFechaHora,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out _)
                    ? Result.Success
                    : Campo(ruta, "debe ser una fecha y hora válida en formato ISO 8601 (por ejemplo 2026-01-31T18:30:00-06:00)");

            case ConfiguracionTiposDato.Enum:
                return valor.ValueKind == JsonValueKind.String
                    ? Result.Success
                    : Campo(ruta, "debe ser una cadena de texto (enum)");

            case ConfiguracionTiposDato.Object:
                return valor.ValueKind == JsonValueKind.Object
                    ? Result.Success
                    : Campo(ruta, "debe ser un objeto JSON");

            case ConfiguracionTiposDato.Array:
                return valor.ValueKind == JsonValueKind.Array
                    ? Result.Success
                    : Campo(ruta, "debe ser un arreglo JSON");

            case ConfiguracionTiposDato.Json:
                return Result.Success;

            default:
                return Campo(ruta, $"usa un tipo de dato no soportado ({tipo})");
        }
    }

    private static ErrorOr<Success> ValidarNodoEsquema(JsonElement esquema, string ruta, int profundidad)
    {
        if (profundidad > ProfundidadMaxima)
        {
            return Campo(ruta, $"excede la profundidad máxima de {ProfundidadMaxima} niveles");
        }

        if (esquema.ValueKind != JsonValueKind.Object)
        {
            return Campo(ruta, "debe ser un objeto JSON");
        }

        if (esquema.TryGetProperty("type", out var tipoEsquema))
        {
            if (tipoEsquema.ValueKind != JsonValueKind.String)
            {
                return Campo($"{ruta}.type", "debe ser una cadena de texto");
            }

            var nombreTipo = tipoEsquema.GetString() ?? string.Empty;
            if (!TiposEsquema.Contains(nombreTipo))
            {
                return Campo($"{ruta}.type", $"debe ser uno de: {string.Join(", ", TiposEsquema)}");
            }
        }

        if (esquema.TryGetProperty("properties", out var propiedades))
        {
            if (propiedades.ValueKind != JsonValueKind.Object)
            {
                return Campo($"{ruta}.properties", "debe ser un objeto JSON");
            }

            foreach (var propiedad in propiedades.EnumerateObject())
            {
                var validacion = ValidarNodoEsquema(propiedad.Value, $"{ruta}.properties.{propiedad.Name}", profundidad + 1);
                if (validacion.IsError)
                {
                    return validacion.Errors;
                }
            }
        }

        if (esquema.TryGetProperty("items", out var items))
        {
            if (items.ValueKind != JsonValueKind.Object)
            {
                return Campo($"{ruta}.items", "debe ser un objeto JSON");
            }

            var validacion = ValidarNodoEsquema(items, $"{ruta}.items", profundidad + 1);
            if (validacion.IsError)
            {
                return validacion.Errors;
            }
        }

        if (esquema.TryGetProperty("required", out var requeridos))
        {
            if (requeridos.ValueKind != JsonValueKind.Array)
            {
                return Campo($"{ruta}.required", "debe ser un arreglo de cadenas");
            }

            foreach (var requerido in requeridos.EnumerateArray())
            {
                if (requerido.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(requerido.GetString()))
                {
                    return Campo($"{ruta}.required", "debe contener solo nombres de propiedad no vacíos");
                }
            }
        }

        if (esquema.TryGetProperty("additionalProperties", out var adicionales) &&
            adicionales.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
        {
            return Campo($"{ruta}.additionalProperties", "debe ser true o false");
        }

        if (esquema.TryGetProperty("enum", out var valoresEnum))
        {
            if (valoresEnum.ValueKind != JsonValueKind.Array)
            {
                return Campo($"{ruta}.enum", "debe ser un arreglo");
            }

            if (valoresEnum.GetArrayLength() == 0)
            {
                return Campo($"{ruta}.enum", "debe tener al menos un valor");
            }

            foreach (var valorEnum in valoresEnum.EnumerateArray())
            {
                if (valorEnum.ValueKind is JsonValueKind.Object or JsonValueKind.Array or JsonValueKind.Undefined)
                {
                    return Campo($"{ruta}.enum", "solo admite valores escalares");
                }
            }
        }

        if (esquema.TryGetProperty("opciones", out var opciones))
        {
            if (opciones.ValueKind != JsonValueKind.Array)
            {
                return Campo($"{ruta}.opciones", "debe ser un arreglo");
            }

            foreach (var opcion in opciones.EnumerateArray())
            {
                if (opcion.ValueKind != JsonValueKind.Object ||
                    !opcion.TryGetProperty("value", out var valorOpcion) ||
                    valorOpcion.ValueKind != JsonValueKind.String)
                {
                    return Campo($"{ruta}.opciones", "cada opción debe ser un objeto con la propiedad 'value' de tipo texto");
                }
            }
        }

        foreach (var (nombre, valor) in new[]
                 {
                     ("minLength", LeerEntero(esquema, "minLength")),
                     ("maxLength", LeerEntero(esquema, "maxLength"))
                 })
        {
            if (valor.HasValue && valor.Value < 0)
            {
                return Campo($"{ruta}.{nombre}", "debe ser un entero mayor o igual a 0");
            }
        }

        var minLength = LeerEntero(esquema, "minLength");
        var maxLength = LeerEntero(esquema, "maxLength");
        if (minLength.HasValue && maxLength.HasValue && minLength.Value > maxLength.Value)
        {
            return Campo($"{ruta}.minLength", "no puede ser mayor que maxLength");
        }

        var minimum = LeerDecimal(esquema, "minimum");
        var maximum = LeerDecimal(esquema, "maximum");
        if (minimum.HasValue && maximum.HasValue && minimum.Value > maximum.Value)
        {
            return Campo($"{ruta}.minimum", "no puede ser mayor que maximum");
        }

        if (esquema.TryGetProperty("pattern", out var patron))
        {
            if (patron.ValueKind != JsonValueKind.String)
            {
                return Campo($"{ruta}.pattern", "debe ser una cadena de texto");
            }

            var expresion = patron.GetString();
            if (!string.IsNullOrEmpty(expresion))
            {
                try
                {
                    _ = new Regex(expresion, RegexOptions.CultureInvariant, RegexTimeout);
                }
                catch (ArgumentException)
                {
                    return Campo($"{ruta}.pattern", "no es una expresión regular válida");
                }
            }
        }

        return Result.Success;
    }

    private static ErrorOr<Success> ValidarContraEsquema(
        JsonElement valor,
        JsonElement esquema,
        string ruta,
        int profundidad)
    {
        if (profundidad > ProfundidadMaxima)
        {
            return Campo(ruta, $"excede la profundidad máxima de {ProfundidadMaxima} niveles");
        }

        if (esquema.ValueKind != JsonValueKind.Object)
        {
            return Result.Success;
        }

        if (esquema.TryGetProperty("type", out var tipoEsquema) &&
            tipoEsquema.ValueKind == JsonValueKind.String)
        {
            var esperado = tipoEsquema.GetString() ?? string.Empty;
            if (!CoincideTipo(esperado, valor))
            {
                return Campo(ruta, $"debe ser de tipo {esperado}");
            }
        }

        var opcionesEnum = LeerOpcionesEnum(esquema);
        if (opcionesEnum.Count > 0)
        {
            if (valor.ValueKind != JsonValueKind.String)
            {
                return Campo(ruta, "debe ser una cadena de texto");
            }

            var textoValor = valor.GetString() ?? string.Empty;
            if (!opcionesEnum.Contains(textoValor))
            {
                return Campo(ruta, $"debe ser uno de: {string.Join(", ", opcionesEnum)}");
            }
        }

        if (valor.ValueKind == JsonValueKind.String)
        {
            var texto = valor.GetString() ?? string.Empty;

            var minLength = LeerEntero(esquema, "minLength");
            if (minLength.HasValue && texto.Length < minLength.Value)
            {
                return Campo(ruta, $"debe tener al menos {minLength.Value} caracteres");
            }

            var maxLength = LeerEntero(esquema, "maxLength");
            if (maxLength.HasValue && texto.Length > maxLength.Value)
            {
                return Campo(ruta, $"no puede exceder {maxLength.Value} caracteres");
            }

            if (esquema.TryGetProperty("pattern", out var patron) &&
                patron.ValueKind == JsonValueKind.String &&
                !string.IsNullOrEmpty(patron.GetString()))
            {
                try
                {
                    if (!Regex.IsMatch(texto, patron.GetString()!, RegexOptions.CultureInvariant, RegexTimeout))
                    {
                        return Campo(ruta, "no cumple con el formato requerido");
                    }
                }
                catch (ArgumentException)
                {
                    return Campo(ruta, "el esquema contiene un patrón inválido");
                }
                catch (RegexMatchTimeoutException)
                {
                    return Campo(ruta, "el patrón del esquema tardó demasiado en evaluarse");
                }
            }
        }

        if (valor.ValueKind == JsonValueKind.Number && valor.TryGetDecimal(out var numero))
        {
            var minimum = LeerDecimal(esquema, "minimum");
            if (minimum.HasValue && numero < minimum.Value)
            {
                return Campo(ruta, $"debe ser mayor o igual a {minimum.Value.ToString(CultureInfo.InvariantCulture)}");
            }

            var maximum = LeerDecimal(esquema, "maximum");
            if (maximum.HasValue && numero > maximum.Value)
            {
                return Campo(ruta, $"debe ser menor o igual a {maximum.Value.ToString(CultureInfo.InvariantCulture)}");
            }
        }

        if (valor.ValueKind == JsonValueKind.Object)
        {
            JsonElement? propiedades = esquema.TryGetProperty("properties", out var props) &&
                                       props.ValueKind == JsonValueKind.Object
                ? props
                : null;

            if (esquema.TryGetProperty("required", out var requeridos) &&
                requeridos.ValueKind == JsonValueKind.Array)
            {
                foreach (var requerido in requeridos.EnumerateArray())
                {
                    if (requerido.ValueKind != JsonValueKind.String)
                    {
                        continue;
                    }

                    var nombre = requerido.GetString()!;
                    if (!valor.TryGetProperty(nombre, out _))
                    {
                        return Campo($"{ruta}.{nombre}", "es obligatorio");
                    }
                }
            }

            if (propiedades.HasValue)
            {
                foreach (var propiedad in propiedades.Value.EnumerateObject())
                {
                    if (!valor.TryGetProperty(propiedad.Name, out var valorPropiedad))
                    {
                        continue;
                    }

                    var validacion = ValidarContraEsquema(
                        valorPropiedad,
                        propiedad.Value,
                        $"{ruta}.{propiedad.Name}",
                        profundidad + 1);

                    if (validacion.IsError)
                    {
                        return validacion.Errors;
                    }
                }
            }

            if (esquema.TryGetProperty("additionalProperties", out var adicionales) &&
                adicionales.ValueKind == JsonValueKind.False &&
                propiedades.HasValue)
            {
                var permitidas = propiedades.Value
                    .EnumerateObject()
                    .Select(p => p.Name)
                    .ToHashSet(StringComparer.Ordinal);

                foreach (var propiedad in valor.EnumerateObject())
                {
                    if (!permitidas.Contains(propiedad.Name))
                    {
                        return Campo($"{ruta}.{propiedad.Name}", "no es una propiedad permitida por el esquema");
                    }
                }
            }
        }

        if (valor.ValueKind == JsonValueKind.Array &&
            esquema.TryGetProperty("items", out var items) &&
            items.ValueKind == JsonValueKind.Object)
        {
            var indice = 0;
            foreach (var elemento in valor.EnumerateArray())
            {
                var validacion = ValidarContraEsquema(elemento, items, $"{ruta}[{indice}]", profundidad + 1);
                if (validacion.IsError)
                {
                    return validacion.Errors;
                }

                indice++;
            }
        }

        return Result.Success;
    }

    private static bool CoincideTipo(string tipoEsquema, JsonElement valor)
    {
        return tipoEsquema switch
        {
            "string" => valor.ValueKind == JsonValueKind.String,
            "number" => valor.ValueKind == JsonValueKind.Number,
            "integer" => valor.ValueKind == JsonValueKind.Number &&
                         valor.TryGetDecimal(out var numero) &&
                         numero == decimal.Truncate(numero),
            "boolean" => valor.ValueKind is JsonValueKind.True or JsonValueKind.False,
            "object" => valor.ValueKind == JsonValueKind.Object,
            "array" => valor.ValueKind == JsonValueKind.Array,
            "null" => valor.ValueKind == JsonValueKind.Null,
            _ => true
        };
    }

    private static HashSet<string> LeerOpcionesEnum(JsonElement esquema)
    {
        var opciones = new HashSet<string>(StringComparer.Ordinal);

        if (esquema.TryGetProperty("enum", out var valores) && valores.ValueKind == JsonValueKind.Array)
        {
            foreach (var valor in valores.EnumerateArray())
            {
                if (valor.ValueKind == JsonValueKind.String && valor.GetString() is { } texto)
                {
                    opciones.Add(texto);
                }
            }

            return opciones;
        }

        if (esquema.TryGetProperty("opciones", out var lista) && lista.ValueKind == JsonValueKind.Array)
        {
            foreach (var opcion in lista.EnumerateArray())
            {
                if (opcion.ValueKind == JsonValueKind.Object &&
                    opcion.TryGetProperty("value", out var valor) &&
                    valor.ValueKind == JsonValueKind.String &&
                    valor.GetString() is { } texto)
                {
                    opciones.Add(texto);
                }
            }
        }

        return opciones;
    }

    private static int? LeerEntero(JsonElement esquema, string nombre)
    {
        if (!esquema.TryGetProperty(nombre, out var propiedad) || propiedad.ValueKind != JsonValueKind.Number)
        {
            return null;
        }

        if (propiedad.TryGetInt32(out var entero))
        {
            return entero;
        }

        if (propiedad.TryGetDouble(out var doble) && doble >= int.MinValue && doble <= int.MaxValue)
        {
            return (int)doble;
        }

        return null;
    }

    private static decimal? LeerDecimal(JsonElement esquema, string nombre)
    {
        if (!esquema.TryGetProperty(nombre, out var propiedad))
        {
            return null;
        }

        return propiedad.ValueKind == JsonValueKind.Number && propiedad.TryGetDecimal(out var numero)
            ? numero
            : null;
    }

    private static Error Campo(string ruta, string mensaje)
        => CommonErrors.Validation(ruta, $"'{ruta}' {mensaje}.");
}
