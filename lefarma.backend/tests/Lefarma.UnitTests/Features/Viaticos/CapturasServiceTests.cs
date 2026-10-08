using System.Text.Json;
using FluentAssertions;
using Lefarma.API.Features.Viaticos;
using Lefarma.API.Features.Viaticos.DTOs;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// Pruebas unitarias del servicio de capturas (T8). El script real
/// (captura-viaticos.mjs) y Chromium NO se invocan: el runner se sustituye
/// por un fake que devuelve la salida controlada por el test.
/// </summary>
public class CapturasServiceTests : IDisposable
{
    private readonly string _wwwroot;
    private readonly string _frontendRoot;
    private readonly string _scriptPath;

    public CapturasServiceTests()
    {
        // Tempdir aislado por prueba; se limpia en Dispose.
        var baseTmp = Path.Combine(Path.GetTempPath(), "lefarma-capturas-tests-" + Guid.NewGuid().ToString("N"));
        _wwwroot = Path.Combine(baseTmp, "wwwroot");
        _frontendRoot = Path.Combine(baseTmp, "lefarma.frontend");
        Directory.CreateDirectory(_wwwroot);
        Directory.CreateDirectory(_frontendRoot);
        Directory.CreateDirectory(Path.Combine(_wwwroot, "media"));
        Directory.CreateDirectory(Path.Combine(_frontendRoot, "scripts"));
        Directory.CreateDirectory(Path.Combine(_frontendRoot, "public", "capturas", "viaticos"));
        _scriptPath = Path.Combine(_frontendRoot, "scripts", "captura-viaticos.mjs");
        File.WriteAllText(_scriptPath, "// fake test script (no se ejecuta en estos tests)");
    }

    public void Dispose()
    {
        try { Directory.Delete(Path.GetDirectoryName(_wwwroot)!, recursive: true); } catch { /* ignore */ }
    }

    private CapturasService CrearServicio(CapturasSettings settings, ICapturasScriptRunner runner)
    {
        // ScriptPath poblado: el servicio deriva frontend root del abuelo del script,
        // y asi no depende de que ContentRootPath tenga un sibling lefarma.frontend.
        settings.ScriptPath = _scriptPath;
        var env = new FakeEnv(_wwwroot, _wwwroot);
        return new CapturasService(Options.Create(settings), env, NullLogger<CapturasService>.Instance, runner);
    }

    [Fact]
    public async Task ListaVacia_DevuelveResultadoVacio_SinInvocarScript()
    {
        var runner = new RecordingRunner();
        var service = CrearServicio(new CapturasSettings(), runner);

        var resultado = await service.CapturarAsync(Array.Empty<CapturaItem>(), CancellationToken.None);

        resultado.Outcome.Should().Be(CapturaOutcome.Ok);
        resultado.Results.Should().BeEmpty();
        runner.Llamadas.Should().Be(0, "lista vacia no debe invocar al script");
    }

    [Fact]
    public async Task OnceUrls_RetornaTooMany_SinInvocarScript()
    {
        var runner = new RecordingRunner();
        var service = CrearServicio(new CapturasSettings(), runner);

        var items = Enumerable.Range(0, 11)
            .Select(i => new CapturaItem { Url = $"https://example.com/{i}" })
            .ToList();

        var resultado = await service.CapturarAsync(items, CancellationToken.None);

        resultado.Outcome.Should().Be(CapturaOutcome.TooMany);
        resultado.Message.Should().Contain("11");
        resultado.Message.Should().Contain("10");
        runner.Llamadas.Should().Be(0, "no debe invocar al script con >10 URLs");
    }

    [Fact]
    public async Task BookingCom_ConWhitelistPoblada_RechazadoCon400Logico()
    {
        var runner = new RecordingRunner();
        var settings = new CapturasSettings
        {
            WhitelistDomains = new List<string> { "avianca.com" },
        };
        var service = CrearServicio(settings, runner);

        var items = new[] { new CapturaItem { Url = "https://www.booking.com/hotel/test", Nombre = "h" } };
        var resultado = await service.CapturarAsync(items, CancellationToken.None);

        resultado.Outcome.Should().Be(CapturaOutcome.DomainBlocked);
        resultado.Message.Should().Contain("booking.com");
        runner.Llamadas.Should().Be(0, "el rechazo por dominio ocurre antes del script");
    }

    [Fact]
    public async Task DominioFueraDeWhitelist_ConWhitelistPoblada_Rechazado()
    {
        var runner = new RecordingRunner();
        var settings = new CapturasSettings
        {
            WhitelistDomains = new List<string> { "avianca.com", "latam.com" },
        };
        var service = CrearServicio(settings, runner);

        var items = new[] { new CapturaItem { Url = "https://example.com/path", Nombre = "x" } };
        var resultado = await service.CapturarAsync(items, CancellationToken.None);

        resultado.Outcome.Should().Be(CapturaOutcome.DomainBlocked);
        resultado.Message.Should().Contain("example.com");
    }

    [Fact]
    public async Task SalidaNoParseable_DevuelveOkFalsePorItem_Sin500()
    {
        var runner = new FakeRunner(
            new CapturaScriptRun(
                Stdout: "esto definitivamente no es JSON valido { [ ",
                Stderr: "warning: algo",
                KilledByTimeout: false));
        var service = CrearServicio(new CapturasSettings(), runner);

        var items = new[]
        {
            new CapturaItem { Url = "https://example.com/a", Nombre = "a" },
            new CapturaItem { Url = "https://example.com/b", Nombre = "b" },
        };

        // El servicio NO debe lanzar: debe capturar el error y devolver Results con ok:false.
        var resultado = await service.CapturarAsync(items, CancellationToken.None);

        resultado.Outcome.Should().Be(CapturaOutcome.Ok);
        resultado.Results.Should().HaveCount(2);
        resultado.Results.Should().OnlyContain(r => !r.Ok);
        resultado.Results.Should().OnlyContain(r => r.Error != null && r.Error.Contains("no parseable"));
    }

    [Fact]
    public async Task SalidaParseable_ReescribeRutaDelPng_AlPublicPath()
    {
        // El script "devuelve" capturas/viaticos/foo.png; el servicio debe
        // copiarlas a wwwroot/media/capturas-viaticos/foo.png y reescribir la
        // ruta del DTO.
        var srcDir = Path.Combine(_frontendRoot, "public", "capturas", "viaticos");
        var fakePng = Path.Combine(srcDir, "foo.png");
        File.WriteAllBytes(fakePng, new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A });

        var jsonOut = JsonSerializer.Serialize(new[]
        {
            new { url = "https://example.com/", nombre = "foo", ok = true,
                  archivo = "capturas/viaticos/foo.png", error = (string?)null }
        });
        var runner = new FakeRunner(new CapturaScriptRun(jsonOut, "", false));
        var service = CrearServicio(new CapturasSettings(), runner);

        var resultado = await service.CapturarAsync(
            new[] { new CapturaItem { Url = "https://example.com/", Nombre = "foo" } },
            CancellationToken.None);

        resultado.Outcome.Should().Be(CapturaOutcome.Ok);
        resultado.Results.Should().HaveCount(1);
        var r = resultado.Results[0];
        r.Ok.Should().BeTrue();
        r.Archivo.Should().Be("capturas-viaticos/foo.png");
        File.Exists(Path.Combine(_wwwroot, "media", "capturas-viaticos", "foo.png")).Should().BeTrue();
    }

    [Fact]
    public async Task SalidaVacia_DevuelveOkFalsePorItem_Sin500()
    {
        var runner = new FakeRunner(new CapturaScriptRun("", "stderr", false));
        var service = CrearServicio(new CapturasSettings(), runner);

        var resultado = await service.CapturarAsync(
            new[] { new CapturaItem { Url = "https://example.com/", Nombre = "a" } },
            CancellationToken.None);

        resultado.Outcome.Should().Be(CapturaOutcome.Ok);
        resultado.Results.Should().HaveCount(1);
        resultado.Results[0].Ok.Should().BeFalse();
        resultado.Results[0].Error.Should().NotBeNullOrEmpty();
    }

    // -- Seguridad: el esquema http/https, los dominios prohibidos y los destinos
    // internos se validan SIEMPRE, incluso con la configuracion real por
    // defecto (WhitelistDomains vacio en appsettings.json). Antes quedaban
    // dentro del if de la lista blanca, asi que con lista vacia no se validaba
    // nada y el servidor aceptaba file:, data: y destinos internos.

    [Fact]
    public async Task ListaVacia_RechazaEsquemaFile_NoDevuelveOk()
    {
        var runner = new RecordingRunner();
        var service = CrearServicio(new CapturasSettings(), runner);

        var items = new[] { new CapturaItem { Url = "file:///c:/windows/win.ini", Nombre = "f" } };
        var resultado = await service.CapturarAsync(items, CancellationToken.None);

        resultado.Outcome.Should().Be(CapturaOutcome.DomainBlocked);
        resultado.Message.Should().Contain("esquema");
        resultado.Results.Should().BeNullOrEmpty("una URL rechazada nunca llega al script");
        runner.Llamadas.Should().Be(0, "el rechazo por esquema ocurre antes del script");
    }

    [Fact]
    public async Task ListaVacia_RechazaIpInternaMetadata_NoDevuelveOk()
    {
        var runner = new RecordingRunner();
        var service = CrearServicio(new CapturasSettings(), runner);

        var items = new[] { new CapturaItem { Url = "http://169.254.169.254/latest/meta-data/", Nombre = "i" } };
        var resultado = await service.CapturarAsync(items, CancellationToken.None);

        resultado.Outcome.Should().Be(CapturaOutcome.DomainBlocked);
        resultado.Message.Should().Contain("interno");
        resultado.Results.Should().BeNullOrEmpty("una URL rechazada nunca llega al script");
        runner.Llamadas.Should().Be(0, "el bloqueo de destinos internos ocurre antes del script");
    }

    [Theory]
    [InlineData("http://localhost:5000/x")]
    [InlineData("http://127.0.0.1/x")]
    [InlineData("http://10.1.2.3/x")]
    [InlineData("http://192.168.0.10/x")]
    [InlineData("http://172.16.5.5/x")]
    [InlineData("http://intranet.local/x")]
    [InlineData("http://[::1]/x")]
    [InlineData("http://[fe80::1]/x")]
    public async Task DestinosInternos_ConListaVacia_Rechazados(string url)
    {
        var runner = new RecordingRunner();
        var service = CrearServicio(new CapturasSettings(), runner);

        var resultado = await service.CapturarAsync(
            new[] { new CapturaItem { Url = url, Nombre = "x" } },
            CancellationToken.None);

        resultado.Outcome.Should().Be(CapturaOutcome.DomainBlocked);
        resultado.Results.Should().BeNullOrEmpty();
        runner.Llamadas.Should().Be(0);
    }

    [Fact]
    public async Task ListaVacia_RechazaBookingPorDominioProhibido_NoDevuelveOk()
    {
        var runner = new RecordingRunner();
        var service = CrearServicio(new CapturasSettings(), runner);

        var items = new[] { new CapturaItem { Url = "https://www.booking.com/hotel/test", Nombre = "b" } };
        var resultado = await service.CapturarAsync(items, CancellationToken.None);

        resultado.Outcome.Should().Be(CapturaOutcome.DomainBlocked);
        resultado.Message.Should().Contain("booking.com");
        resultado.Results.Should().BeNullOrEmpty();
        runner.Llamadas.Should().Be(0, "el dominio prohibido se rechaza aun sin lista blanca");
    }

    [Fact]
    public async Task WhitelistPoblada_RechazaEsquemaNoHttp_NoDevuelveOk()
    {
        var runner = new RecordingRunner();
        var settings = new CapturasSettings
        {
            WhitelistDomains = new List<string> { "avianca.com" },
        };
        var service = CrearServicio(settings, runner);

        var items = new[] { new CapturaItem { Url = "file:///etc/passwd", Nombre = "f" } };
        var resultado = await service.CapturarAsync(items, CancellationToken.None);

        resultado.Outcome.Should().Be(CapturaOutcome.DomainBlocked);
        resultado.Message.Should().Contain("esquema");
        resultado.Results.Should().BeNullOrEmpty();
        runner.Llamadas.Should().Be(0);
    }

    // -- Fakes ---------------------------------------------------------------

    private sealed class FakeEnv : IWebHostEnvironment
    {
        public FakeEnv(string webRoot, string contentRoot)
        {
            WebRootPath = webRoot;
            ContentRootPath = contentRoot;
            ApplicationName = "Lefarma.UnitTests";
            EnvironmentName = "Development";
        }
        public string ApplicationName { get; set; }
        public string EnvironmentName { get; set; }
        public IFileProvider ContentRootFileProvider { get; set; } = null!;
        public IFileProvider WebRootFileProvider { get; set; } = null!;
        public string ContentRootPath { get; set; }
        public string WebRootPath { get; set; }
    }

    private sealed class FakeRunner : ICapturasScriptRunner
    {
        private readonly CapturaScriptRun _result;
        public int Llamadas { get; private set; }
        public FakeRunner(CapturaScriptRun result) { _result = result; }
        public Task<CapturaScriptRun> RunAsync(string scriptPath, string inputJson, int hardTimeoutSeconds, CancellationToken ct)
        {
            Llamadas++;
            return Task.FromResult(_result);
        }
    }

    private sealed class RecordingRunner : ICapturasScriptRunner
    {
        public int Llamadas { get; private set; }
        public Task<CapturaScriptRun> RunAsync(string scriptPath, string inputJson, int hardTimeoutSeconds, CancellationToken ct)
        {
            Llamadas++;
            return Task.FromResult(new CapturaScriptRun("[]", "", false));
        }
    }
}
