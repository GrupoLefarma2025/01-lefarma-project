using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Lefarma.Tests.Viaticos;

/// <summary>
/// QA MANUAL de T8 (capturas de viaticos). NO es una prueba de regresion:
/// arranca Chromium via node y sale a internet, por lo que es lenta y
/// dependiente de red. Existe para dejar evidencia reproducible del flujo
/// completo HTTP -> NodeCapturasScriptRunner -> captura-viaticos.mjs ->
/// copia del PNG a wwwroot/media/capturas-viaticos.
///
/// Se ejecuta a mano:
///   dotnet test tests/Lefarma.IntegrationTests/Lefarma.IntegrationTests.csproj
///     --filter FullyQualifiedName~CapturasManualQa
/// Imprime la respuesta literal del POST y verifica con Test-Path que el PNG
/// existe en disco.
/// </summary>
public sealed class CapturasManualQa : IClassFixture<CapturasManualQa.CapturasQaFixture>
{
    public const string NombreEsquema = "CapturasQa";

    public sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public TestAuthHandler(
            Microsoft.Extensions.Options.IOptionsMonitor<AuthenticationSchemeOptions> options,
            Microsoft.Extensions.Logging.ILoggerFactory logger,
            System.Text.Encodings.Web.UrlEncoder encoder)
            : base(options, logger, encoder) { }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "9001"),
                new Claim(ClaimTypes.Name, "qa"),
            };
            var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, Scheme.Name));
            return Task.FromResult(AuthenticateResult.Success(
                new AuthenticationTicket(principal, Scheme.Name)));
        }
    }

    public sealed class CapturasQaFixture : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureServices(services =>
            {
                services.AddAuthentication(NombreEsquema)
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                        NombreEsquema, _ => { });
            });
        }
    }

    /// <summary>
    /// Fixture con <c>CapturasSettings:HardTimeoutSeconds=2</c> para forzar el
    /// camino de kill del arbol de procesos sin esperar los 120s por defecto.
    /// </summary>
    public sealed class TimeoutQaFixture : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.UseSetting("CapturasSettings:HardTimeoutSeconds", "2");
            builder.ConfigureServices(services =>
            {
                services.AddAuthentication(NombreEsquema)
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                        NombreEsquema, _ => { });
            });
        }
    }

    private readonly CapturasQaFixture _factory;
    private readonly HttpClient _client;

    public CapturasManualQa(CapturasQaFixture factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Post_de_2_urls_publicas_devuelve_200_y_png_en_disco()
    {
        var payload = new
        {
            urls = new object[]
            {
                new { url = "https://example.com/", nombre = "qa-example" },
                new { url = "https://www.iana.org/help/example-domains", nombre = "qa-iana" },
            },
        };

        var respuesta = await _client.PostAsJsonAsync("/api/viaticos/capturas", payload);
        var cuerpo = await respuesta.Content.ReadAsStringAsync();

        Console.WriteLine("===QA_STATUS=== " + (int)respuesta.StatusCode + " " + respuesta.StatusCode);
        Console.WriteLine("===QA_BODY=== " + cuerpo);

        using var doc = System.Text.Json.JsonDocument.Parse(cuerpo);
        Assert.True(doc.RootElement.GetProperty("success").GetBoolean());
        var data = doc.RootElement.GetProperty("data");
        Assert.Equal(2, data.GetArrayLength());

        foreach (var item in data.EnumerateArray())
        {
            var ok = item.GetProperty("ok").GetBoolean();
            var archivo = item.TryGetProperty("archivo", out var a) && a.ValueKind != System.Text.Json.JsonValueKind.Null
                ? a.GetString() : null;
            var error = item.TryGetProperty("error", out var e) && e.ValueKind != System.Text.Json.JsonValueKind.Null
                ? e.GetString() : null;
            Console.WriteLine($"===QA_ITEM=== ok={ok} archivo={archivo} error={error}");

            if (!ok) continue;

            // Test-Path equivalente: el PNG debe existir bajo el WebRoot real.
            var wwwroot = _factory.Services
                .GetRequiredService<IWebHostEnvironment>().WebRootPath;
            var ruta = Path.Combine(wwwroot, "media",
                (archivo ?? "").Replace('/', Path.DirectorySeparatorChar));
            Console.WriteLine("===QA_PNG_PATH=== " + ruta);
            Console.WriteLine("===QA_PNG_EXISTS=== " + File.Exists(ruta)
                + " bytes=" + (File.Exists(ruta) ? new FileInfo(ruta).Length.ToString() : "0"));
            Assert.True(File.Exists(ruta), "el PNG no existe en disco: " + ruta);
            Assert.True(new FileInfo(ruta).Length > 0, "el PNG esta vacio");
        }
    }

    /// <summary>
    /// QA del camino de timeout: con HardTimeoutSeconds=2 el runner debe matar
    /// el ARBOL de procesos (node + chromium) y responder 200 con ok=false, sin
    /// 500 y sin dejar procesos huerfanos de ms-playwright.
    /// </summary>
    [Fact]
    public async Task Script_colgado_por_timeout_responde_200_sin_dejar_huerfanos()
    {
        using var factory = new TimeoutQaFixture();
        var client = factory.CreateClient();

        var antes = CountProcesosPlaywright();

        var respuesta = await client.PostAsJsonAsync("/api/viaticos/capturas", new
        {
            urls = new object[]
            {
                // httpbin.org/delay/60 se queda colgado 60s >> 2s de timeout.
                new { url = "https://httpbin.org/delay/60", nombre = "qa-hang" },
            },
        });
        var cuerpo = await respuesta.Content.ReadAsStringAsync();

        Console.WriteLine("===QA_HANG_STATUS=== " + (int)respuesta.StatusCode + " " + respuesta.StatusCode);
        Console.WriteLine("===QA_HANG_BODY=== " + cuerpo);
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);

        using var doc = System.Text.Json.JsonDocument.Parse(cuerpo);
        var item = doc.RootElement.GetProperty("data")[0];
        Console.WriteLine("===QA_HANG_OK=== " + item.GetProperty("ok").GetBoolean());
        Console.WriteLine("===QA_HANG_ERROR=== " + item.GetProperty("error").GetString());

        // El runner mata el arbol de forma sincrona antes de responder, pero
        // Windows tarda unos ms en soltar los handles: damos margen corto.
        var despues = -1;
        for (var i = 0; i < 20 && despues != antes; i++)
        {
            await Task.Delay(500);
            despues = CountProcesosPlaywright();
        }
        Console.WriteLine($"===QA_HANG_ORPHANS=== antes={antes} despues={despues}");
        Assert.Equal(antes, despues);
    }

    /// <summary>
    /// Cuenta procesos reales de Playwright/Chromium. Se excluyen a proposito
    /// powershell.exe y bash.exe: el comando de deteccion en si mismo lleva
    /// 'ms-playwright' en su linea de comandos y se contaria a si mismo.
    /// </summary>
    private static int CountProcesosPlaywright()
    {
        // .NET no expone CommandLine en System.Diagnostics.Process (solo en
        // WMI/CIM), por eso se delega a PowerShell + Get-CimInstance.
        var psi = new System.Diagnostics.ProcessStartInfo
        {
            FileName = "powershell",
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };
        psi.ArgumentList.Add("-NoProfile");
        psi.ArgumentList.Add("-Command");
        // Se excluyen a proposito powershell/bash/conhost: el propio comando de
        // deteccion lleva 'ms-playwright' en su linea de comandos.
        psi.ArgumentList.Add(
            "@(Get-CimInstance Win32_Process | Where-Object { " +
            "$_.CommandLine -match 'ms-playwright' -and " +
            "$_.Name -notmatch '^(powershell|pwsh|bash|conhost)\\.exe$' }).Count");

        using var p = System.Diagnostics.Process.Start(psi)!;
        var salida = p.StandardOutput.ReadToEnd().Trim();
        p.WaitForExit();
        return int.TryParse(salida, out var n) ? n : -1;
    }
}