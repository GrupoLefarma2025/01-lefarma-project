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
        /// <summary>Respuesta por defecto: una dirección mexicana con calle y número.</summary>
        public const string CuerpoPorDefecto = """[{"display_name":"Lázaro Cárdenas, Toluca, México","name":"","lat":"19.4326","lon":"-99.1332","address":{"house_number":"123","road":"Av. Lázaro Cárdenas","city":"Toluca","state":"México","country":"México","country_code":"mx"}}]""";

        /// <summary>Respuesta por defecto de Photon: sin resultados.</summary>
        public const string CuerpoPhotonPorDefecto = """{"features":[]}""";

        public readonly List<string> Urls = [];
        public readonly List<string> UserAgents = [];
        public HttpStatusCode Estado = HttpStatusCode.OK;
        /// <summary>Cuerpo que devuelve el upstream falso; los tests lo ajustan al caso.</summary>
        public string Cuerpo = CuerpoPorDefecto;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            // AbsoluteUri (no ToString): conserva %20/%C3%A9 escapados para los asserts.
            Urls.Add(request.RequestUri?.AbsoluteUri ?? string.Empty);
            UserAgents.Add(request.Headers.UserAgent.ToString());
            return Task.FromResult(new HttpResponseMessage(Estado)
            {
                Content = new StringContent(Cuerpo, Encoding.UTF8, "application/json")
            });
        }
    }

    /// <summary>
    /// Upstream falso del resolvedor de ligas: responde por URL absoluta con
    /// un estado y un Location opcionales (NotFound si no está configurada).
    /// </summary>
    public sealed class FakeEnlacesHandler : HttpMessageHandler
    {
        public readonly List<string> Urls = [];
        public readonly Dictionary<string, (HttpStatusCode Estado, string? Location)> Respuestas = new();

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var url = request.RequestUri?.AbsoluteUri ?? string.Empty;
            Urls.Add(url);
            var mensaje = new HttpResponseMessage(HttpStatusCode.NotFound);
            if (Respuestas.TryGetValue(url, out var configurada))
            {
                mensaje.StatusCode = configurada.Estado;
                if (configurada.Location is not null)
                    mensaje.Headers.Location = new Uri(configurada.Location);
            }
            return Task.FromResult(mensaje);
        }
    }

    public sealed class GeocodificarFixture : WebApplicationFactory<Program>
    {
        public FakeUpstreamHandler Upstream { get; } = new();
        public FakeUpstreamHandler Photon { get; } = new() { Cuerpo = FakeUpstreamHandler.CuerpoPhotonPorDefecto };
        public FakeEnlacesHandler Enlaces { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureServices(services =>
            {
                // Reemplaza SOLO el handler de los named clients "nominatim",
                // "photon" y "enlaces": el User-Agent y el timeout siguen
                // viniendo de Program.cs.
                services.AddHttpClient("nominatim")
                    .ConfigurePrimaryHttpMessageHandler(() => Upstream);
                services.AddHttpClient("photon")
                    .ConfigurePrimaryHttpMessageHandler(() => Photon);
                services.AddHttpClient("enlaces")
                    .ConfigurePrimaryHttpMessageHandler(() => Enlaces);
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

    private int PhotonPara(string textoCodificado) =>
        _factory.Photon.Urls.Count(u => u.Contains(textoCodificado));

    private int EnlacesPara(string url) => _factory.Enlaces.Urls.Count(u => u == url);

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
        // Etiqueta estilo Google armada del bloque address (no el display_name crudo).
        Assert.Equal("Av. Lázaro Cárdenas 123, Toluca, México", data[0].GetProperty("nombre").GetString());
        Assert.Equal(19.4326, data[0].GetProperty("latitud").GetDouble(), precision: 6);
        Assert.Equal(-99.1332, data[0].GetProperty("longitud").GetDouble(), precision: 6);
        // Estado y municipio salen del bloque address: alimentan la pestaña del destino.
        Assert.Equal("México", data[0].GetProperty("estado").GetString());
        Assert.Equal("Toluca", data[0].GetProperty("municipio").GetString());

        Assert.Equal(1, UpstreamPara(codificado));
        var indice = _factory.Upstream.Urls.FindIndex(u => u.Contains(codificado));
        var urlUpstream = _factory.Upstream.Urls[indice];
        Assert.StartsWith("https://nominatim.openstreetmap.org/search", urlUpstream);
        Assert.Contains("countrycodes=mx", urlUpstream);
        Assert.Contains("accept-language=es", urlUpstream);
        Assert.Contains("limit=8", urlUpstream);
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
    public async Task Global_con_viewbox_lo_pasa_a_upstream_y_valida_formato()
    {
        var codificado = Uri.EscapeDataString($"cerca {Guid.NewGuid():N}");
        var viewbox = Uri.EscapeDataString("-99.5832,18.9826,-98.6832,19.8826");

        var respuesta = await _client.GetAsync(
            $"/api/viaticos/geocodificar?tipo=global&texto={codificado}&viewbox={viewbox}");
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var indice = _factory.Upstream.Urls.FindIndex(u => u.Contains(codificado));
        Assert.True(indice >= 0);
        Assert.Contains("viewbox=-99.5832,18.9826,-98.6832,19.8826", _factory.Upstream.Urls[indice]);

        // Mismo texto con otro sesgo: el cache los distingue (clave con viewbox).
        var otraCaja = Uri.EscapeDataString("-100.0,19.0,-99.0,20.0");
        var otra = await _client.GetAsync(
            $"/api/viaticos/geocodificar?tipo=global&texto={codificado}&viewbox={otraCaja}");
        Assert.Equal(HttpStatusCode.OK, otra.StatusCode);
        Assert.Equal(2, UpstreamPara(codificado));

        // La misma petición vuelve por cache.
        var repetida = await _client.GetAsync(
            $"/api/viaticos/geocodificar?tipo=global&texto={codificado}&viewbox={viewbox}");
        Assert.Equal(HttpStatusCode.OK, repetida.StatusCode);
        Assert.Equal(2, UpstreamPara(codificado));

        var antes = _factory.Upstream.Urls.Count;
        var invalido = await _client.GetAsync(
            $"/api/viaticos/geocodificar?tipo=global&texto={codificado}&viewbox=abc");
        Assert.Equal(HttpStatusCode.BadRequest, invalido.StatusCode);
        Assert.Equal(antes, _factory.Upstream.Urls.Count);
    }

    [Fact]
    public async Task Global_descarta_resultados_de_otro_pais_y_duplicados_por_coordenada_o_etiqueta()
    {
        var codificado = Uri.EscapeDataString($"filtro {Guid.NewGuid():N}");
        _factory.Upstream.Cuerpo = """
            [
              {"display_name":"San José, Costa Rica","lat":"9.9325","lon":"-84.0800","address":{"city":"San José","country_code":"cr"}},
              {"display_name":"Lázaro Cárdenas, Toluca, México","name":"","lat":"19.4326","lon":"-99.1332","address":{"house_number":"123","road":"Av. Lázaro Cárdenas","city":"Toluca","state":"México","country_code":"mx"}},
              {"display_name":"Lázaro Cárdenas, Toluca, México","name":"","lat":"19.43260","lon":"-99.13320","address":{"house_number":"123","road":"Av. Lázaro Cárdenas","city":"Toluca","state":"México","country_code":"mx"}},
              {"display_name":"Lázaro Cárdenas, Toluca, México","name":"","lat":"19.4400","lon":"-99.2000","address":{"house_number":"123","road":"Av. Lázaro Cárdenas","city":"Toluca","state":"México","country_code":"mx"}}
            ]
            """;
        try
        {
            var respuesta = await _client.GetAsync($"/api/viaticos/geocodificar?tipo=global&texto={codificado}");
            Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
            using var cuerpo = await JsonDocument.ParseAsync(await respuesta.Content.ReadAsStreamAsync());
            var data = cuerpo.RootElement.GetProperty("data");
            // Fuera de México descartado; el duplicado por coordenada redondeada
            // y el de etiqueta idéntica con otras coordenadas también.
            Assert.Equal(1, data.GetArrayLength());
            Assert.Equal("Av. Lázaro Cárdenas 123, Toluca, México", data[0].GetProperty("nombre").GetString());
        }
        finally
        {
            _factory.Upstream.Cuerpo = FakeUpstreamHandler.CuerpoPorDefecto;
        }
    }

    [Fact]
    public async Task Entrada_invalida_responde_400_sin_golpear_upstream()
    {
        var antes = _factory.Upstream.Urls.Count;

        var tipoInvalido = await _client.GetAsync(
            $"/api/viaticos/geocodificar?tipo=otro&texto={Uri.EscapeDataString($"x {Guid.NewGuid():N}")}");
        Assert.Equal(HttpStatusCode.BadRequest, tipoInvalido.StatusCode);

        // tipo=cascada se retiró del producto: ahora también responde 400.
        var cascadaRetirada = await _client.GetAsync(
            $"/api/viaticos/geocodificar?tipo=cascada&estado={Uri.EscapeDataString("México")}&municipio={Uri.EscapeDataString("Toluca")}&texto={Uri.EscapeDataString($"calle {Guid.NewGuid():N}")}");
        Assert.Equal(HttpStatusCode.BadRequest, cascadaRetirada.StatusCode);

        var textoCorto = await _client.GetAsync("/api/viaticos/geocodificar?tipo=global&texto=ab");
        Assert.Equal(HttpStatusCode.BadRequest, textoCorto.StatusCode);

        Assert.Equal(antes, _factory.Upstream.Urls.Count);
    }

    [Fact]
    public async Task Upstream_caido_responde_502_y_no_cachea_el_fallo()
    {
        var codificado = Uri.EscapeDataString($"fallo {Guid.NewGuid():N}");
        _factory.Upstream.Estado = HttpStatusCode.ServiceUnavailable;
        _factory.Photon.Estado = HttpStatusCode.ServiceUnavailable;
        try
        {
            var respuesta = await _client.GetAsync($"/api/viaticos/geocodificar?tipo=global&texto={codificado}");
            Assert.Equal(HttpStatusCode.BadGateway, respuesta.StatusCode);
        }
        finally
        {
            _factory.Upstream.Estado = HttpStatusCode.OK;
            _factory.Photon.Estado = HttpStatusCode.OK;
        }

        var recuperada = await _client.GetAsync($"/api/viaticos/geocodificar?tipo=global&texto={codificado}");
        Assert.Equal(HttpStatusCode.OK, recuperada.StatusCode);
    }

    [Fact]
    public async Task Global_sin_resultados_en_nominatim_cae_a_photon_y_filtra_mexico()
    {
        var codificado = Uri.EscapeDataString($"hospital gen xoco {Guid.NewGuid():N}");
        var caja = Uri.EscapeDataString("-99.5832,18.9826,-98.6832,19.8826");
        // Nominatim no tolera palabras incompletas: devuelve cero resultados.
        _factory.Upstream.Cuerpo = "[]";
        _factory.Photon.Cuerpo = """
            {"features":[
              {"properties":{"countrycode":"MX","name":"Hospital General Xoco","street":"Calle Bruno Traven","locality":"Pedro María Anaya","district":"Benito Juárez","state":"Ciudad de México"},"geometry":{"type":"Point","coordinates":[-99.1624076,19.3603343]}},
              {"properties":{"countrycode":"US","name":"Hospital Xoco USA","street":"Main St","state":"Arizona"},"geometry":{"type":"Point","coordinates":[-110.0,33.0]}},
              {"properties":{"countrycode":"MX","name":"Hospital General Xoco","street":"Calle Bruno Traven","locality":"Pedro María Anaya","district":"Benito Juárez","state":"Ciudad de México"},"geometry":{"type":"Point","coordinates":[-99.1700000,19.3700000]}}
            ]}
            """;
        try
        {
            var respuesta = await _client.GetAsync($"/api/viaticos/geocodificar?tipo=global&texto={codificado}&viewbox={caja}");
            Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
            using var cuerpo = await JsonDocument.ParseAsync(await respuesta.Content.ReadAsStreamAsync());
            var data = cuerpo.RootElement.GetProperty("data");
            // Fuera de México descartado y el duplicado por etiqueta también.
            Assert.Equal(1, data.GetArrayLength());
            Assert.Equal("Hospital General Xoco, Calle Bruno Traven, Pedro María Anaya, Benito Juárez, Ciudad de México",
                data[0].GetProperty("nombre").GetString());
            Assert.Equal(19.3603343, data[0].GetProperty("latitud").GetDouble(), precision: 6);
            Assert.Equal(-99.1624076, data[0].GetProperty("longitud").GetDouble(), precision: 6);
            Assert.Equal("Ciudad de México", data[0].GetProperty("estado").GetString());
            Assert.Equal("Benito Juárez", data[0].GetProperty("municipio").GetString());

            // Nominatim primero; Photon entra como refuerzo con el mismo sesgo.
            Assert.Equal(1, UpstreamPara(codificado));
            Assert.Equal(1, PhotonPara(codificado));
            var indice = _factory.Photon.Urls.FindIndex(u => u.Contains(codificado));
            Assert.True(indice >= 0);
            Assert.StartsWith("https://photon.komoot.io/api", _factory.Photon.Urls[indice]);
            Assert.Contains("bbox=-99.5832,18.9826,-98.6832,19.8826", _factory.Photon.Urls[indice]);
            Assert.Contains("limit=8", _factory.Photon.Urls[indice]);
            Assert.Equal(UserAgentEsperado, _factory.Photon.UserAgents[indice]);

            // Segunda idéntica: sale del cache sin nuevos golpes a ningún motor.
            var repetida = await _client.GetAsync($"/api/viaticos/geocodificar?tipo=global&texto={codificado}&viewbox={caja}");
            Assert.Equal(HttpStatusCode.OK, repetida.StatusCode);
            Assert.Equal(1, UpstreamPara(codificado));
            Assert.Equal(1, PhotonPara(codificado));
        }
        finally
        {
            _factory.Upstream.Cuerpo = FakeUpstreamHandler.CuerpoPorDefecto;
            _factory.Photon.Cuerpo = FakeUpstreamHandler.CuerpoPhotonPorDefecto;
        }
    }

    [Fact]
    public async Task Global_con_nominatim_caido_usa_photon_y_responde_200()
    {
        var codificado = Uri.EscapeDataString($"caido {Guid.NewGuid():N}");
        _factory.Upstream.Estado = HttpStatusCode.ServiceUnavailable;
        try
        {
            var respuesta = await _client.GetAsync($"/api/viaticos/geocodificar?tipo=global&texto={codificado}");
            // Photon (sin resultados por defecto) respondió: 200 vacío, no 502.
            Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
            Assert.Equal(1, PhotonPara(codificado));
            using var cuerpo = await JsonDocument.ParseAsync(await respuesta.Content.ReadAsStreamAsync());
            Assert.True(cuerpo.RootElement.GetProperty("success").GetBoolean());
            Assert.Equal(0, cuerpo.RootElement.GetProperty("data").GetArrayLength());
        }
        finally
        {
            _factory.Upstream.Estado = HttpStatusCode.OK;
        }
    }

    [Fact]
    public async Task Reversa_responde_200_con_direccion_estilo_google_y_cachea()
    {
        _factory.Upstream.Cuerpo = """
            {"lat":"19.4394779","lon":"-99.1331327","display_name":"2, Calle República de Bolivia, Centro, Ciudad de México, 06020, México","address":{"house_number":"2","road":"Calle República de Bolivia","neighbourhood":"Centro","city":"Ciudad de México","state":"Ciudad de México","country_code":"mx"}}
            """;
        try
        {
            var url = "/api/viaticos/geocodificar?tipo=reversa&lat=19.4395&lon=-99.1332";
            var respuesta = await _client.GetAsync(url);
            Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
            using var cuerpo = await JsonDocument.ParseAsync(await respuesta.Content.ReadAsStreamAsync());
            var data = cuerpo.RootElement.GetProperty("data");
            Assert.Equal(1, data.GetArrayLength());
            Assert.Equal("Calle República de Bolivia 2, Centro, Ciudad de México", data[0].GetProperty("nombre").GetString());
            // Las coordenadas pegadas mandan (no las del edificio más cercano).
            Assert.Equal(19.4395, data[0].GetProperty("latitud").GetDouble(), precision: 6);
            Assert.Equal(-99.1332, data[0].GetProperty("longitud").GetDouble(), precision: 6);
            Assert.Equal("Ciudad de México", data[0].GetProperty("estado").GetString());
            Assert.Equal("Ciudad de México", data[0].GetProperty("municipio").GetString());

            var indice = _factory.Upstream.Urls.FindIndex(u => u.Contains("/reverse?") && u.Contains("lat=19.4395"));
            Assert.True(indice >= 0);
            Assert.Contains("lon=-99.1332", _factory.Upstream.Urls[indice]);
            Assert.Contains("addressdetails=1", _factory.Upstream.Urls[indice]);
            Assert.Contains("accept-language=es", _factory.Upstream.Urls[indice]);
            Assert.Equal(UserAgentEsperado, _factory.Upstream.UserAgents[indice]);

            var repetida = await _client.GetAsync(url);
            Assert.Equal(HttpStatusCode.OK, repetida.StatusCode);
            Assert.Equal(1, _factory.Upstream.Urls.Count(u => u.Contains("/reverse?") && u.Contains("lat=19.4395")));
        }
        finally
        {
            _factory.Upstream.Cuerpo = FakeUpstreamHandler.CuerpoPorDefecto;
        }
    }

    [Fact]
    public async Task Reversa_valida_coordenadas_sin_golpear_upstream()
    {
        var antes = _factory.Upstream.Urls.Count;

        Assert.Equal(HttpStatusCode.BadRequest,
            (await _client.GetAsync("/api/viaticos/geocodificar?tipo=reversa&lat=abc&lon=-99.1")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await _client.GetAsync("/api/viaticos/geocodificar?tipo=reversa&lat=95&lon=-99.1")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await _client.GetAsync("/api/viaticos/geocodificar?tipo=reversa&lat=19.4")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await _client.GetAsync("/api/viaticos/geocodificar?tipo=reversa&lat=19.4&lon=200")).StatusCode);

        Assert.Equal(antes, _factory.Upstream.Urls.Count);
    }

    [Fact]
    public async Task Reversa_con_upstream_caido_responde_502()
    {
        _factory.Upstream.Estado = HttpStatusCode.ServiceUnavailable;
        try
        {
            var respuesta = await _client.GetAsync("/api/viaticos/geocodificar?tipo=reversa&lat=20.1234&lon=-98.4321");
            Assert.Equal(HttpStatusCode.BadGateway, respuesta.StatusCode);
        }
        finally
        {
            _factory.Upstream.Estado = HttpStatusCode.OK;
        }
    }

    [Fact]
    public async Task Resolver_liga_sigue_redirecciones_y_cachea()
    {
        var corta = $"https://maps.app.goo.gl/{Guid.NewGuid():N}";
        var final = $"https://www.google.com/maps/place/Hospital/@19.3905,-99.1213,17z?dato={Guid.NewGuid():N}";
        _factory.Enlaces.Respuestas[corta] = (HttpStatusCode.Found, final);
        _factory.Enlaces.Respuestas[final] = (HttpStatusCode.OK, null);
        try
        {
            var codificada = Uri.EscapeDataString(corta);
            var respuesta = await _client.GetAsync($"/api/viaticos/resolver-liga?url={codificada}");
            Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
            using var cuerpo = await JsonDocument.ParseAsync(await respuesta.Content.ReadAsStreamAsync());
            Assert.Equal(new Uri(final).AbsoluteUri, cuerpo.RootElement.GetProperty("data").GetString());
            Assert.Equal(1, EnlacesPara(corta));
            Assert.Equal(1, EnlacesPara(final));

            // La segunda vez sale del cache sin golpear upstream.
            var repetida = await _client.GetAsync($"/api/viaticos/resolver-liga?url={codificada}");
            Assert.Equal(HttpStatusCode.OK, repetida.StatusCode);
            Assert.Equal(1, EnlacesPara(corta));
            Assert.Equal(1, EnlacesPara(final));
        }
        finally
        {
            _factory.Enlaces.Respuestas.Remove(corta);
            _factory.Enlaces.Respuestas.Remove(final);
        }
    }

    [Fact]
    public async Task Resolver_liga_rechaza_hosts_o_esquemas_no_permitidos()
    {
        var antes = _factory.Enlaces.Urls.Count;

        var hostAjeno = await _client.GetAsync(
            $"/api/viaticos/resolver-liga?url={Uri.EscapeDataString("https://evil.example.com/roba")}");
        Assert.Equal(HttpStatusCode.BadRequest, hostAjeno.StatusCode);

        var sinHttps = await _client.GetAsync(
            $"/api/viaticos/resolver-liga?url={Uri.EscapeDataString("http://maps.app.goo.gl/abc")}");
        Assert.Equal(HttpStatusCode.BadRequest, sinHttps.StatusCode);

        var vacia = await _client.GetAsync("/api/viaticos/resolver-liga?url=");
        Assert.Equal(HttpStatusCode.BadRequest, vacia.StatusCode);

        Assert.Equal(antes, _factory.Enlaces.Urls.Count);

        // Redirección hacia un host ajeno: se corta en el primer salto (anti-SSRF).
        var corta = $"https://goo.gl/{Guid.NewGuid():N}";
        _factory.Enlaces.Respuestas[corta] = (HttpStatusCode.Found, "https://evil.example.com/roba");
        try
        {
            var respuesta = await _client.GetAsync(
                $"/api/viaticos/resolver-liga?url={Uri.EscapeDataString(corta)}");
            Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
            Assert.Equal(1, EnlacesPara(corta));
        }
        finally
        {
            _factory.Enlaces.Respuestas.Remove(corta);
        }
    }

    [Fact]
    public async Task Resolver_liga_con_demasiados_saltos_responde_502()
    {
        var corta = $"https://g.co/kgs/{Guid.NewGuid():N}";
        // Se redirige a sí misma: agota el tope de saltos.
        _factory.Enlaces.Respuestas[corta] = (HttpStatusCode.Found, corta);
        try
        {
            var respuesta = await _client.GetAsync(
                $"/api/viaticos/resolver-liga?url={Uri.EscapeDataString(corta)}");
            Assert.Equal(HttpStatusCode.BadGateway, respuesta.StatusCode);
            // Tope de saltos: 6 intentos (MaxSaltos + 1) antes de rendirse.
            Assert.Equal(6, EnlacesPara(corta));
        }
        finally
        {
            _factory.Enlaces.Respuestas.Remove(corta);
        }
    }
}
