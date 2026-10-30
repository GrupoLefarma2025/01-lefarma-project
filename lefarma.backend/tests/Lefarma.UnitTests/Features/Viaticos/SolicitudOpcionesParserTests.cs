using System.Text.Json;
using FluentAssertions;
using Lefarma.API.Features.Viaticos;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// Reglas de <see cref="SolicitudOpcionesParser"/>: el mismo parser valida la
/// cotizacion del viajero (PUT /opciones) y la ruta que autoriza el revisor
/// (POST /autorizar). Aqui se cubre el contrato de <c>url_compra</c> opcional
/// sin levantar HTTP: texto vacio, null o ausente se guardan como null; un tipo
/// distinto sigue siendo un error claro con el indice de la opcion.
/// </summary>
public class SolicitudOpcionesParserTests
{
    private const int IdSolicitud = 42;
    private static readonly DateTime Ahora = new(2026, 10, 29, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Parsear_SinUrlCompra_GuardaNull()
    {
        var (opciones, error) = Parsear(
            """[{"tipo":"hotel","linea":"Hotel X","precio":1200,"fuente":"proveedor"}]""");

        error.Should().BeNull();
        opciones.Should().ContainSingle();
        opciones[0].UrlCompra.Should().BeNull();
        opciones[0].Tipo.Should().Be("hotel");
        opciones[0].Precio.Should().Be(1200m);
    }

    [Theory]
    [InlineData("null")]
    [InlineData("\"\"")]
    [InlineData("\"   \"")]
    public void Parsear_UrlCompraNulaOVacia_GuardaNull(string urlJson)
    {
        var (opciones, error) = Parsear(
            $$"""[{"tipo":"vuelo","linea":"Vuelo Y","precio":500,"fuente":"proveedor","url_compra":{{urlJson}}}]""");

        error.Should().BeNull();
        opciones.Should().ContainSingle();
        opciones[0].UrlCompra.Should().BeNull();
    }

    [Fact]
    public void Parsear_ConUrlCompra_LaConservaSinEspacios()
    {
        var (opciones, error) = Parsear(
            """[{"tipo":"vuelo","linea":"Vuelo Z","precio":500,"fuente":"proveedor","url_compra":" https://proveedor.test/z "}]""");

        error.Should().BeNull();
        opciones.Should().ContainSingle();
        opciones[0].UrlCompra.Should().Be("https://proveedor.test/z");
    }

    [Fact]
    public void Parsear_UrlCompraDeOtroTipo_DevuelveErrorClaro()
    {
        var (opciones, error) = Parsear(
            """[{"tipo":"vuelo","linea":"Vuelo W","precio":500,"fuente":"proveedor","url_compra":42}]""");

        opciones.Should().BeEmpty();
        error.Should().Be("opciones[0].url_compra debe ser texto o null.");
    }

    [Fact]
    public void Parsear_UrlCompraDeOtroTipo_ReportaElIndiceExacto()
    {
        var (opciones, error) = Parsear(
            """
            [
              {"tipo":"vuelo","linea":"Ok","precio":500,"fuente":"proveedor"},
              {"tipo":"hotel","linea":"Malo","precio":900,"fuente":"proveedor","url_compra":true}
            ]
            """);

        opciones.Should().BeEmpty();
        error.Should().Be("opciones[1].url_compra debe ser texto o null.");
    }

    [Fact]
    public void Parsear_SinFuente_SigueSiendoError()
    {
        var (opciones, error) = Parsear(
            """[{"tipo":"vuelo","linea":"Sin fuente","precio":500}]""");

        opciones.Should().BeEmpty();
        error.Should().Be("opciones[0].fuente es obligatorio.");
    }

    [Fact]
    public void Parsear_PrecioNullSinFuenteEstimada_SigueSiendoError()
    {
        var (opciones, error) = Parsear(
            """[{"tipo":"hotel","linea":"Sin precio","precio":null,"fuente":"proveedor"}]""");

        opciones.Should().BeEmpty();
        error.Should().Be("opciones[0].precio solo puede ser null si la fuente es estimada.");
    }

    private static (List<Lefarma.API.Domain.Entities.Viaticos.SolicitudOpcion> Opciones, string? Error)
        Parsear(string opcionesJson)
    {
        using var doc = JsonDocument.Parse(opcionesJson);
        return SolicitudOpcionesParser.Parsear(IdSolicitud, doc.RootElement, Ahora);
    }
}
