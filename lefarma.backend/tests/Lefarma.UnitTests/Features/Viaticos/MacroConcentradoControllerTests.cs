using System.Security.Claims;
using System.Text;
using FluentAssertions;
using Lefarma.API.Features.Viaticos;
using Lefarma.API.Features.Viaticos.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Lefarma.UnitTests.Features.Viaticos;

public class MacroConcentradoControllerTests
{
    [Fact]
    public async Task Enviar_GuardaElPdfEnAppDocumentos()
    {
        var asokamOptions = new DbContextOptionsBuilder<AsokamDbContext>()
            .UseInMemoryDatabase($"asokam-{Guid.NewGuid()}")
            .Options;
        var lefarmaOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"lefarma-{Guid.NewGuid()}")
            .Options;

        await using var asokam = new AsokamDbContext(asokamOptions);
        await using var lefarma = new ApplicationDbContext(lefarmaOptions);

        var controller = new MacroConcentradoController(
            lefarma,
            asokam,
            NullLogger<MacroConcentradoController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        new[]
                        {
                            new Claim("permission", "ordenes.envio_concentrado"),
                            new Claim(ClaimTypes.NameIdentifier, "70")
                        },
                        "test"))
                }
            }
        };

        var bytes = Encoding.UTF8.GetBytes("%PDF-1.4 concentrado de prueba");
        var archivo = new FormFile(
            new MemoryStream(bytes),
            0,
            bytes.Length,
            "archivo",
            "concentrado.pdf")
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/pdf"
        };

        var request = new MacroConcentradoEnvioRequest
        {
            Folios = new List<string> { "OC-2026-00336", "OC-2026-00335" },
            Nombre = "concentrado-viaticos-prueba",
            Gerencia = "EDUCACION MEDICA",
            Fecha = "jun-26",
            Comentario = "Prueba de envío",
            Usuario = "41@Grupolefarma",
            Correo = "41@grupolefarma.com.mx",
            Archivo = archivo
        };

        var result = await controller.Enviar(request, CancellationToken.None);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var respuesta = ok.Value.Should().BeOfType<ApiResponse<MacroConcentradoEnvioResponse>>().Subject;
        respuesta.Success.Should().BeTrue();
        respuesta.Data.Should().NotBeNull();
        respuesta.Data!.TotalFolios.Should().Be(2);
        respuesta.Data.IdDocumento.Should().NotBe(Guid.Empty);

        var documento = await asokam.Documentos.SingleAsync();
        documento.NombreArchivo.Should().Be("concentrado-viaticos-prueba.pdf");
        documento.PDFBinario.Should().Equal(bytes);
        documento.Estatus.Should().Be(1);
        documento.SubidoPorUsuario.Should().Be("41@Grupolefarma");
        documento.MetadataJSON.Should().Contain("concentrado_viaticos");
        documento.EnviadoParaAutorizacion.Should().BeFalse();
    }
}
