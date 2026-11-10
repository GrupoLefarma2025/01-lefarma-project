using System.Text;
using System.Text.Json;

namespace Lefarma.API.Features.Configuracion;

/// <summary>
/// Utilidades para convertir entre el JSON almacenado en la base de datos
/// y los <see cref="JsonElement"/> que expone la API.
/// </summary>
public static class ConfiguracionJson
{
    private static JsonElement Nulo()
    {
        using var documento = JsonDocument.Parse("null");
        return documento.RootElement.Clone();
    }

    /// <summary>Parsea un JSON; si viene vacío o corrupto devuelve el literal null.</summary>
    public static JsonElement Parsear(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Nulo();
        }

        try
        {
            using var documento = JsonDocument.Parse(json);
            return documento.RootElement.Clone();
        }
        catch (JsonException)
        {
            return Nulo();
        }
    }

    /// <summary>Parsea el esquema; null cuando no existe o es el literal null.</summary>
    public static JsonElement? ParsearEsquema(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        var elemento = Parsear(json);
        return elemento.ValueKind == JsonValueKind.Null ? null : elemento;
    }

    /// <summary>Serializa un elemento como JSON compacto (canónico).</summary>
    public static string Canonicalizar(JsonElement valor)
    {
        using var memoria = new MemoryStream();
        using (var escritor = new Utf8JsonWriter(memoria, new JsonWriterOptions
               {
                   Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
               }))
        {
            valor.WriteTo(escritor);
        }

        return Encoding.UTF8.GetString(memoria.ToArray());
    }

    /// <summary>Normaliza un elemento opcional: Undefined pasa a null.</summary>
    public static JsonElement? Normalizar(JsonElement? elemento)
        => elemento is { ValueKind: not JsonValueKind.Undefined } ? elemento : null;
}
