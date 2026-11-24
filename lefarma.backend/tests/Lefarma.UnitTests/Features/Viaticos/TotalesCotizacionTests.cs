using FluentAssertions;
using Lefarma.API.Domain.Entities.Viaticos;
using Lefarma.API.Features.Viaticos;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// Separación de capas: `precio` es el precio real y `datos.precio_estimado`
/// es la referencia del motor. Solo lo cotizado alimenta `total_cotizado`;
/// un vuelo estimado sin precio real bloquea la autorización.
/// </summary>
public class TotalesCotizacionTests
{
    private static SolicitudOpcion Opcion(
        string tipo,
        decimal? precio,
        string? datosJson = null,
        bool elegida = true,
        string fuente = "proveedor") => new()
    {
        Tipo = tipo,
        Linea = $"{tipo} de prueba",
        Precio = precio,
        Moneda = "MXN",
        Fuente = fuente,
        FueElegida = elegida,
        DatosJson = datosJson,
    };

    [Theory]
    [InlineData("vuelo", true)]
    [InlineData("avion", true)]
    [InlineData("autobus", true)]
    [InlineData("Autobús", true)]
    [InlineData("hotel", true)]
    [InlineData("taxi", false)]
    [InlineData("auto", false)]
    public void EsTipoDetectable_ReconoceVueloAutobusYHotel(string tipo, bool esperado)
    {
        TotalesCotizacion.EsTipoDetectable(tipo).Should().Be(esperado);
    }

    [Fact]
    public void Calcular_VueloEstimado_NoSumaAlCotizadoYExponeLaReferencia()
    {
        var vuelo = Opcion(
            "vuelo",
            null,
            """{"tipo_precio":"estimado","precio_estimado":1546.14}""");

        var (cotizado, estimado, total) = TotalesCotizacion.Calcular(new[] { vuelo });

        cotizado.Should().BeNull();
        estimado.Should().Be(1546.14m);
        total.Should().Be(1546.14m);
    }

    [Fact]
    public void Calcular_VueloConPrecioReal_SumaAlCotizadoYNoALaReferencia()
    {
        var vuelo = Opcion(
            "vuelo",
            4974m,
            """{"tipo_precio":"cotizado","precio_estimado":1546.14}""");

        var (cotizado, estimado, total) = TotalesCotizacion.Calcular(new[] { vuelo });

        cotizado.Should().Be(4974m);
        estimado.Should().BeNull();
        total.Should().Be(4974m);
    }

    [Fact]
    public void Calcular_MezclaRealYReferencia_LosSeparaYSumaElTotalCompleto()
    {
        var vuelo = Opcion(
            "vuelo",
            4974m,
            """{"tipo_precio":"cotizado","precio_estimado":1546.14}""");
        var taxi = Opcion(
            "taxi",
            795.06m,
            """{"tipo_precio":"estimado"}""");
        var descartado = Opcion(
            "vuelo",
            9999m,
            """{"tipo_precio":"cotizado"}""",
            elegida: false);

        var (cotizado, estimado, total) = TotalesCotizacion.Calcular(
            new[] { vuelo, taxi, descartado });

        cotizado.Should().Be(4974m);
        estimado.Should().Be(795.06m);
        total.Should().Be(5769.06m);
    }

    [Fact]
    public void VuelosSinPrecioReal_SoloDevuelveVuelosElegidosSinCotizar()
    {
        var estimado = Opcion(
            "vuelo",
            null,
            """{"tipo_precio":"estimado","precio_estimado":1546.14}""");
        var real = Opcion(
            "vuelo",
            4974m,
            """{"tipo_precio":"cotizado"}""");
        var bus = Opcion(
            "autobus",
            null,
            """{"tipo_precio":"estimado","precio_estimado":1200}""");
        var descartado = Opcion(
            "vuelo",
            null,
            """{"tipo_precio":"estimado","precio_estimado":900}""",
            elegida: false);

        var pendientes = TotalesCotizacion.VuelosSinPrecioReal(
            new[] { estimado, real, bus, descartado });

        pendientes.Should().ContainSingle().Which.Should().BeSameAs(estimado);
    }

    [Fact]
    public void LeerDeDatos_IgnoraTotalEnTexto()
    {
        using var doc = System.Text.Json.JsonDocument.Parse(
            """{"total":"700","total_cotizado":500}""");

        var (cotizado, estimado, total) = TotalesCotizacion.LeerDeDatos(doc.RootElement);

        cotizado.Should().Be(500m);
        estimado.Should().BeNull();
        total.Should().BeNull("un total en texto no es un importe conocido");
    }
}
