using FluentAssertions;
using Lefarma.API.Features.Telemetria;
using Lefarma.API.Features.Telemetria.Cola;
using Lefarma.API.Features.Telemetria.Ingesta;
using Lefarma.API.Features.Telemetria.Modelo;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Lefarma.UnitTests.Features.Telemetria;

public sealed class TelemetriaIngestaTests
{
    private readonly TelemetriaOpciones _opciones = new()
    {
        Habilitada = true,
        ColaMaximaEventos = 100,
        RutasExcluidas = ["/perfil"]
    };

    private readonly TelemetriaCola _cola;
    private readonly TelemetriaIngesta _ingesta;

    public TelemetriaIngestaTests()
    {
        _cola = new TelemetriaCola(Options.Create(_opciones));
        _ingesta = new TelemetriaIngesta(
            Options.Create(_opciones),
            _cola,
            new AtribucionFalsa(),
            new EntornoStub(),
            NullLogger<TelemetriaIngesta>.Instance);
    }

    [Fact]
    public async Task Ingresar_ConSobreValido_EncolaTodosLosEventos()
    {
        var resultado = await _ingesta.IngresarAsync(SobreValido(), Usuario(), anonimo: false);

        resultado.Resultado.Should().Be(ResultadoIngesta.Encolado);
        resultado.Eventos.Should().Be(3);
        _cola.ObtenerEstado().Pendientes.Should().Be(1);
        _cola.TryLeer(out var lote).Should().BeTrue();
        lote.Eventos.Should().HaveCount(3);
        lote.Peticion.UsuarioHash.Should().NotBeNullOrWhiteSpace();
        lote.Peticion.UsuarioHash.Should().NotContain("42");
        lote.Peticion.Rol.Should().Be("Administrador");
        lote.Peticion.Entorno.Should().Be("Development");
    }

    [Fact]
    public async Task Ingresar_ConRutaExcluida_OmiteClicsPeroConservaErrores()
    {
        var sobre = new SobreTelemetriaDto
        {
            LoteId = "lote-perfil",
            EnviadoEn = DateTime.UtcNow,
            Eventos =
            [
                EventoError("/perfil", "js", "boom"),
                EventoClic("/perfil", "btn-cerrar")
            ]
        };

        var resultado = await _ingesta.IngresarAsync(sobre, Usuario(), anonimo: false);

        resultado.Eventos.Should().Be(1);
        _cola.TryLeer(out var lote).Should().BeTrue();
        lote.Eventos.Should().ContainSingle(evento => evento is EventoError);
    }

    [Fact]
    public async Task Ingresar_AnonimoConClic_RechazaElLote()
    {
        var sobre = new SobreTelemetriaDto
        {
            LoteId = "lote-anon-clic",
            EnviadoEn = DateTime.UtcNow,
            Eventos = [EventoClic("/hub", "btn")]
        };

        var resultado = await _ingesta.IngresarAsync(sobre, null, anonimo: true);

        resultado.Resultado.Should().Be(ResultadoIngesta.Rechazado);
        _cola.ObtenerEstado().Pendientes.Should().Be(0);
    }

    [Fact]
    public async Task Ingresar_AnonimoConErrorDeArranque_EncolaSinUsuario()
    {
        var sobre = new SobreTelemetriaDto
        {
            LoteId = "lote-anon-error",
            EnviadoEn = DateTime.UtcNow,
            Eventos = [EventoError("/login", "arranque", "El bundle no cargó")]
        };

        var resultado = await _ingesta.IngresarAsync(sobre, null, anonimo: true);

        resultado.Resultado.Should().Be(ResultadoIngesta.Encolado);
        _cola.TryLeer(out var lote).Should().BeTrue();
        lote.Peticion.UsuarioHash.Should().BeNull();
        lote.Peticion.Rol.Should().BeNull();
    }

    [Fact]
    public async Task Ingresar_ConColaLlena_DevuelveNoDisponibleYCuentaElDescarte()
    {
        var opciones = new TelemetriaOpciones { Habilitada = true, ColaMaximaEventos = 1 };
        var cola = new TelemetriaCola(Options.Create(opciones));
        var ingesta = new TelemetriaIngesta(
            Options.Create(opciones),
            cola,
            new AtribucionFalsa(),
            new EntornoStub(),
            NullLogger<TelemetriaIngesta>.Instance);

        (await ingesta.IngresarAsync(SobreValido(), Usuario(), anonimo: false))
            .Resultado.Should().Be(ResultadoIngesta.Encolado);

        var segundo = await ingesta.IngresarAsync(SobreValido(), Usuario(), anonimo: false);

        segundo.Resultado.Should().Be(ResultadoIngesta.NoDisponible);
        cola.ObtenerEstado().Descartados.Should().BeGreaterThan(0);
    }

    [Fact]
    public void Huella_EsEstableYNoDependeDeDetallesVolatiles()
    {
        var primera = HuellaTelemetria.Calcular("js", "Cannot read properties of undefined", "at a (app.js:1:2)", "/hub");
        var segunda = HuellaTelemetria.Calcular("js", "Cannot read properties of undefined", "at a (app.js:1:2)", "/hub");

        primera.Should().Be(segunda);
        primera.Should().HaveLength(16);
        HuellaTelemetria.Calcular("js", "otro mensaje", null, "/hub").Should().NotBe(primera);
    }

    private static SobreTelemetriaDto SobreValido() => new()
    {
        LoteId = "lote-valido",
        EnviadoEn = DateTime.UtcNow,
        VisitaId = "visita-1",
        VersionApp = "1.13.0",
        Eventos =
        [
            EventoError("/viaticos/mis-viajes", "js", "boom"),
            EventoClic("/viaticos/mis-viajes", "btn-nuevo"),
            new EventoTelemetriaDto
            {
                Tipo = "mapa_calor",
                OcurridoEn = DateTime.UtcNow,
                Ruta = "/viaticos/mis-viajes",
                Celdas = [0, 1, 2, 0, 3, 0],
                Columnas = 3,
                Filas = 2,
                TamanoCelda = 32,
                ViewportAncho = 1440,
                ViewportAlto = 900
            }
        ]
    };

    private static EventoTelemetriaDto EventoError(string ruta, string tipoError, string mensaje) => new()
    {
        Tipo = "error",
        OcurridoEn = DateTime.UtcNow,
        Ruta = ruta,
        TipoError = tipoError,
        Mensaje = mensaje
    };

    private static EventoTelemetriaDto EventoClic(string ruta, string elemento) => new()
    {
        Tipo = "clic",
        OcurridoEn = DateTime.UtcNow,
        Ruta = ruta,
        Elemento = elemento,
        X = 10,
        Y = 20,
        ViewportAncho = 1440,
        ViewportAlto = 900
    };

    private static System.Security.Claims.ClaimsPrincipal Usuario()
    {
        var identidad = new System.Security.Claims.ClaimsIdentity(
        [
            new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.NameIdentifier, "42"),
            new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Name, "Prueba"),
            new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, "Administrador")
        ], "Prueba");

        return new System.Security.Claims.ClaimsPrincipal(identidad);
    }

    private sealed class AtribucionFalsa : IAtribucionUsuario
    {
        public Task<string?> ObtenerHashAsync(string? identificador, CancellationToken ct = default) =>
            Task.FromResult(identificador is null ? null : new string('h', 32));
    }

    private sealed class EntornoStub : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";

        public string ApplicationName { get; set; } = "Lefarma.UnitTests";

        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
