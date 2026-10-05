using FluentAssertions;
using Lefarma.API.Features.Viaticos;
using Lefarma.API.Features.Viaticos.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Formatters;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using System.Text;
using System.Text.Json;
using Lefarma.API.Shared.Models;

namespace Lefarma.UnitTests.Features.Viaticos;

public class CostosRutaServiceTests
{
    // Verbatim payload from the previous editable demo (no DTO construction).
    private const string OriginalSnakePayload = """
    {"personas":[{"nombre":"Ana","carro_propio":true,"gasolina":"magna","draft":true,
    "trabajo":{"hora_entrada":"08:00","hora_salida":"18:30","primer_dia_laboral":1,"ultimo_dia_laboral":5},
    "lugares":[{"orden":1,"tipo":"salida","nombre":"CDMX base","latitud":19.4326,"longitud":-99.1332,
    "fecha_salida":"2026-10-15","hora_salida":"06:00"},
    {"orden":2,"tipo":"taller","nombre":"Taller Puebla 1","latitud":19.0414,"longitud":-98.2063,
    "fecha_inicio_actividad":"2026-10-15","hora_inicio_actividad":"10:00","fecha_fin_actividad":"2026-10-15","hora_fin_actividad":"14:00"},
    {"orden":3,"tipo":"taller","nombre":"Taller Puebla 2","latitud":19.052,"longitud":-98.21,
    "fecha_inicio_actividad":"2026-10-16","hora_inicio_actividad":"09:00","fecha_fin_actividad":"2026-10-16","hora_fin_actividad":"12:00"}]}]}
    """;

    // Match the MVC registration in Program.cs without starting the app or its database services.
    private static ServiceProvider CreateMvcServices()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddControllers().AddJsonOptions(options =>
            options.JsonSerializerOptions.PropertyNameCaseInsensitive = true);
        return services.BuildServiceProvider();
    }

    private static readonly JsonSerializerOptions MvcJson = GetMvcJson();

    private static JsonSerializerOptions GetMvcJson()
    {
        using var services = CreateMvcServices();
        return services.GetRequiredService<IOptions<Microsoft.AspNetCore.Mvc.JsonOptions>>().Value.JsonSerializerOptions;
    }

    private static async Task<CostosRutaRequest> ReadMvcBody(string json)
    {
        using var services = CreateMvcServices();
        var formatter = services.GetRequiredService<IOptions<MvcOptions>>().Value.InputFormatters
            .OfType<SystemTextJsonInputFormatter>().Single();
        var context = new DefaultHttpContext();
        context.Request.ContentType = "application/json; charset=utf-8";
        using var body = new MemoryStream(Encoding.UTF8.GetBytes(json));
        context.Request.Body = body;
        context.Request.ContentLength = body.Length;
        var metadata = services.GetRequiredService<IModelMetadataProvider>().GetMetadataForType(typeof(CostosRutaRequest));
        var input = new InputFormatterContext(context, string.Empty, new ModelStateDictionary(), metadata,
            (stream, encoding) => new StreamReader(stream, encoding));
        var result = await formatter.ReadAsync(input);
        result.HasError.Should().BeFalse();
        return result.Model.Should().BeOfType<CostosRutaRequest>().Subject;
    }

    [Fact]
    public async Task Omitted_Work_Hours_Use_Approved_Defaults_Through_Mvc()
    {
        var wire = OriginalSnakePayload.Replace("\"hora_entrada\":\"08:00\",\"hora_salida\":\"18:30\",", string.Empty);
        var request = await ReadMvcBody(wire);
        request.Personas.Single().Trabajo!.HoraEntrada.Should().Be("08:00");
        request.Personas.Single().Trabajo!.HoraSalida.Should().Be("18:30");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Mvc_Input_Formatter_Binds_Full_Payload_And_Controller_Calculates(bool camelCase)
    {
        var wire = camelCase
            ? System.Text.RegularExpressions.Regex.Replace(OriginalSnakePayload, "_([a-z])", m => m.Groups[1].Value.ToUpperInvariant())
            : OriginalSnakePayload;
        var request = await ReadMvcBody(wire);
        var person = request.Personas.Single();
        person.CarroPropio.Should().BeTrue();
        person.Trabajo!.HoraEntrada.Should().Be("08:00");
        person.Trabajo.HoraSalida.Should().Be("18:30");
        person.Lugares[0].FechaSalida.Should().Be("2026-10-15");
        person.Lugares[0].HoraSalida.Should().Be("06:00");
        person.Lugares[1].FechaInicioActividad.Should().Be("2026-10-15");
        person.Lugares[1].HoraInicioActividad.Should().Be("10:00");
        person.Lugares[1].FechaFinActividad.Should().Be("2026-10-15");
        person.Lugares[1].HoraFinActividad.Should().Be("14:00");
        person.Lugares[2].FechaInicioActividad.Should().Be("2026-10-16");
        person.Lugares[2].HoraInicioActividad.Should().Be("09:00");
        person.Lugares[2].FechaFinActividad.Should().Be("2026-10-16");
        person.Lugares[2].HoraFinActividad.Should().Be("12:00");
        using var handler = new FallaTodoHandler();
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var controller = new CostosRutaController(new FabricaFake(handler), cache);
        var result = (await controller.Calcular(request)).Should().BeOfType<OkObjectResult>().Subject;
        result.StatusCode.Should().Be(200);
        result.Value.Should().BeOfType<ApiResponse<CostosRutaResponse>>().Subject.Success.Should().BeTrue();
    }

    [Fact]
    public async Task Original_Snake_Payload_Binds_And_Calculates_Through_Controller()
    {
        var request = JsonSerializer.Deserialize<CostosRutaRequest>(OriginalSnakePayload, MvcJson)!;
        request.Personas[0].CarroPropio.Should().BeTrue();
        request.Personas[0].Trabajo!.HoraEntrada.Should().Be("08:00");
        request.Personas[0].Trabajo!.HoraSalida.Should().Be("18:30");
        request.Personas[0].Lugares[1].FechaInicioActividad.Should().Be("2026-10-15");
        using var handler = new FallaTodoHandler();
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var controller = new CostosRutaController(new FabricaFake(handler), cache);
        var result = (await controller.Calcular(request)).Should().BeOfType<OkObjectResult>().Subject;
        var response = result.Value.Should().BeOfType<ApiResponse<CostosRutaResponse>>().Subject;
        response.Success.Should().BeTrue();
        response.Data!.Propuestas.Should().HaveCount(6);
        // draft:true may insert an overnight stop; retain the calculator's behavior.
        response.Data.Resultados[0].Tramos.Should().HaveCount(response.Data.Resultados[0].Propuesta.Lugares.Count - 1);
        response.Data.Resultados[0].Tramos.Count.Should().BeGreaterThanOrEqualTo(2);
        var destination = response.Data.Resultados[0].Propuesta.Lugares.First(l => Equals(l["nombre"], "Taller Puebla 1"));
        destination["fecha_inicio_actividad"].Should().Be("2026-10-15");
        destination["hora_inicio_actividad"].Should().Be("10:00");
        foreach (var leg in response.Data.Resultados[0].RutaArmada.Tramos)
            leg.Litros.Should().BeApproximately(leg.Km / 12, 0.01);
        var json = JsonSerializer.Serialize(response.Data, MvcJson);
        json.Should().Contain("\"rutaArmada\"").And.Contain("\"hotelesPropuestos\"");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task All_Multiword_Fields_Bind_Nondefault_Values(bool camelCase)
    {
        const string json = """
        {"opciones":{"respetarHorarioLaboral":false,"calcularHoteles":false,"calcularViajesIntermedios":false,"compartirViaje":true,"rendimientoKmL":99},
        "personas":[{"nombre":"Wire","carro_propio":true,"gasolina":"premium","draft":true,
        "trabajo":{"hora_entrada":"07:15","hora_salida":"19:45","primer_dia_laboral":2,"ultimo_dia_laboral":6},
        "lugares":[{"orden":1,"tipo":"salida","nombre":"Origin","latitud":20.1,"longitud":-100.2,
        "fecha_salida":"2026-10-20","hora_salida":"05:45","fecha_llegada":"2026-10-21","hora_llegada":"06:15",
        "fecha_limite_llegada":"2026-10-22","hora_limite_llegada":"07:45",
        "fecha_inicio_actividad":"2026-10-23","hora_inicio_actividad":"08:15",
        "fecha_fin_actividad":"2026-10-24","hora_fin_actividad":"19:15"}]}]}
        """;
        var wire = camelCase ? System.Text.RegularExpressions.Regex.Replace(json, "_([a-z])", m => m.Groups[1].Value.ToUpperInvariant()) : json;
        var request = await ReadMvcBody(wire);
        request.Opciones.Should().BeEquivalentTo(new CostosRutaOpcionesInput
        {
            RespetarHorarioLaboral = false, CalcularHoteles = false, CalcularViajesIntermedios = false,
            CompartirViaje = true, RendimientoKmL = 99,
        });
        var person = request.Personas.Single();
        person.CarroPropio.Should().BeTrue();
        person.Gasolina.Should().Be("premium");
        person.Draft.Should().BeTrue();
        person.Trabajo.Should().BeEquivalentTo(new CostosRutaTrabajoInput
        {
            HoraEntrada = "07:15", HoraSalida = "19:45", PrimerDiaLaboral = 2, UltimoDiaLaboral = 6,
        });
        person.Lugares.Single().Should().BeEquivalentTo(new CostosRutaLugarInput
        {
            Orden = 1, Tipo = "salida", Nombre = "Origin", Latitud = 20.1, Longitud = -100.2,
            FechaSalida = "2026-10-20", HoraSalida = "05:45", FechaLlegada = "2026-10-21", HoraLlegada = "06:15",
            FechaLimiteLlegada = "2026-10-22", HoraLimiteLlegada = "07:45",
            FechaInicioActividad = "2026-10-23", HoraInicioActividad = "08:15",
            FechaFinActividad = "2026-10-24", HoraFinActividad = "19:15",
        });
    }

    [Fact]
    public async Task Missing_Activity_Date_Still_Returns_400()
    {
        var wire = OriginalSnakePayload.Replace("\"fecha_inicio_actividad\":\"2026-10-15\",", string.Empty);
        var request = await ReadMvcBody(wire);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        using var handler = new FallaTodoHandler();
        var controller = new CostosRutaController(new FabricaFake(handler), cache);
        var result = (await controller.Calcular(request)).Should().BeOfType<BadRequestObjectResult>().Subject;
        result.StatusCode.Should().Be(400);
        result.Value.Should().BeOfType<ApiResponse<object>>().Subject.Message
            .Should().Be("Persona 1 (Ana) lugar 2: el taller necesita fecha/hora de inicio.");
    }

    [Theory]
    [InlineData("08:00", "18:30")]
    [InlineData("07:15", "19:45")]
    public async Task Form_Wire_Preserves_Full_Day_Derived_Departure_Sharing_And_Fixed12(string start, string end)
    {
        var wire = $$"""
        {"opciones":{"respetarHorarioLaboral":true,"calcularHoteles":false,"calcularViajesIntermedios":false,"compartirViaje":true,"rendimientoKmL":99},
        "personas":[{"nombre":"Ana","carro_propio":true,"gasolina":"premium","draft":false,
        "trabajo":{"hora_entrada":"{{start}}","hora_salida":"{{end}}","primer_dia_laboral":1,"ultimo_dia_laboral":5},
        "lugares":[{"orden":1,"tipo":"salida","nombre":"Base fixture","latitud":19.4326,"longitud":-99.1332},
        {"orden":2,"tipo":"taller","nombre":"Branch fixture","latitud":19.0414,"longitud":-98.2063,
        "fecha_inicio_actividad":"2026-10-15","hora_inicio_actividad":"{{start}}","fecha_fin_actividad":"2026-10-15","hora_fin_actividad":"{{end}}"}]}]}
        """;
        var request = JsonSerializer.Deserialize<CostosRutaRequest>(wire, MvcJson)!;
        var clone = JsonSerializer.Deserialize<CostosRutaRequest>(wire.Replace("\"Ana\"", "\"Beto\""), MvcJson)!.Personas[0];
        request.Personas.Add(clone);
        using var handler = new FallaTodoHandler();
        using var http = new HttpClient(handler);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var response = await CalculoCostosRuta.CalcularAsync(request, http, cache);
        response.Resultados.Should().HaveCount(2);
        response.Propuestas.Should().HaveCount(12);
        response.Compartidos.Should().NotBeEmpty();
        foreach (var result in response.Resultados)
        {
            result.Gasolina.Should().Be("premium");
            result.Propuesta.Lugares.Should().HaveCount(2);
            var origin = result.Propuesta.Lugares[0];
            var destination = result.Propuesta.Lugares[1];
            destination["fecha_inicio_actividad"].Should().Be("2026-10-15");
            destination["fecha_fin_actividad"].Should().Be("2026-10-15");
            destination["hora_inicio_actividad"].Should().Be(start);
            destination["hora_fin_actividad"].Should().Be(end);
            origin["fecha_salida"].Should().NotBeNull();
            origin["hora_salida"].Should().NotBe("06:00");
            result.HotelesPropuestos.Should().BeEmpty();
            result.Tramos.Single().Opciones.Should().Contain(option => option.Modo == "auto");
            var leg = result.RutaArmada.Tramos.Single();
            leg.Litros.Should().BeApproximately(leg.Km / 12, 0.01);
        }
    }

    // Handler que falla todas las llamadas externas: fuerza los fallbacks a
    // seed dentro de CalculoCostosRuta (equivale a los stubs anteriores).
    private sealed class FallaTodoHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.InternalServerError));
    }

    private sealed class FabricaFake : IHttpClientFactory
    {
        private readonly HttpMessageHandler _handler;
        public FabricaFake(HttpMessageHandler handler) => _handler = handler;
        public HttpClient CreateClient(string name) => new(_handler, disposeHandler: false);
    }

    private static (HttpClient Http, IMemoryCache Cache) Infra()
        => (new HttpClient(new FallaTodoHandler()), new MemoryCache(new MemoryCacheOptions()));

    private static CostosRutaPersonaInput Ana() => new()
    {
        Nombre = "Ana",
        CarroPropio = true,
        Gasolina = "magna",
        Draft = false,
        Trabajo = new CostosRutaTrabajoInput
        {
            HoraEntrada = "08:00", HoraSalida = "18:30", PrimerDiaLaboral = 1, UltimoDiaLaboral = 5,
        },
        Lugares =
        [
            new CostosRutaLugarInput
            {
                Orden = 1, Tipo = "salida", Nombre = "CDMX base",
                Latitud = 19.4326, Longitud = -99.1332,
                FechaSalida = "2026-10-15", HoraSalida = "06:00",
            },
            new CostosRutaLugarInput
            {
                Orden = 2, Tipo = "taller", Nombre = "Taller Puebla 1",
                Latitud = 19.0414, Longitud = -98.2063,
                FechaInicioActividad = "2026-10-15", HoraInicioActividad = "10:00",
                FechaFinActividad = "2026-10-15", HoraFinActividad = "14:00",
            },
            new CostosRutaLugarInput
            {
                Orden = 3, Tipo = "taller", Nombre = "Taller Puebla 2",
                Latitud = 19.0520, Longitud = -98.2100,
                FechaInicioActividad = "2026-10-16", HoraInicioActividad = "09:00",
                FechaFinActividad = "2026-10-16", HoraFinActividad = "12:00",
            },
        ],
    };

    [Fact]
    public async Task Ana_Cdmx_Puebla_200_Y_Totales_Coherentes()
    {
        var (http, cache) = Infra();
        var resp = await CalculoCostosRuta.CalcularAsync(new CostosRutaRequest
        {
            Opciones = new CostosRutaOpcionesInput(),
            Personas = [Ana()],
        }, http, cache);

        resp.Resultados.Should().HaveCount(1);
        var r = resp.Resultados[0];
        r.Tramos.Should().HaveCount(2);
        resp.Propuestas.Should().HaveCount(6);
        resp.Propuestas.Select(p => p.Clave).Should().BeEquivalentTo(
            ["barata", "rapida", "equilibrada", "tipo1-carro", "tipo2-bus", "tipo3-avion"]);
        resp.Categorias.Should().HaveCount(9);

        // Totales coherentes: subtotal = litros * precio + casetas (magna 23.5 seed).
        foreach (var t in r.RutaArmada.Tramos)
        {
            t.Litros.Should().BeApproximately(t.Km / 12.0, 0.01);
            t.Gasolina.Magna.PrecioL.Should().Be(23.5);
            t.SubtotalMagna.Should().BeApproximately(t.Litros * 23.5 + t.Casetas.Costo, 0.6);
            t.SubtotalPremium.Should().BeApproximately(t.Litros * 25.5 + t.Casetas.Costo, 0.6);
        }
        r.RutaArmada.Totales.SubtotalMagna.Should().BeApproximately(
            r.RutaArmada.Tramos.Sum(t => t.SubtotalMagna), 0.01);
        r.RutaArmada.Totales.SubtotalPremium.Should().BeApproximately(
            r.RutaArmada.Tramos.Sum(t => t.SubtotalPremium), 0.01);
    }

    [Fact]
    public async Task Personas_Vacias_Lanza_400()
    {
        var controller = new CostosRutaController(new FabricaFake(new FallaTodoHandler()), new MemoryCache(new MemoryCacheOptions()));
        var result = await controller.Calcular(new CostosRutaRequest
        {
            Opciones = new CostosRutaOpcionesInput(),
            Personas = [],
        });
        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Xalapa_Puebla_Leon_Documenta_Seeds()
    {
        // Expected con seeds (sin red: OSRM = hav*1.25, gasolina 23.5/25.5, caseta ~1.4/km):
        // XAL→PUE ~230 km carretera, PUE→BJX ~480 km (aérea >300 → incluye avión).
        var (http, cache) = Infra();
        CostosRutaPersonaInput Persona() => new()
        {
            Nombre = "Beto",
            CarroPropio = false,
            Gasolina = "magna",
            Draft = false,
            Lugares =
            [
                new CostosRutaLugarInput
                {
                    Orden = 1, Tipo = "salida", Nombre = "Xalapa base",
                    Latitud = 19.5438, Longitud = -96.9102,
                    FechaSalida = "2026-10-20", HoraSalida = "05:00",
                },
                new CostosRutaLugarInput
                {
                    Orden = 2, Tipo = "taller", Nombre = "Taller Puebla",
                    Latitud = 19.0414, Longitud = -98.2063,
                    FechaInicioActividad = "2026-10-20", HoraInicioActividad = "12:00",
                    FechaFinActividad = "2026-10-20", HoraFinActividad = "16:00",
                },
                new CostosRutaLugarInput
                {
                    Orden = 3, Tipo = "taller", Nombre = "Taller León",
                    Latitud = 21.1214, Longitud = -101.6830,
                    FechaInicioActividad = "2026-10-21", HoraInicioActividad = "10:00",
                    FechaFinActividad = "2026-10-21", HoraFinActividad = "13:00",
                },
            ],
        };
        var resp = await CalculoCostosRuta.CalcularAsync(new CostosRutaRequest { Personas = [Persona()] }, http, cache);

        resp.Resultados.Should().HaveCount(1);
        resp.Resultados[0].Tramos.Should().HaveCount(2);
        // Sin carro propio: tramo sin auto propio, pero sí renta/bus.
        resp.Resultados[0].Tramos[0].Opciones.Should().NotContain(o => o.Modo == "auto");
        resp.Resultados[0].Tramos[0].Opciones.Should().Contain(o => o.Modo == "bus");
        // PUE→BJX supera 300 km aéreos: hay avión estimado.
        resp.Resultados[0].Tramos[1].Opciones.Should().Contain(o => o.Modo == "avion" && o.Estimado);
        resp.Propuestas.Should().HaveCount(6);
        var tipo3 = resp.Propuestas.First(p => p.Clave == "tipo3-avion");
        tipo3.Tramos.Should().Contain(t => t.Modo == "avion");
    }
}
