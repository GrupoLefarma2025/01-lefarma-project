using FluentAssertions;
using Lefarma.API.Features.Viaticos;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// Regla de selección automática: el más barato que llegue a tiempo, sin
/// anuncios y con los minutos de taxi sumados a la llegada.
/// </summary>
public class DeteccionPrecioVueloServiceTests
{
    private static VueloDetectado Vuelo(
        string aerolinea,
        int salidaHora,
        int salidaMinuto,
        int llegadaHora,
        int llegadaMinuto,
        decimal precio,
        bool patrocinado = false,
        int dias = 0) => new(
            Aerolinea: aerolinea,
            Salida: new TimeOnly(salidaHora, salidaMinuto),
            Llegada: new TimeOnly(llegadaHora, llegadaMinuto),
            DiasLlegada: dias,
            Precio: precio,
            Moneda: "MXN",
            DuracionMin: 94,
            Escalas: "Directo",
            Patrocinado: patrocinado,
            UrlCompra: null,
            Texto: $"{aerolinea} {salidaHora}:{salidaMinuto}");

    [Fact]
    public void ElegirMasBaratoATiempo_DescartaElVueloQueLlegaTarde()
    {
        var opciones = new[]
        {
            // Llega 18:04 + 36 min de taxi = 18:40 > 16:14.
            Vuelo("Aeromexico", 16, 30, 18, 4, 5664m),
            // Llega 09:34 + 36 = 10:10, a tiempo.
            Vuelo("Aeromexico", 8, 0, 9, 34, 4974m),
            // A tiempo pero más caro.
            Vuelo("Volaris", 10, 0, 11, 30, 5200m),
        };

        var elegido = DeteccionPrecioVueloService.ElegirMasBaratoATiempo(
            opciones,
            new DateOnly(2026, 11, 20),
            new DateTime(2026, 11, 20, 16, 14, 0),
            minutosTaxi: 36);

        elegido.Should().NotBeNull();
        elegido!.Precio.Should().Be(4974m);
        elegido.Aerolinea.Should().Be("Aeromexico");
    }

    [Fact]
    public void ElegirMasBaratoATiempo_PrefiereNoPatrocinadoAunqueSeaMasCaro()
    {
        var opciones = new[]
        {
            Vuelo("Aeromexico", 8, 0, 9, 34, 4000m, patrocinado: true),
            Vuelo("Aeromexico", 8, 0, 9, 34, 4974m),
        };

        var elegido = DeteccionPrecioVueloService.ElegirMasBaratoATiempo(
            opciones,
            new DateOnly(2026, 11, 20),
            new DateTime(2026, 11, 20, 16, 14, 0),
            minutosTaxi: 0);

        elegido!.Precio.Should().Be(4974m);
        elegido.Patrocinado.Should().BeFalse();
    }

    [Fact]
    public void ElegirMasBaratoATiempo_SinVueloATiempo_DevuelveNull()
    {
        var opciones = new[]
        {
            Vuelo("Aeromexico", 16, 30, 18, 4, 5664m),
            Vuelo("Volaris", 17, 0, 18, 30, 4800m),
        };

        var elegido = DeteccionPrecioVueloService.ElegirMasBaratoATiempo(
            opciones,
            new DateOnly(2026, 11, 20),
            new DateTime(2026, 11, 20, 16, 14, 0),
            minutosTaxi: 36);

        elegido.Should().BeNull();
    }

    [Fact]
    public void ElegirMasBaratoATiempo_SinDeadline_EligeElMasBarato()
    {
        var opciones = new[]
        {
            Vuelo("Aeromexico", 16, 30, 18, 4, 5664m),
            Vuelo("Volaris", 10, 0, 11, 30, 4800m),
        };

        var elegido = DeteccionPrecioVueloService.ElegirMasBaratoATiempo(
            opciones,
            new DateOnly(2026, 11, 20),
            deadline: null,
            minutosTaxi: 0);

        elegido!.Precio.Should().Be(4800m);
    }
}
