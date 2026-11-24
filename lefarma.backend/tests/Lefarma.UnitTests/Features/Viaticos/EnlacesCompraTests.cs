using System.Text.Json;
using FluentAssertions;
using Lefarma.API.Features.Viaticos;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// Kayak devuelve enlaces /book/flight de sesión que caducan. El detalle debe
/// mostrar la búsqueda estable de la ruta y fecha, también para datos viejos.
/// </summary>
public class EnlacesCompraTests
{
    private const string EnlaceEfimero =
        "https://www.kayak.com.mx/book/flight?code=abc&viewId=123";

    private static JsonElement Datos()
    {
        using var doc = JsonDocument.Parse(
            """
            {
              "origen": { "punto": { "municipio": "Ciudad de México" } },
              "destinos": [
                {
                  "punto": { "municipio": "Monterrey" },
                  "debeEstarFecha": "2026-11-23"
                }
              ],
              "retorno": { "llegadaRequeridaFecha": "2026-11-24" },
              "calculo": {
                "tramos": [
                  {
                    "de": "Ciudad de México, Ciudad de México",
                    "a": "Monterrey, Nuevo León",
                    "salida_fecha": "2026-11-23"
                  },
                  {
                    "de": "Monterrey, Nuevo León",
                    "a": "Regreso al origen",
                    "salida_fecha": "2026-11-24"
                  }
                ],
                "ruta": {
                  "nodos": [
                    { "url_compra": "https://www.kayak.com.mx/book/flight?code=abc&viewId=123" }
                  ]
                }
              }
            }
            """);
        return doc.RootElement.Clone();
    }

    [Fact]
    public void Canonicalizar_CambiaElEnlaceDeIdaPorLaBusquedaEstable()
    {
        var datos = Datos();
        var opcion = """{"tramo":0,"de":"Ciudad de México, Ciudad de México","a":"Monterrey, Nuevo León"}""";

        var resultado = EnlacesCompra.Canonicalizar(EnlaceEfimero, datos, opcion);

        resultado.Should().Be(
            "https://www.kayak.com.mx/flights/MEX-MTY/2026-11-23?sort=bestflight_a&fs=cabin=e");
    }

    [Fact]
    public void Canonicalizar_RespetaElRegresoYAbreLaRutaInversa()
    {
        var datos = Datos();
        var opcion = """{"tramo":1,"de":"Monterrey, Nuevo León","a":"Regreso al origen"}""";

        var resultado = EnlacesCompra.Canonicalizar(EnlaceEfimero, datos, opcion);

        resultado.Should().Be(
            "https://www.kayak.com.mx/flights/MTY-MEX/2026-11-24?sort=bestflight_a&fs=cabin=e");
    }

    [Fact]
    public void Canonicalizar_ConservaEnlacesQueNoSonDeKayak()
    {
        var datos = Datos();

        var resultado = EnlacesCompra.Canonicalizar(
            "https://proveedor.test/boleto",
            datos,
            """{"tramo":0}""");

        resultado.Should().Be("https://proveedor.test/boleto");
    }

    [Fact]
    public void ReemplazarEnlaces_CorrigeLosEnlacesAnidadosDelSnapshot()
    {
        var datos = Datos();
        var reemplazos = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [EnlaceEfimero] =
                "https://www.kayak.com.mx/flights/MEX-MTY/2026-11-23?sort=bestflight_a&fs=cabin=e",
        };

        var resultado = EnlacesCompra.ReemplazarEnlaces(datos, reemplazos);

        resultado.Should().NotBeNull();
        var texto = resultado!.Value.GetRawText();
        texto.Should().Contain("kayak.com.mx/flights/MEX-MTY/2026-11-23");
        texto.Should().NotContain("kayak.com.mx/book/flight");
    }
}
