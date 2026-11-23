using FluentAssertions;
using Lefarma.API.Features.Sigma.Services.PdfSignature;

namespace Lefarma.UnitTests.Features.Sigma.PdfSignature;

public sealed class StampGeometryTests
{
    private static readonly PdfSignatureSettings Ajustes = new();

    [Fact]
    public void Calcular_ColocaLaFirmaCentradaYDosPuntosDebajoDelTexto()
    {
        var cajaTexto = new CajaDibujo(100, 500, 160, 520);

        var estampa = StampGeometry.Calcular(cajaTexto, Ajustes, cantidadLineas: 2);

        estampa.CajaFirma.X0.Should().Be(55);
        estampa.CajaFirma.Y0.Should().Be(485);
        estampa.CajaFirma.X1.Should().Be(205);
        estampa.CajaFirma.Y1.Should().Be(535);
        estampa.LineasBase.Should().Equal(537, 547);
    }

    [Fact]
    public void Calcular_ConDesplazamientoConfigurado_MueveLaFirma()
    {
        var ajustes = new PdfSignatureSettings
        {
            DesplazamientoX = 10,
            DesplazamientoY = -5,
            AnchoFirma = 100,
            AltoFirma = 40
        };
        var cajaTexto = new CajaDibujo(0, 100, 20, 110);

        var estampa = StampGeometry.Calcular(cajaTexto, ajustes, cantidadLineas: 0);

        estampa.CajaFirma.Should().Be(new CajaDibujo(-30, 95, 70, 135));
        estampa.LineasBase.Should().BeEmpty();
    }

    [Fact]
    public void AjustarImagen_ConservaProporcionYCentra()
    {
        var destino = new CajaDibujo(0, 0, 150, 50);

        var ajustada = StampGeometry.AjustarImagen(100, 50, destino);

        ajustada.Should().Be(new CajaDibujo(25, 0, 125, 50));
    }

    [Fact]
    public void AjustarImagen_ConImagenVertical_DejaFranjasALosLados()
    {
        var destino = new CajaDibujo(10, 20, 160, 70);

        var ajustada = StampGeometry.AjustarImagen(50, 100, destino);

        ajustada.Ancho.Should().Be(25);
        ajustada.Alto.Should().Be(50);
        ajustada.X0.Should().Be(72.5);
        ajustada.Y0.Should().Be(20);
    }

    [Theory]
    [InlineData(0, 300, 200)]
    [InlineData(90, 200, 300)]
    [InlineData(180, 300, 200)]
    [InlineData(270, 200, 300)]
    public void DimensionesVisuales_IntercambiaAnchoYAltoAlRotar(int rotacion, double anchoEsperado, double altoEsperado)
    {
        var (ancho, alto) = StampGeometry.DimensionesVisuales(300, 200, rotacion);

        ancho.Should().Be(anchoEsperado);
        alto.Should().Be(altoEsperado);
    }

    [Theory]
    [InlineData(0, 10, 160, 30, 180)]
    [InlineData(90, 20, 10, 40, 30)]
    [InlineData(180, 270, 20, 290, 40)]
    [InlineData(270, 160, 270, 180, 290)]
    public void ContenidoAVisual_RotaLaCajaComoLoHaceElScript(
        int rotacion,
        double x0Esperado,
        double y0Esperado,
        double x1Esperado,
        double y1Esperado)
    {
        var caja = new CajaContenido(10, 20, 30, 40);

        var visual = StampGeometry.ContenidoAVisual(caja, anchoContenido: 300, altoContenido: 200, rotacion);

        visual.Should().Be(new CajaDibujo(x0Esperado, y0Esperado, x1Esperado, y1Esperado));
    }

    [Fact]
    public void ContenidoADibujo_InvierteElEjeVertical()
    {
        var caja = new CajaContenido(10, 20, 30, 40);

        var dibujo = StampGeometry.ContenidoADibujo(caja, altoContenido: 200);

        dibujo.Should().Be(new CajaDibujo(10, 160, 30, 180));
    }
}
