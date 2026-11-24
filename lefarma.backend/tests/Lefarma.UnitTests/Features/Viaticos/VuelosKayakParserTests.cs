using FluentAssertions;
using Lefarma.API.Features.Viaticos;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// El parser de Kayak debe reconocer las tarjetas reales (Playwright y
/// markdown de Firecrawl), descartar el autobús y separar el anuncio del
/// resultado seleccionable. Los textos son recortes de una consulta real.
/// </summary>
public class VuelosKayakParserTests
{
    private const string KayakMexZlo = """
        50% completado.
        Comparando webs de vuelos...
        Listo
        2 resultados
        Ordenar por: El mejor

        16:30 - 18:04
        MEX Aeropuerto Internacional de la Ciudad de México - ZLO Manzanillo
        directo
        1 h 34 min
        Aeromexico
        Anuncio
        $5,683
        Incluye TUA
        Classic
        Ver oferta

        Descubre los destinos con los que siempre has soñado
        Navega por el mundo con Norwegian
        Ver oferta

        16:30 - 18:04
        MEX Aeropuerto Internacional de la Ciudad de México - ZLO Manzanillo
        directo
        1 h 34 min
        Aeromexico
        ${Price} con meses sin intereses
        $5,664
        Incluye TUA
        Classic
        [Seleccionar](https://www.kayak.com.mx/book/flight?code=abc)

        20:30 - 7:40+1
        MEX Central de Autobuses - ZLO Central de Autobuses
        0 cambios
        10 h 40 min
        PrimeraPlus
        $1,818
        Incluye TUA
        [Seleccionar](https://www.kayak.com.mx/book/bus?code=xyz)
        """;

    [Fact]
    public void Parsear_KayakReal_DevuelveDosVuelosYDescartaElAutobus()
    {
        var resultado = VuelosKayakParser.Parsear(KayakMexZlo);

        resultado.Ok.Should().BeTrue();
        resultado.Opciones.Should().HaveCount(2);
        resultado.Opciones.Should().OnlyContain(o => o.Aerolinea == "Aeromexico");
        resultado.Opciones.Should().OnlyContain(o => o.Escalas == "Directo");
        resultado.Opciones.Should().OnlyContain(o => o.DuracionMin == 94);

        var seleccionable = resultado.Opciones.Single(o => !o.Patrocinado);
        seleccionable.Precio.Should().Be(5664m);
        seleccionable.Salida.Should().Be(new TimeOnly(16, 30));
        seleccionable.Llegada.Should().Be(new TimeOnly(18, 4));
        seleccionable.UrlCompra.Should().Be("https://www.kayak.com.mx/book/flight?code=abc");

        var anuncio = resultado.Opciones.Single(o => o.Patrocinado);
        anuncio.Precio.Should().Be(5683m);
        anuncio.UrlCompra.Should().BeNull();
    }

    [Fact]
    public void Parsear_TarjetasRealesDePlaywright_DevuelveDosVuelos()
    {
        // Salida real de detectar-vuelos.mjs: tarjetas de una sola línea,
        // incluido el bloque de Norwegian y el autobús de PrimeraPlus.
        const string tarjetas = """
            Ir al siguiente resultado Ir a la sección de precios Ir a los detalles del resultado Reserva hoy tu vuelo a Manzanillo y paga a meses sin intereses Vuelos directos con la aerolínea más puntual del mundo 16:30 – 18:04 MEXAeropuerto Internacional de la Ciudad de México - ZLOManzanillo directo 1 h 34 min Aeromexico Anuncio $5,683 Incluye TUA Classic Aeromexico Ver oferta
            Descubre los destinos con los que siempre has soñado Navega por el mundo con Norwegian y disfruta de la libertad de viajar a tu manera Vive emociones en playas tropicales Déjate encantar por destinos únicos Explora la naturaleza de Alaska NCL | Anuncio Ver oferta
            Ir al siguiente resultado Ir al resultado anterior Ir a la sección de precios Ir a los detalles del resultado Comparar 16:30 – 18:04 MEXAeropuerto Internacional de la Ciudad de México - ZLOManzanillo directo 1 h 34 min Aeromexico ${Price} con meses sin intereses $5,664 Incluye TUA Light Seleccionar
            Ir al resultado anterior Ir a la sección de precios Ir a los detalles del resultado ¿Te interesan los precios en autobús? Consigue mejores precios en las ofertas de autobús. Ver más Comparar Boleto de autobús 20:30 – 7:10+1 MEXCentral de Autobuses del Norte - ZLOcentral bus station 0 cambios 10 h 40 min PrimeraPlus $1,818 Incluye TUA Seleccionar
            """;

        var resultado = VuelosKayakParser.Parsear(tarjetas);

        resultado.Ok.Should().BeTrue();
        resultado.Opciones.Should().HaveCount(2);
        resultado.Opciones.Should().OnlyContain(o => o.Aerolinea == "Aeromexico");
        resultado.Opciones.Should().Contain(o => o.Precio == 5664m && !o.Patrocinado);
        resultado.Opciones.Should().Contain(o => o.Precio == 5683m && o.Patrocinado);
        resultado.Opciones.Should().NotContain(o => o.Precio == 1818m);
    }

    [Fact]
    public void Parsear_Captcha_LoDeclaraBloqueado()
    {
        var resultado = VuelosKayakParser.Parsear(
            "Verificación de seguridad: Confirma que eres un usuario de KAYAK. No soy un robot");

        resultado.Ok.Should().BeFalse();
        resultado.Bloqueado.Should().BeTrue();
        resultado.Error.Should().Contain("verificación");
    }

    [Fact]
    public void Parsear_TextoSinVuelos_DevuelveError()
    {
        var resultado = VuelosKayakParser.Parsear("No se encontraron resultados para la búsqueda.");

        resultado.Ok.Should().BeFalse();
        resultado.Opciones.Should().BeEmpty();
        resultado.Error.Should().Contain("no se reconocieron vuelos");
    }
}
