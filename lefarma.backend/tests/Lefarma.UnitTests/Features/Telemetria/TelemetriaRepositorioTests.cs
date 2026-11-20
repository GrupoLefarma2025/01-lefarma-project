using FluentAssertions;
using Lefarma.API.Features.Telemetria.Almacen;

namespace Lefarma.UnitTests.Features.Telemetria;

public sealed class TelemetriaRepositorioTests
{
    [Fact]
    public void ABytesYAAEnteros_IdaYVuelta_ConservaLaRejilla()
    {
        int[] celdas = [0, 1, 2, 300, 0, 65_535];

        var bytes = TelemetriaRepositorio.AABytes(celdas);
        var recuperadas = TelemetriaRepositorio.AEnteros(bytes);

        bytes.Should().HaveCount(celdas.Length * sizeof(int));
        recuperadas.Should().Equal(celdas);
    }

    [Fact]
    public void ABytes_EscribeEnLittleEndian()
    {
        var bytes = TelemetriaRepositorio.AABytes([1]);

        // 1 en int32 little-endian: 01 00 00 00
        bytes.Should().Equal(1, 0, 0, 0);
    }

    [Fact]
    public void AEnteros_ConArregloVacio_DevuelveVacio()
    {
        TelemetriaRepositorio.AEnteros([]).Should().BeEmpty();
    }
}
