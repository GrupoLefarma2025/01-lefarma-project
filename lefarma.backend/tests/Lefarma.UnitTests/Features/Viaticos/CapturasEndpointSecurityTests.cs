using System.Net;
using System.Security.Claims;
using System.Text.Encodings.Web;
using FluentAssertions;
using Lefarma.API.Features.Viaticos;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// Regresion de seguridad de T8: las capturas PNG de viaticos NO pueden ser
/// anonimas. Se levanta el Program.cs COMPLETO (WebApplicationFactory) para
/// ejercitar las registrations de archivos estaticos reales, el guard de
/// alias y el endpoint <c>[Authorize]</c>.
/// </summary>
public class CapturasEndpointSecurityTests : IClassFixture<CapturasEndpointSecurityTests.Factory>
{
    public const string NombreEsquema = "CapturasTest";

    private readonly Factory _factory;

    public CapturasEndpointSecurityTests(Factory factory)
    {
        _factory = factory;
        using var _ = _factory.CreateClient();
        _factory.AsegurarArchivos();
    }

    private HttpClient ClienteAutenticado()
    {
        var cliente = _factory.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "9001");
        return cliente;
    }

    [Fact]
    public async Task AliasEstatico_NoSirveElPngDeFormaAnonima()
    {
        using var cliente = _factory.CreateClient();

        foreach (var ruta in new[]
                 {
                     $"/api/media/capturas-viaticos/{Factory.PngNombre}",
                     $"/media/capturas-viaticos/{Factory.PngNombre}",
                 })
        {
            using var respuesta = await cliente.GetAsync(ruta);

            respuesta.StatusCode.Should().Be(HttpStatusCode.NotFound,
                "los alias estaticos de capturas quedaron cerrados: {0}", ruta);
            var bytes = await respuesta.Content.ReadAsByteArrayAsync();
            bytes.Should().NotEqual(Factory.Png);
        }
    }

    [Fact]
    public async Task Endpoint_SinToken_Retorna401()
    {
        using var cliente = _factory.CreateClient();

        using var respuesta = await cliente.GetAsync($"/api/viaticos/capturas/{Factory.PngNombre}");

        respuesta.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Endpoint_ConToken_RetornaElPng()
    {
        using var cliente = ClienteAutenticado();

        using var respuesta = await cliente.GetAsync($"/api/viaticos/capturas/{Factory.PngNombre}");

        respuesta.StatusCode.Should().Be(HttpStatusCode.OK);
        respuesta.Content.Headers.ContentType!.MediaType.Should().Be("image/png");
        (await respuesta.Content.ReadAsByteArrayAsync()).Should().Equal(Factory.Png);
    }

    [Fact]
    public async Task Endpoint_Traversal_NoLeeFueraDelDirectorioDeCapturas()
    {
        using var cliente = ClienteAutenticado();
        var secreto = _factory.SecretNombre!;

        // Intento HTTP: si el path llegara al endpoint con "..", el resolver lo
        // rechaza; si Kestrel lo normaliza antes, no hay ruta. En ningun caso
        // puede salir el contenido del archivo "secreto".
        using var respuesta = await cliente.GetAsync($"/api/viaticos/capturas/..%2F{secreto}");

        respuesta.StatusCode.Should().NotBe(HttpStatusCode.OK);
        (await respuesta.Content.ReadAsByteArrayAsync()).Should().NotEqual(Factory.Secreto);
    }

    [Fact]
    public void ObtenerCaptura_Traversal_Retorna400_YNoDevuelveArchivo()
    {
        var controller = CrearController();

        var resultado = controller.ObtenerCaptura("../" + _factory.SecretNombre);

        resultado.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public void ObtenerCaptura_ArchivoInexistente_Retorna404()
    {
        var controller = CrearController();

        var resultado = controller.ObtenerCaptura("no-existe.png");

        resultado.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public void ObtenerCaptura_ArchivoDentroDelDirectorio_RetornaElPng()
    {
        var controller = CrearController();

        var resultado = controller.ObtenerCaptura(Factory.PngNombre);

        var archivo = resultado.Should().BeOfType<PhysicalFileResult>().Subject;
        archivo.ContentType.Should().Be("image/png");
        archivo.FileName.Should().Be(Path.Combine(_factory.CapturasDir, Factory.PngNombre));
    }

    [Theory]
    [InlineData("../secreto.png")]
    [InlineData("..\\..\\secreto.png")]
    [InlineData("sub/../../secreto.png")]
    public void RutaDentroDelDirectorio_RechazaTraversal(string archivo)
    {
        var directorio = Path.Combine(Path.GetTempPath(), "lefarma-capturas-" + Guid.NewGuid().ToString("N"));

        CapturasController.RutaDentroDelDirectorio(directorio, archivo).Should().BeNull();
    }

    [Fact]
    public void RutaDentroDelDirectorio_RechazaRutaAbsoluta()
    {
        var directorio = Path.Combine(Path.GetTempPath(), "lefarma-capturas-" + Guid.NewGuid().ToString("N"));
        var absoluta = Path.Combine(Path.GetTempPath(), "secreto.png");

        CapturasController.RutaDentroDelDirectorio(directorio, absoluta).Should().BeNull();
    }

    [Fact]
    public void RutaDentroDelDirectorio_AceptaUnArchivoDelDirectorio()
    {
        var directorio = Path.Combine(Path.GetTempPath(), "lefarma-capturas-" + Guid.NewGuid().ToString("N"));

        CapturasController.RutaDentroDelDirectorio(directorio, "uno.png")
            .Should().Be(Path.Combine(directorio, "uno.png"));
    }

    private CapturasController CrearController()
    {
        var servicio = _factory.Services.GetRequiredService<CapturasService>();
        var env = _factory.Services.GetRequiredService<IWebHostEnvironment>();
        return new CapturasController(servicio, env);
    }

    // ------------------------------------------------------------------ //
    //                          Fixture / auth                            //
    // ------------------------------------------------------------------ //

    public sealed class Factory : WebApplicationFactory<Program>
    {
        public const string PngNombre = "captura-seguridad.png";
        public static readonly byte[] Png = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4, 5, 6 };
        public static readonly byte[] Secreto = { 9, 9, 9, 9, 9, 9 };

        private bool _archivosListos;
        private string _webRoot = "";

        /// <summary>Nombre del archivo "secreto" que vive FUERA de capturas.</summary>
        public string? SecretNombre { get; private set; }

        public string CapturasDir => Path.Combine(_webRoot, "media", "capturas-viaticos");

        /// <summary>Crea el PNG de prueba y el archivo trampa, una sola vez.</summary>
        public void AsegurarArchivos()
        {
            if (_archivosListos) return;

            _webRoot = Services.GetRequiredService<IWebHostEnvironment>().WebRootPath;
            Directory.CreateDirectory(CapturasDir);
            File.WriteAllBytes(Path.Combine(CapturasDir, PngNombre), Png);

            SecretNombre = $"secreto-{Guid.NewGuid():N}.png";
            File.WriteAllBytes(Path.Combine(_webRoot, "media", SecretNombre), Secreto);
            _archivosListos = true;
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            // Production usa appsettings.json (ArchivosSettings:BasePath relativo)
            // y evita C:\archivos de appsettings.Development.json.
            builder.UseEnvironment(Environments.Production);
            builder.ConfigureServices(services =>
            {
                services.AddAuthentication(NombreEsquema)
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                        NombreEsquema, _ => { });
            });
        }

        protected override void Dispose(bool disposing)
        {
            if (_archivosListos)
            {
                try { File.Delete(Path.Combine(CapturasDir, PngNombre)); } catch { /* best effort */ }
                if (SecretNombre is not null)
                {
                    try { File.Delete(Path.Combine(_webRoot, "media", SecretNombre)); } catch { /* best effort */ }
                }
            }

            base.Dispose(disposing);
        }
    }

    /// <summary>
    /// Handler de pruebas: sin <c>X-Test-UserId</c> devuelve NoResult (=> 401);
    /// con la cabecera emite un claim de identidad (=> 200).
    /// </summary>
    public sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public TestAuthHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder)
            : base(options, logger, encoder)
        {
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var userId = Request.Headers["X-Test-UserId"].ToString();
            if (string.IsNullOrEmpty(userId))
            {
                return Task.FromResult(AuthenticateResult.NoResult());
            }

            var claims = new[] { new Claim(ClaimTypes.NameIdentifier, userId) };
            var identity = new ClaimsIdentity(claims, authenticationType: NombreEsquema);
            var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), NombreEsquema);
            return Task.FromResult(AuthenticateResult.Success(ticket));
        }
    }
}