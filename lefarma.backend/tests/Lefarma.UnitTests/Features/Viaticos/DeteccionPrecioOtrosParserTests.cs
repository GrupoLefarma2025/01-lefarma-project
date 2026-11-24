using FluentAssertions;
using Lefarma.API.Features.Viaticos;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// Parsers de la detección automática para autobús (ClickBus/Primera Plus) y
/// hotel (Google Hotels). Los textos imitan las tarjetas reales que devuelve
/// Playwright; un dato sin precio o sin nombre no se inventa.
/// </summary>
public class DeteccionPrecioOtrosParserTests
{
    private static readonly DateOnly Fecha = new(2026, 11, 20);

    [Fact]
    public void AutobusesParser_ClickBus_ExtraeLineaHorarioYPrecio()
    {
        const string tarjeta =
            "ETN 08:00 hrs. CDMX - Guadalajara Tipo: Local 5h 30m 13:30 hrs. Directo $850 Seleccionar 12 Asientos disponibles";

        var opciones = AutobusesParser.Parsear(
            new[] { tarjeta }, "Primera Plus", Fecha, deadline: null, minutosTaxi: 0);

        opciones.Should().HaveCount(1);
        var opcion = opciones[0];
        opcion.Tipo.Should().Be("autobus");
        opcion.Linea.Should().Be("ETN 08:00–13:30");
        opcion.Precio.Should().Be(850m);
        opcion.Salida.Should().Be(new TimeOnly(8, 0));
        opcion.Llegada.Should().Be(new TimeOnly(13, 30));
        opcion.Asientos.Should().Be(12);
        opcion.Fuente.Should().Be("clickbus.com.mx");
    }

    [Fact]
    public void AutobusesParser_SinLlegarATiempo_DescartaLaCorrida()
    {
        const string tarjeta =
            "ETN 08:00 hrs. CDMX - Guadalajara Tipo: Local 5h 30m 13:30 hrs. Directo $850 Seleccionar 12 Asientos disponibles";

        var aTiempo = AutobusesParser.Parsear(
            new[] { tarjeta }, "ETN", Fecha, new DateTime(2026, 11, 20, 14, 0, 0), minutosTaxi: 30);
        var tarde = AutobusesParser.Parsear(
            new[] { tarjeta }, "ETN", Fecha, new DateTime(2026, 11, 20, 13, 59, 0), minutosTaxi: 30);

        aTiempo.Should().ContainSingle();
        tarde.Should().BeEmpty("la llegada 13:30 + 30 min de taxi pasa de las 13:59");
    }

    [Fact]
    public void AutobusesParser_TarjetaGenerica_DetectaPrimeraPlusYPrecio()
    {
        const string tarjeta = "Primera Plus 08:00 – 13:30 Directo $850 MXN";

        var opciones = AutobusesParser.Parsear(
            new[] { tarjeta }, "cualquiera", Fecha, deadline: null, minutosTaxi: 0);

        opciones.Should().ContainSingle();
        opciones[0].Linea.Should().Be("Primera Plus 08:00–13:30");
        opciones[0].Precio.Should().Be(850m);
    }

    [Fact]
    public void AutobusesParser_TarjetaRealDeClickBus_ExtraePrecioConDecimales()
    {
        const string tarjeta =
            "Futura Select 00:30 hrs. Terminal del Sur (Taxqueña), CDMX Tipo: Paso 7h 0m 07:30 hrs. Central de autobuses, Guadalajara, JAL $1,426.00 Seleccionar 36 Asientos disponibles Servicios";

        var opciones = AutobusesParser.Parsear(
            new[] { tarjeta }, "Autobús (estimado)", Fecha, deadline: null, minutosTaxi: 0);

        opciones.Should().ContainSingle();
        opciones[0].Linea.Should().Be("Futura Select 00:30–07:30");
        opciones[0].Precio.Should().Be(1426m);
        opciones[0].Asientos.Should().Be(36);
    }

    [Fact]
    public void AutobusesParser_MarkdownDeFirecrawl_ReconstruyeLaTarjeta()
    {
        const string markdown = """
            Futura Select

            #### 00:30 hrs.

            ###### Terminal del Sur (Taxqueña), CDMX

            Tipo: Paso

            7h 0m

            #### 07:30 hrs.

            ###### Central de autobuses, Guadalajara, JAL

            $1,426.00

            Seleccionar

            36 Asientos disponibles
            """;

        var opciones = AutobusesParser.ParsearMarkdown(
            markdown, "Autobús (estimado)", Fecha, deadline: null, minutosTaxi: 0);

        opciones.Should().ContainSingle();
        opciones[0].Linea.Should().Be("Futura Select 00:30–07:30");
        opciones[0].Precio.Should().Be(1426m);
        opciones[0].Asientos.Should().Be(36);
    }

    [Fact]
    public void HotelesParser_HotelConcreto_MultiplicaPrecioPorNoche()
    {
        const string tarjeta = "Hotel Camino Real MXN 2,500 por noche";

        var opciones = HotelesParser.Parsear(
            new[] { tarjeta }, "Hotel Camino Real (2026-11-20 al 2026-11-22)", noches: 2);

        opciones.Should().ContainSingle();
        opciones[0].Tipo.Should().Be("hotel");
        opciones[0].Precio.Should().Be(5000m);
        opciones[0].Noches.Should().Be(2);
        opciones[0].Fuente.Should().Be("google.com/travel");
    }

    [Fact]
    public void HotelesParser_TotalPublicado_NoMultiplicaLasNoches()
    {
        const string tarjeta = "Hotel Camino Real MXN 5,000 total estancia";

        var opciones = HotelesParser.Parsear(
            new[] { tarjeta }, "Hotel Camino Real (2026-11-20 al 2026-11-22)", noches: 2);

        opciones.Should().ContainSingle();
        opciones[0].Precio.Should().Be(5000m);
    }

    [Fact]
    public void HotelesParser_OtroHotel_NoSeAplica()
    {
        const string tarjeta = "Hotel Fiesta Inn MXN 3,000 por noche";

        var opciones = HotelesParser.Parsear(
            new[] { tarjeta }, "Hotel Camino Real (2026-11-20 al 2026-11-22)", noches: 2);

        opciones.Should().BeEmpty();
    }

    [Fact]
    public void HotelesParser_TarjetaRealDeGoogleHotels_ExtraeElPrecioPublicado()
    {
        const string tarjeta =
            "Hotel Gladys MXN 810 4.2 (339) Servicios que ofrece Hotel Gladys, un hotel de 3 estrellas.: Wi-Fi gratuito, Estacionamiento gratuito, Aire acondicionado, Se permiten mascotas, Accesible Ver precios";

        var opciones = HotelesParser.Parsear(
            new[] { tarjeta }, "Hotel Gladys (2026-12-10 al 2026-12-11)", noches: 1);

        opciones.Should().ContainSingle();
        opciones[0].Precio.Should().Be(810m);
        opciones[0].Linea.Should().Be("Hotel Gladys (2026-12-10 al 2026-12-11)");
    }

    [Fact]
    public void HotelesParser_MarkdownDeFirecrawl_EmparejaNombreYPrecioEnLineasSeparadas()
    {
        const string markdown = """
            Vayor Hotel & Suites

            MXN 1,231

            Booking.com

            Hotel Gladys

            MXN 1,138

            Expedia.mx
            """;

        var opciones = HotelesParser.ParsearMarkdown(
            markdown, "Hotel Gladys (2026-12-10 al 2026-12-11)", noches: 1);

        opciones.Should().ContainSingle();
        opciones[0].Precio.Should().Be(1138m);
        opciones[0].Fuente.Should().Be("google.com/travel");
    }

    [Fact]
    public void HotelesParser_MarkdownConNombreYPrecioEnLaMismaLinea()
    {
        const string markdown = "Hotel Colonial · $1,500 por noche";

        var opciones = HotelesParser.ParsearMarkdown(
            markdown, "Hotel Colonial (2026-12-01 al 2026-12-02)", noches: 1);

        opciones.Should().ContainSingle();
        opciones[0].Precio.Should().Be(1500m);
    }
}
