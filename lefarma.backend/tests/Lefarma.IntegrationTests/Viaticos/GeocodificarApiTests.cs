using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Lefarma.Tests.Viaticos;

/// <summary>
/// Integración del proxy de geocodificación: HTTP real contra WebApplicationFactory
/// (Program.cs completo, con el named client "nominatim" real de Program.cs) y un
/// handler falso de upstream que cuenta llamadas y captura el User-Agent que llega
/// a Nominatim. Cada test usa claves únicas (texto con GUID) para no depender de
/// estado previo del IMemoryCache compartido por la fixture.
/// </summary>
public sealed class GeocodificarApiTests : IClassFixture<GeocodificarApiTests.GeocodificarFixture>
{
    private const string UserAgentEsperado = "GrupoLefarmaViaticos/1.0 (soporte@lefarma.com)";

    public sealed class FakeUpstreamHandler : HttpMessageHandler
    {
        public readonly List<string> Urls = [];
        public readonly List<string> UserAgents = [];
        public HttpStatusCode Estado = HttpStatusCode.OK;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            // AbsoluteUri (no ToString): conserva %20/%C3%A9 escapados para los asserts.
            Urls.Add(request.RequestUri?.AbsoluteUri ?? string.Empty);
            UserAgents.Add(request.Headers.UserAgent.ToString());
            return Task.FromResult(new HttpResponseMessage(Estado)
            {
                Content = new StringContent(
                    """[{"display_name":"Av. Lázaro Cárdenas 123, Toluca, México","lat":"19.4326","lon":"-99.1332"}]""",
                    Encoding.UTF8, "application/json")
            });
        }
    }

    public sealed class GeocodificarFixture : WebApplicationFactory<Program>
    {
        public FakeUpstreamHandler Upstream { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureServices(services =>
            {
                // Reemplaza SOLO el handler del named client "nominatim": el
                // User-Agent y el timeout siguen viniendo de Program.cs.
                services.AddHttpClient("nominatim")
                    .ConfigurePrimaryHttpMessageHandler(() => Upstream);
            });
        }
    }

    private readonly GeocodificarFixture _factory;
    private readonly HttpClient _client;

    public GeocodificarApiTests(GeocodificarFixture factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private int UpstreamPara(string textoCodificado) =>
        _factory.Upstream.Urls.Count(u => u.Contains(textoCodificado));

    [Fact]
    public async Task Global_responde_200_con_resultados_y_UserAgent_de_politica()
    {
        var codificado = Uri.EscapeDataString($"reforma {Guid.NewGuid():N}");

        var respuesta = await _client.GetAsync($"/api/viaticos/geocodificar?tipo=global&texto={codificado}");

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        using var cuerpo = await JsonDocument.ParseAsync(await respuesta.Content.ReadAsStreamAsync());
        Assert.True(cuerpo.RootElement.GetProperty("success").GetBoolean());
        var data = cuerpo.RootElement.GetProperty("data");
        Assert.Equal(JsonValueKind.Array, data.ValueKind);
        Assert.Equal("Av. Lázaro Cárdenas 123, Toluca, México", data[0].GetProperty("nombre").GetString());
        Assert.Equal(19.4326, data[0].GetProperty("latitud").GetDouble(), precision: 6);
        Assert.Equal(-99.1332, data[0].GetProperty("longitud").GetDouble(), precision: 6);

        Assert.Equal(1, UpstreamPara(codificado));
        var indice = _factory.Upstream.Urls.FindIndex(u => u.Contains(codificado));
        var urlUpstream = _factory.Upstream.Urls[indice];
        Assert.StartsWith("https://nominatim.openstreetmap.org/search", urlUpstream);
        Assert.Contains("countrycodes=mx", urlUpstream);
        Assert.Contains("limit=5", urlUpstream);
        Assert.Equal(UserAgentEsperado, _factory.Upstream.UserAgents[indice]);
    }

    [Fact]
    public async Task Global_segunda_llamada_identica_no_vuelve_a_golpear_upstream()
    {
        var codificado = Uri.EscapeDataString($"toluca {Guid.NewGuid():N}");
        var url = $"/api/viaticos/geocodificar?tipo=global&texto={codificado}";

        var primera = await _client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, primera.StatusCode);
        var cuerpoPrimera = await primera.Content.ReadAsStringAsync();
        Assert.Equal(1, UpstreamPara(codificado));

        var segunda = await _client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, segunda.StatusCode);
        var cuerpoSegunda = await segunda.Content.ReadAsStringAsync();
        Assert.Equal(cuerpoPrimera, cuerpoSegunda);
        Assert.Equal(1, UpstreamPara(codificado));
    }

    [Fact]
    public async Task Cascada_envia_estado_municipio_y_calle_y_cachea()
    {
        var calleCodificada = Uri.EscapeDataString($"calle {Guid.NewGuid():N}");
        var url =
            $"/api/viaticos/geocodificar?tipo=cascada&estado={Uri.EscapeDataString("México")}&municipio={Uri.EscapeDataString("Toluca")}&texto={calleCodificada}";

        var respuesta = await _client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);

        var indice = _factory.Upstream.Urls.FindIndex(u => u.Contains(calleCodificada));
        Assert.True(indice >= 0);
        var urlUpstream = _factory.Upstream.Urls[indice];
        Assert.StartsWith("https://nominatim.openstreetmap.org/search", urlUpstream);
        Assert.Contains("state=M%C3%A9xico", urlUpstream);
        Assert.Contains("city=Toluca", urlUpstream);
        Assert.Contains("street=" + calleCodificada, urlUpstream);
        Assert.Contains("countrycodes=mx", urlUpstream);
        Assert.Contains("limit=5", urlUpstream);
        Assert.Equal(UserAgentEsperado, _factory.Upstream.UserAgents[indice]);

        var segunda = await _client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, segunda.StatusCode);
        Assert.Equal(1, UpstreamPara(calleCodificada));
    }

    [Fact]
    public async Task Entrada_invalida_responde_400_sin_golpear_upstream()
    {
        var antes = _factory.Upstream.Urls.Count;

        var tipoInvalido = await _client.GetAsync(
            $"/api/viaticos/geocodificar?tipo=otro&texto={Uri.EscapeDataString($"x {Guid.NewGuid():N}")}");
        Assert.Equal(HttpStatusCode.BadRequest, tipoInvalido.StatusCode);

        var cascadaIncompleta = await _client.GetAsync(
            $"/api/viaticos/geocodificar?tipo=cascada&texto={Uri.EscapeDataString($"calle {Guid.NewGuid():N}")}");
        Assert.Equal(HttpStatusCode.BadRequest, cascadaIncompleta.StatusCode);

        var textoCorto = await _client.GetAsync("/api/viaticos/geocodificar?tipo=global&texto=ab");
        Assert.Equal(HttpStatusCode.BadRequest, textoCorto.StatusCode);

        Assert.Equal(antes, _factory.Upstream.Urls.Count);
    }

    [Fact]
    public async Task Upstream_caido_responde_502_y_no_cachea_el_fallo()
    {
        var codificado = Uri.EscapeDataString($"fallo {Guid.NewGuid():N}");
        _factory.Upstream.Estado = HttpStatusCode.ServiceUnavailable;
        try
        {
            var respuesta = await _client.GetAsync($"/api/viaticos/geocodificar?tipo=global&texto={codificado}");
            Assert.Equal(HttpStatusCode.BadGateway, respuesta.StatusCode);
        }
        finally
        {
            _factory.Upstream.Estado = HttpStatusCode.OK;
        }

        var recuperada = await _client.GetAsync($"/api/viaticos/geocodificar?tipo=global&texto={codificado}");
        Assert.Equal(HttpStatusCode.OK, recuperada.StatusCode);
    }
}
