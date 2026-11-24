using FluentAssertions;
using Lefarma.API.Features.Viaticos;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// Google Hotels responde 500 a la búsqueda de un hotel concreto; el listado
/// de la ciudad sí funciona. La reescritura conserva fechas y moneda.
/// </summary>
public class UrlsHotelesTests
{
    [Fact]
    public void ParaListado_ReescribeHotelConcretoAListadoDeCiudad()
    {
        const string url = "https://www.google.com/travel/search?q=Hotel%20Gladys%2C%20La%20Huerta%2C%20Jalisco&checkin=2026-12-10&checkout=2026-12-11&hl=es-MX&curr=MXN";

        var reescrita = UrlsHoteles.ParaListado(url);

        reescrita.Should().Contain("q=hoteles%20en%20La%20Huerta%2C%20Jalisco");
        reescrita.Should().Contain("checkin=2026-12-10");
        reescrita.Should().Contain("checkout=2026-12-11");
        reescrita.Should().Contain("curr=MXN");
    }

    [Fact]
    public void ParaListado_DejaIntactaUnaBusquedaQueYaEsDeCiudad()
    {
        const string url = "https://www.google.com/travel/search?q=hoteles%20en%20La%20Huerta%2C%20Jalisco&checkin=2026-12-10";

        UrlsHoteles.ParaListado(url).Should().Be(url);
    }

    [Fact]
    public void ParaListado_SinComaNoInventaCiudad()
    {
        const string url = "https://www.google.com/travel/search?q=Hotel%20Gladys&checkin=2026-12-10";

        UrlsHoteles.ParaListado(url).Should().Be(url);
    }
}
