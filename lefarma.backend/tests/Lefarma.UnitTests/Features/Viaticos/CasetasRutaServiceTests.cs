using FluentAssertions;
using Lefarma.API.Features.Viaticos;
using System.Net;
using System.Text;
using System.Text.Json;
using Lefarma.API.Features.Viaticos.DTOs;
using Microsoft.Extensions.Caching.Memory;

namespace Lefarma.UnitTests.Features.Viaticos;

public class CasetasRutaServiceTests
{
    private const string CeroPlazasHtml = """
    <table>
      <tr><th>Tramo</th><th>Carretera</th><th>Long.</th><th>Tiempo</th><th>Caseta o puente</th><th>Automóvil</th></tr>
      <tr><td colspan="2">Totales</td><td>12.000</td><td>00:20</td><td></td><td>0.00</td></tr>
    </table>
    """;

    private static string Fixture() => File.ReadAllText(Path.Combine(
        AppContext.BaseDirectory, "Features", "Viaticos", "Fixtures", "sct-cdmx-pachuca.html"));

    [Fact]
    public void ParseMergedTotals_PreservesDistanceTimePlazaAndToll()
    {
        var resultado = CasetasRutaService.ParsearRuta(Fixture());

        resultado.Estado.Should().Be(EstadosCasetasRuta.Disponible);
        resultado.KmTotal.Should().BeApproximately(97.350, 0.0001);
        resultado.TiempoTotal.Should().Be("01:15");
        resultado.PeajeTotal.Should().Be(72.0);
        resultado.Fuente.Should().Be("SCT · Rutas Punto a Punto");
        resultado.Casetas.Should().ContainSingle();
        resultado.Casetas[0].Nombre.Should().Be("Ojo de Agua");
        resultado.Casetas[0].KmDesdeOrigen.Should().BeApproximately(63.4, 0.01);
        resultado.Casetas[0].TarifaAuto.Should().Be(72.0);
    }

    [Fact]
    public void ParseValidZeroPlazaResponse_ReturnsAvailableWithOfficialZero()
    {
        var resultado = CasetasRutaService.ParsearRuta(CeroPlazasHtml);

        resultado.Estado.Should().Be(EstadosCasetasRuta.Disponible);
        resultado.Casetas.Should().BeEmpty();
        resultado.KmTotal.Should().Be(12.0);
        resultado.TiempoTotal.Should().Be("00:20");
        resultado.PeajeTotal.Should().Be(0.0);
    }

    [Fact]
    public void ParseLocalizedNumbers_UsesCorrectSeparators()
    {
        var html = Fixture().Replace("97.350", "1,234.50", StringComparison.Ordinal)
            .Replace("72.00", "$72,50", StringComparison.Ordinal);

        var resultado = CasetasRutaService.ParsearRuta(html);

        resultado.Estado.Should().Be(EstadosCasetasRuta.Disponible);
        resultado.KmTotal.Should().Be(1234.50);
        resultado.PeajeTotal.Should().Be(72.50);
        resultado.Casetas[0].TarifaAuto.Should().Be(72.50);
    }

    [Theory]
    [InlineData("<html><body>sin tabla de ruta</body></html>")]
    [InlineData("<table><tr><th>Carretera</th></tr><tr><td>Incompleta</td></tr></table>")]
    public void ParseMalformedContent_ReturnsInvalidWithoutZeros(string html)
    {
        var resultado = CasetasRutaService.ParsearRuta(html);

        resultado.Estado.Should().Be(EstadosCasetasRuta.RespuestaInvalida);
        resultado.Casetas.Should().BeEmpty();
        resultado.KmTotal.Should().BeNull();
        resultado.TiempoTotal.Should().BeNull();
        resultado.PeajeTotal.Should().BeNull();
    }

    [Fact]
    public void ParseMalformedTotal_DoesNotConvertToZero()
    {
        var html = Fixture().Replace("97.350", "no disponible", StringComparison.Ordinal);

        var resultado = CasetasRutaService.ParsearRuta(html);

        resultado.Estado.Should().Be(EstadosCasetasRuta.RespuestaInvalida);
        resultado.KmTotal.Should().BeNull();
        resultado.PeajeTotal.Should().BeNull();
    }

    private static CostosRutaRequest Request(string municipioOrigen = "Ciudad de México") => new()
    {
        Opciones = new CostosRutaOpcionesInput { CalcularHoteles = false, CalcularViajesIntermedios = false },
        Personas =
        [
            new CostosRutaPersonaInput
            {
                Nombre = "Ana",
                CarroPropio = true,
                Gasolina = "magna",
                Draft = false,
                Lugares =
                [
                    new CostosRutaLugarInput
                    {
                        Orden = 1,
                        Tipo = "salida",
                        Nombre = "Origen",
                        Municipio = municipioOrigen,
                        Estado = municipioOrigen == "Ciudad de México" ? "Ciudad de México" : "Hidalgo",
                        Latitud = 19.4326,
                        Longitud = -99.1332,
                        FechaSalida = "2026-11-10",
                        HoraSalida = "08:00",
                    },
                    new CostosRutaLugarInput
                    {
                        Orden = 2,
                        Tipo = "taller",
                        Nombre = "Destino",
                        Municipio = "Pachuca",
                        Estado = "Hidalgo",
                        Latitud = 20.1011,
                        Longitud = -98.7591,
                        FechaInicioActividad = "2026-11-10",
                        HoraInicioActividad = "12:00",
                        FechaFinActividad = "2026-11-10",
                        HoraFinActividad = "13:00",
                    },
                ],
            },
        ],
    };

    private sealed class SctFakeHandler : HttpMessageHandler
    {
        private const string EstadosHtml = """
        <form name="frmConsulta" action="https://app.sct.gob.mx/sibuac_internet/ControllerUI?action=cmdEscogeRuta">
          <select name="edoOrigen"><option value="9">Distrito Federal</option><option value="13">Hidalgo</option></select>
        </form>
        """;
        private const string CiudadesHtml = """
        <form name="frmConsulta" action="https://app.sct.gob.mx/sibuac_internet/ControllerUI?action=cmdSolRutas">
          <select name="ciudadOrigen"><option value="1">Ciudad de México</option><option value="2">Pachuca</option></select>
          <select name="ciudadDestino"><option value="1">Ciudad de México</option><option value="2">Pachuca</option></select>
        </form>
        """;

        private readonly string _routeHtml;
        private readonly bool _fail;
        public int Calls { get; private set; }

        public SctFakeHandler(string routeHtml, bool fail = false)
        {
            _routeHtml = routeHtml;
            _fail = fail;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (request.RequestUri?.Host != "app.sct.gob.mx")
                return Task.FromResult(Response(HttpStatusCode.InternalServerError, string.Empty));
            Calls++;
            if (_fail) return Task.FromResult(Response(HttpStatusCode.ServiceUnavailable, string.Empty));
            if (request.Method == HttpMethod.Get) return Task.FromResult(Response(HttpStatusCode.OK, EstadosHtml));
            if (request.RequestUri.Query.Contains("cmdEscogeRuta", StringComparison.Ordinal))
                return Task.FromResult(Response(HttpStatusCode.OK, CiudadesHtml));
            if (request.RequestUri.Query.Contains("cmdSolRutas", StringComparison.Ordinal))
                return Task.FromResult(Response(HttpStatusCode.OK, _routeHtml));
            return Task.FromResult(Response(HttpStatusCode.InternalServerError, string.Empty));
        }

        private static HttpResponseMessage Response(HttpStatusCode status, string body) => new(status)
        {
            Content = new StringContent(body, Encoding.UTF8, "text/html"),
        };
    }

    private sealed class PendingFirstGetHandler : HttpMessageHandler
    {
        private readonly TaskCompletionSource<bool> _firstGetStarted = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int _calls;

        public int Calls => Volatile.Read(ref _calls);
        public Task FirstGetStarted => _firstGetStarted.Task;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Interlocked.Increment(ref _calls);
            _firstGetStarted.TrySetResult(true);
            await Task.Delay(Timeout.InfiniteTimeSpan, ct);
            throw new InvalidOperationException("The pending request should only complete through cancellation.");
        }
    }

    [Fact]
    public async Task ConsultarAsync_TotalTimeoutIncludesSemaphoreWaitAndReturnsProviderUnavailable()
    {
        using var handler = new PendingFirstGetHandler();
        using var http = new HttpClient(handler);
        var totalTimeout = TimeSpan.FromMilliseconds(100);

        var primera = CasetasRutaService.ConsultarAsync(
            http, "Ciudad de México", "Ciudad de México", "Pachuca", "Hidalgo", totalTimeout, CancellationToken.None);
        await handler.FirstGetStarted.WaitAsync(TimeSpan.FromSeconds(5));
        var segunda = CasetasRutaService.ConsultarAsync(
            http, "Ciudad de México", "Ciudad de México", "Pachuca", "Hidalgo", totalTimeout, CancellationToken.None);

        var resultados = await Task.WhenAll(primera, segunda).WaitAsync(TimeSpan.FromSeconds(5));

        resultados.Should().OnlyContain(r => r.Estado == EstadosCasetasRuta.ProveedorNoDisponible);
        handler.Calls.Should().Be(1, "the second consultation must remain queued until its total deadline expires");
    }

    [Fact]
    public async Task ConsultarAsync_CallerCancellationStillThrows()
    {
        using var handler = new PendingFirstGetHandler();
        using var http = new HttpClient(handler);
        using var cts = new CancellationTokenSource();

        var consulta = CasetasRutaService.ConsultarAsync(
            http, "Ciudad de México", "Ciudad de México", "Pachuca", "Hidalgo", TimeSpan.FromSeconds(20), cts.Token);
        await handler.FirstGetStarted.WaitAsync(TimeSpan.FromSeconds(5));
        cts.Cancel();

        Func<Task> act = () => consulta;
        await act.Should().ThrowAsync<OperationCanceledException>();
        handler.Calls.Should().Be(1);
    }

    [Fact]
    public async Task Motor_AvailableResultPropagatesAndUsesCache()
    {
        using var handler = new SctFakeHandler(Fixture());
        using var http = new HttpClient(handler);
        using var cache = new MemoryCache(new MemoryCacheOptions());

        var primera = await CalculoCostosRuta.CalcularAsync(Request(), http, cache);
        var segunda = await CalculoCostosRuta.CalcularAsync(Request(), http, cache);

        var disponibilidad = primera.Resultados[0].CasetasDisponibilidad.Single();
        disponibilidad.Estado.Should().Be(EstadosCasetasRuta.Disponible);
        var wire = JsonSerializer.Serialize(primera.Resultados[0], new JsonSerializerOptions(JsonSerializerDefaults.Web));
        wire.Should().Contain("\"casetasDisponibilidad\"").And.Contain("\"estado\":\"disponible\"");
        disponibilidad.KmTotal.Should().Be(97.350);
        disponibilidad.TiempoTotal.Should().Be("01:15");
        disponibilidad.PeajeTotal.Should().Be(72.0);
        primera.Resultados[0].Casetas.Should().ContainSingle(c => c.Nombre == "Ojo de Agua" && c.Km == 63.4);
        segunda.Resultados[0].CasetasDisponibilidad.Single().Estado.Should().Be(EstadosCasetasRuta.Disponible);
        handler.Calls.Should().Be(3, "the second calculation must reuse the successful official result");
    }

    [Fact]
    public async Task Motor_CachesValidZeroPlazaSuccess()
    {
        using var handler = new SctFakeHandler(CeroPlazasHtml);
        using var http = new HttpClient(handler);
        using var cache = new MemoryCache(new MemoryCacheOptions());

        var primera = await CalculoCostosRuta.CalcularAsync(Request(), http, cache);
        await CalculoCostosRuta.CalcularAsync(Request(), http, cache);

        var disponibilidad = primera.Resultados[0].CasetasDisponibilidad.Single();
        disponibilidad.Estado.Should().Be(EstadosCasetasRuta.Disponible);
        disponibilidad.PeajeTotal.Should().Be(0);
        primera.Resultados[0].Casetas.Should().BeEmpty();
        handler.Calls.Should().Be(3);
    }

    [Fact]
    public async Task Motor_InvalidResponseIsNotCachedAndHasNoZeros()
    {
        using var handler = new SctFakeHandler("<html>respuesta no interpretable</html>");
        using var http = new HttpClient(handler);
        using var cache = new MemoryCache(new MemoryCacheOptions());

        var primera = await CalculoCostosRuta.CalcularAsync(Request(), http, cache);
        await CalculoCostosRuta.CalcularAsync(Request(), http, cache);

        var disponibilidad = primera.Resultados[0].CasetasDisponibilidad.Single();
        disponibilidad.Estado.Should().Be(EstadosCasetasRuta.RespuestaInvalida);
        disponibilidad.KmTotal.Should().BeNull();
        disponibilidad.PeajeTotal.Should().BeNull();
        primera.Resultados[0].Casetas.Should().BeEmpty();
        handler.Calls.Should().Be(6);
    }

    [Fact]
    public async Task Motor_ProviderFailureIsNotCachedAndHasNoZeros()
    {
        using var handler = new SctFakeHandler(string.Empty, fail: true);
        using var http = new HttpClient(handler);
        using var cache = new MemoryCache(new MemoryCacheOptions());

        var primera = await CalculoCostosRuta.CalcularAsync(Request(), http, cache);
        await CalculoCostosRuta.CalcularAsync(Request(), http, cache);

        var disponibilidad = primera.Resultados[0].CasetasDisponibilidad.Single();
        disponibilidad.Estado.Should().Be(EstadosCasetasRuta.ProveedorNoDisponible);
        disponibilidad.KmTotal.Should().BeNull();
        disponibilidad.PeajeTotal.Should().BeNull();
        primera.Resultados[0].Casetas.Should().BeEmpty();
        handler.Calls.Should().Be(2);
    }

    [Fact]
    public async Task Motor_UnsupportedDestinationIsNotSubstitutedOrCached()
    {
        using var handler = new SctFakeHandler(Fixture());
        using var http = new HttpClient(handler);
        using var cache = new MemoryCache(new MemoryCacheOptions());

        var primera = await CalculoCostosRuta.CalcularAsync(Request("Mineral de la Reforma"), http, cache);
        await CalculoCostosRuta.CalcularAsync(Request("Mineral de la Reforma"), http, cache);

        var disponibilidad = primera.Resultados[0].CasetasDisponibilidad.Single();
        disponibilidad.Estado.Should().Be(EstadosCasetasRuta.DestinoNoSoportado);
        disponibilidad.KmTotal.Should().BeNull();
        disponibilidad.PeajeTotal.Should().BeNull();
        primera.Resultados[0].Casetas.Should().BeEmpty();
        handler.Calls.Should().Be(4, "unsupported catalog entries must not reach the route request or the success cache");
    }
}
