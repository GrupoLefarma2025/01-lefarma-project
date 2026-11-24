using FluentAssertions;
using Lefarma.API.Features.Sigma.Config;
using Lefarma.API.Features.Sigma.Services.PdfSignature;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;

namespace Lefarma.UnitTests.Features.Sigma.PdfSignature;

public sealed class CSharpPdfSignatureEngineTests : IDisposable
{
    private readonly string _carpeta = Path.Combine(
        Path.GetTempPath(),
        "lefarma-firma-" + Guid.NewGuid().ToString("N"));

    private readonly AlmacenFalso _almacen = new();

    public CSharpPdfSignatureEngineTests()
    {
        Directory.CreateDirectory(_carpeta);
        PdfDePrueba.EscribirFirma(Path.Combine(_carpeta, "firma.png"));
    }

    public void Dispose()
    {
        try
        {
            Directory.Delete(_carpeta, recursive: true);
        }
        catch (IOException)
        {
        }
    }

    [Fact]
    public async Task Firma_ConMarcador_GuardaUnPdfCifradoYSinTextoExtraible()
    {
        var id = Guid.NewGuid();
        _almacen.Pdf = PdfDePrueba.Crear("#firmad");
        _almacen.Fecha = new DateTime(2026, 11, 20, 10, 30, 0);

        var resultado = await CrearMotor().EjecutarAsync(id, soloEscanear: false);

        resultado.PalabraClaveAusente.Should().BeFalse();
        resultado.Salida.Should().Be("Proceso completado exitosamente.");
        _almacen.Autorizado.Should().NotBeNull();
        _almacen.Copias.Should().Equal(string.Empty, "_autorizado");

        var autorizado = _almacen.Autorizado!;
        System.Text.Encoding.ASCII.GetString(autorizado).Should().Contain("/Encrypt");

        using var abierto = PdfReader.Open(new MemoryStream(autorizado), PdfDocumentOpenMode.Import);
        abierto.PageCount.Should().Be(1);

        using var pig = UglyToad.PdfPig.PdfDocument.Open(autorizado);
        pig.GetPage(1).Text.Should().BeEmpty();
    }

    [Fact]
    public async Task Firma_SinMarcador_DesactivaElDocumentoYNoGuardaBinario()
    {
        var id = Guid.NewGuid();
        _almacen.Pdf = PdfDePrueba.Crear();

        var resultado = await CrearMotor().EjecutarAsync(id, soloEscanear: false);

        resultado.PalabraClaveAusente.Should().BeTrue();
        resultado.Salida.Should().Be("ERROR_KEYWORD_NOT_FOUND");
        _almacen.Desactivado.Should().BeTrue();
        _almacen.Autorizado.Should().BeNull();
        _almacen.Copias.Should().Equal(string.Empty);
    }

    [Fact]
    public async Task Escaneo_SinMarcador_EliminaElDocumento()
    {
        _almacen.Pdf = PdfDePrueba.Crear();

        var resultado = await CrearMotor().EjecutarAsync(Guid.NewGuid(), soloEscanear: true);

        resultado.PalabraClaveAusente.Should().BeTrue();
        _almacen.Eliminado.Should().BeTrue();
        _almacen.Desactivado.Should().BeFalse();
        _almacen.Autorizado.Should().BeNull();
    }

    [Fact]
    public async Task Escaneo_ConMarcador_NoModificaNada()
    {
        _almacen.Pdf = PdfDePrueba.Crear("#firmad");

        var resultado = await CrearMotor().EjecutarAsync(Guid.NewGuid(), soloEscanear: true);

        resultado.PalabraClaveAusente.Should().BeFalse();
        resultado.Salida.Should().Be("KEYWORD_FOUND");
        _almacen.Autorizado.Should().BeNull();
        _almacen.Desactivado.Should().BeFalse();
        _almacen.Eliminado.Should().BeFalse();
    }

    [Fact]
    public async Task Firma_SinDocumento_LanzaInvalidOperationException()
    {
        var motor = CrearMotor();

        var accion = () => motor.EjecutarAsync(Guid.NewGuid(), soloEscanear: false);

        await accion.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*no se encontró*");
    }

    [Fact]
    public async Task Firma_ConLaImagenSoloEnElEnsamblado_LaExtraeYEstampaElDocumento()
    {
        var raiz = Path.Combine(
            Path.GetTempPath(),
            "lefarma-firma-embebida-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(raiz);

        try
        {
            var id = Guid.NewGuid();
            _almacen.Pdf = PdfDePrueba.Crear("#firmad");

            var resultado = await CrearMotor(raiz, "scripts/assets/firma.png")
                .EjecutarAsync(id, soloEscanear: false);

            resultado.Salida.Should().Be(PdfSignatureMessages.Exito);
            _almacen.Autorizado.Should().NotBeNull();
            File.Exists(Path.Combine(raiz, "App_Data", "recursos", "firma.png")).Should().BeTrue();
        }
        finally
        {
            try
            {
                Directory.Delete(raiz, recursive: true);
            }
            catch (IOException)
            {
            }
        }
    }

    private CSharpPdfSignatureEngine CrearMotor(string? raiz = null, string imagen = "firma.png")
    {
        var entorno = new Mock<IHostEnvironment>();
        entorno.SetupGet(e => e.ContentRootPath).Returns(raiz ?? _carpeta);

        var opciones = Options.Create(new SigmaPdfSignatureOptions
        {
            ImagePath = imagen,
            SearchText = "#firmad"
        });

        return new CSharpPdfSignatureEngine(
            _almacen,
            new RasterStampRenderer(NullLogger<RasterStampRenderer>.Instance),
            new VectorStampRenderer(NullLogger<VectorStampRenderer>.Instance),
            opciones,
            entorno.Object,
            NullLogger<CSharpPdfSignatureEngine>.Instance);
    }

    private sealed class AlmacenFalso : IPdfDocumentStore
    {
        public byte[]? Pdf { get; set; }

        public DateTime? Fecha { get; set; }

        public List<string> Copias { get; } = new();

        public byte[]? Autorizado { get; private set; }

        public bool Desactivado { get; private set; }

        public bool Eliminado { get; private set; }

        public Task<DocumentoFirma?> ObtenerAsync(Guid idDocumento, CancellationToken ct) =>
            Task.FromResult(Pdf is null ? null : new DocumentoFirma(Pdf, Fecha));

        public Task GuardarCopiaAsync(Guid idDocumento, string sufijo, byte[] contenido, CancellationToken ct)
        {
            Copias.Add(sufijo);
            return Task.CompletedTask;
        }

        public Task GuardarAutorizadoAsync(Guid idDocumento, byte[] pdfAutorizado, CancellationToken ct)
        {
            Autorizado = pdfAutorizado;
            return Task.CompletedTask;
        }

        public Task DesactivarAsync(Guid idDocumento, CancellationToken ct)
        {
            Desactivado = true;
            return Task.CompletedTask;
        }

        public Task EliminarAsync(Guid idDocumento, CancellationToken ct)
        {
            Eliminado = true;
            return Task.CompletedTask;
        }
    }
}
