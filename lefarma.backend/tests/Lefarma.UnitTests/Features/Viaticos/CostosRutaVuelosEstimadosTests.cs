using FluentAssertions;
using Lefarma.API.Features.Viaticos;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// El estimado de vuelo ya no es un precio único y bajo: devuelve un rango
/// calibrado para rutas domésticas. La lista real de Kayak lo sustituye en la
/// UI; este rango es solo el respaldo cuando la consulta falla.
/// </summary>
public class CostosRutaVuelosEstimadosTests
{
    [Fact]
    public async Task VuelosEstimados_DevuelvenUnRangoCalibrado()
    {
        var vuelos = await CalculoCostosRuta.BuscarVuelosEstimadosAsync(
            700, "MEX", "MTY", new DateOnly(2026, 11, 23), CancellationToken.None);

        vuelos.Should().HaveCount(2);
        vuelos.Should().OnlyContain(v => v.PrecioHasta > v.PrecioDesde);
        vuelos.Should().OnlyContain(v => v.PrecioDesde >= 3000);
        vuelos.Should().OnlyContain(v => v.Url.Contains("kayak.com.mx/flights/MEX-MTY/2026-11-23"));
    }
}
