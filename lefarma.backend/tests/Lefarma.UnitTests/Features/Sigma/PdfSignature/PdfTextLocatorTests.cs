using FluentAssertions;
using Lefarma.API.Features.Sigma.Services.PdfSignature;

namespace Lefarma.UnitTests.Features.Sigma.PdfSignature;

/// <summary>
/// El localizador debe encontrar el marcador donde lo dibujó PDFsharp, sin distinguir
/// mayúsculas y devolviendo la página correcta.
/// </summary>
public sealed class PdfTextLocatorTests
{
    [Fact]
    public void Buscar_EncuentraElMarcadorEnLaPrimeraPagina()
    {
        var pdf = PdfDePrueba.Crear("#firmad");

        var coincidencias = PdfTextLocator.Buscar(pdf, "#firmad");

        coincidencias.Should().HaveCount(1);
        coincidencias[0].Pagina.Should().Be(1);
        coincidencias[0].Caja.Ancho.Should().BeGreaterThan(0);
        coincidencias[0].Caja.Alto.Should().BeGreaterThan(0);
        coincidencias[0].Caja.X0.Should().BeInRange(45, 55);
    }

    [Fact]
    public void Buscar_EncuentraVariasAparicionesEnLaMismaPagina()
    {
        var pdf = PdfDePrueba.CrearConDosApariciones("#firmad");

        var coincidencias = PdfTextLocator.Buscar(pdf, "#firmad");

        coincidencias.Should().HaveCount(2);
        coincidencias.Should().OnlyContain(c => c.Pagina == 1);
        coincidencias.Select(c => c.Caja.X0).Distinct().Should().HaveCount(2);
    }

    [Fact]
    public void Buscar_NoDistingueMayusculas()
    {
        var pdf = PdfDePrueba.Crear("#FIRMAD");

        PdfTextLocator.Buscar(pdf, "#firmad").Should().ContainSingle();
    }

    [Fact]
    public void Buscar_DevuelveLaPaginaDondeEstaElTexto()
    {
        var pdf = PdfDePrueba.CrearConTextoEnSegundaPagina("#firmad");

        var coincidencias = PdfTextLocator.Buscar(pdf, "#firmad");

        coincidencias.Should().ContainSingle();
        coincidencias[0].Pagina.Should().Be(2);
    }

    [Fact]
    public void Buscar_ConFuenteEstandar_MideComoMuPdf()
    {
        // Helvetica 10 pt con la línea base en 200 - 100 = 100: MuPDF lleva la caja
        // hasta 100 + 1,075 * 10 = 110,75; la caja del glifo sola llegaría a 107,18.
        var pdf = PdfDePrueba.CrearBase14("#firmad", x: 50, yArriba: 100, tamano: 10);

        var coincidencias = PdfTextLocator.Buscar(pdf, "#firmad");

        coincidencias.Should().ContainSingle();
        coincidencias[0].Caja.Y1.Should().BeApproximately(110.75, 0.2);
        coincidencias[0].Caja.Y1.Should().BeGreaterThan(107.5);
    }

    [Fact]
    public void Buscar_SinTextoDevuelveVacio()
    {
        var pdf = PdfDePrueba.Crear();

        PdfTextLocator.Buscar(pdf, "#firmad").Should().BeEmpty();
        PdfTextLocator.BuscarEnPrimeraPagina(pdf, "#firmad").Should().BeEmpty();
    }

    [Fact]
    public void Buscar_TextoVacioDevuelveVacio()
    {
        var pdf = PdfDePrueba.Crear("#firmad");

        PdfTextLocator.Buscar(pdf, string.Empty).Should().BeEmpty();
    }

    [Fact]
    public void BuscarEnPrimeraPagina_SeDetieneEnLaPrimeraPaginaConCoincidencia()
    {
        var pdf = PdfDePrueba.CrearConTextoEnSegundaPagina("#firmad");

        var coincidencias = PdfTextLocator.BuscarEnPrimeraPagina(pdf, "#firmad");

        coincidencias.Should().ContainSingle();
        coincidencias[0].Pagina.Should().Be(2);
    }
}
