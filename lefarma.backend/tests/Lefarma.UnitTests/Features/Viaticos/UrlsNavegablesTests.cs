using FluentAssertions;
using Lefarma.API.Features.Viaticos;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// La detección abre URLs guardadas en la cotización, así que el guard de red
/// interna debe cubrir loopback, rangos privados y esquemas no HTTP. Es el
/// mismo guard que usa el endpoint bajo demanda y la cola automática.
/// </summary>
public class UrlsNavegablesTests
{
    [Theory]
    [InlineData("https://www.kayak.com.mx/flights/MEX-ZLO/2026-11-20", true)]
    [InlineData("https://www.google.com/travel/search?q=hoteles", true)]
    [InlineData("http://localhost:5174/api", false)]
    [InlineData("http://192.168.6.4:3002/v2/scrape", false)]
    [InlineData("http://10.0.0.10/", false)]
    [InlineData("http://172.16.5.4/", false)]
    [InlineData("http://169.254.169.254/latest/meta-data", false)]
    [InlineData("http://100.64.0.1/", false)]
    [InlineData("http://[::1]/", false)]
    [InlineData("ftp://example.com/file", false)]
    public void EsPermitida_ClasificaUrlsPublicasYPrivadas(string url, bool esperado)
    {
        UrlsNavegables.EsPermitida(new Uri(url)).Should().Be(esperado);
    }

    [Theory]
    [InlineData("booking.com", true)]
    [InlineData("www.booking.com", true)]
    [InlineData("expedia.com", true)]
    [InlineData("kayak.com.mx", false)]
    [InlineData("clickbus.com.mx", false)]
    public void CapturasService_EsDominioProhibido_UsaLaMismaListaQueLasCapturas(string host, bool esperado)
    {
        CapturasService.EsDominioProhibido(host).Should().Be(esperado);
    }
}
