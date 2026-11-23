using System.Text;
using System.Text.Json;

namespace Lefarma.API.Features.Configuracion;

public static class ConfiguracionJson
{
    private static JsonElement Nulo()
    {
        using var documento = JsonDocument.Parse("null");
        return documento.RootElement.Clone();
    }

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

    public static JsonElement? ParsearEsquema(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        var elemento = Parsear(json);
        return elemento.ValueKind == JsonValueKind.Null ? null : elemento;
    }

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

    public static JsonElement? Normalizar(JsonElement? elemento)
        => elemento is { ValueKind: not JsonValueKind.Undefined } ? elemento : null;
}
