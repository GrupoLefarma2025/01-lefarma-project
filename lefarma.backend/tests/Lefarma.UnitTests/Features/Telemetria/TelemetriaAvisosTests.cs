using FluentAssertions;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Features.Telemetria.Avisos;
using Lefarma.API.Features.Telemetria.Consulta;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;

namespace Lefarma.UnitTests.Features.Telemetria;

public sealed class TelemetriaAvisosTests : IDisposable
{
    private readonly Mock<INotificationService> _correo = new();
    private readonly ConsultaFalsa _consulta = new();
    private readonly ServiceProvider _servicios;

    public TelemetriaAvisosTests()
    {
        _correo
            .Setup(servicio => servicio.SendAsync(It.IsAny<SendNotificationRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SendNotificationResponse { NotificationId = 1, CreatedAt = DateTime.UtcNow });

        var coleccion = new ServiceCollection();
        coleccion.AddSingleton(_correo.Object);
        coleccion.AddSingleton<ITelemetriaConsulta>(_consulta);
        _servicios = coleccion.BuildServiceProvider();
    }

    [Fact]
    public async Task ProcesarAsyncConHuellaNueva_EnviaUnAviso()
    {
        _consulta.Nuevas.Add(Huella("huella-repetida", "falla que se repite"));

        await CrearAvisos().ProcesarAsync(DateTime.Now.Date.AddHours(10), CancellationToken.None);

        _correo.Verify(
            servicio => servicio.SendAsync(It.IsAny<SendNotificationRequest>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ProcesarAsyncSinHuellas_NoEnviaNada()
    {
        await CrearAvisos().ProcesarAsync(DateTime.Now.Date.AddHours(10), CancellationToken.None);

        _correo.Verify(
            servicio => servicio.SendAsync(It.IsAny<SendNotificationRequest>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ProcesarAsync_MismaHuellaDosVeces_SoloAvisaUnaVez()
    {
        _consulta.Nuevas.Add(Huella("huella-repetida", "falla que se repite"));
        var avisos = CrearAvisos();

        await avisos.ProcesarAsync(DateTime.Now.Date.AddHours(10), CancellationToken.None);
        await avisos.ProcesarAsync(DateTime.Now.Date.AddHours(11), CancellationToken.None);

        _correo.Verify(
            servicio => servicio.SendAsync(It.IsAny<SendNotificationRequest>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ProcesarAsync_PideElMinimoDeRepeticionesConfigurado()
    {
        await CrearAvisos(new TelemetriaAvisosOpciones
        {
            Habilitado = true,
            Destinatarios = ["avisos@lefarma.test"],
            HoraResumen = 23,
            RepeticionesAlerta = 4
        }).ProcesarAsync(DateTime.Now.Date.AddHours(10), CancellationToken.None);

        _consulta.UltimoMinimo.Should().Be(4);
    }

    [Fact]
    public async Task ProcesarAsync_HoraDelResumen_EnviaElResumenUnaVezAlDia()
    {
        var avisos = CrearAvisos(new TelemetriaAvisosOpciones
        {
            Habilitado = true,
            Destinatarios = ["avisos@lefarma.test"],
            HoraResumen = 8
        });

        var ahora = DateTime.Now.Date.AddHours(9);
        await avisos.ProcesarAsync(ahora, CancellationToken.None);
        await avisos.ProcesarAsync(ahora.AddHours(1), CancellationToken.None);

        _correo.Verify(
            servicio => servicio.SendAsync(It.IsAny<SendNotificationRequest>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public void ConstruirAlerta_IncluyeMensajeRutaYUsuarios()
    {
        var huella = new HuellaErrorResumen(
            "huella-1", "js", "no se pudo guardar", "/viaticos/mis-viajes",
            5, 2, DateTime.UtcNow.AddMinutes(-3), DateTime.UtcNow);

        var texto = TelemetriaAvisos.ConstruirAlerta(huella, 10);

        texto.Should().Contain("no se pudo guardar");
        texto.Should().Contain("/viaticos/mis-viajes");
        texto.Should().Contain("Usuarios afectados: 2");
        texto.Should().Contain("5 veces");
    }

    [Fact]
    public async Task ExecuteAsync_SinDestinatarios_TerminaSinEnviar()
    {
        var avisos = CrearAvisos(new TelemetriaAvisosOpciones { Habilitado = true, Destinatarios = [] });

        await avisos.StartAsync(CancellationToken.None);
        await avisos.StopAsync(CancellationToken.None);

        _correo.Verify(
            servicio => servicio.SendAsync(It.IsAny<SendNotificationRequest>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    public void Dispose()
    {
        _servicios.Dispose();
        GC.SuppressFinalize(this);
    }

    private TelemetriaAvisos CrearAvisos(TelemetriaAvisosOpciones? opciones = null) => new(
        _servicios.GetRequiredService<IServiceScopeFactory>(),
        Options.Create(opciones ?? new TelemetriaAvisosOpciones
        {
            Habilitado = true,
            Destinatarios = ["avisos@lefarma.test"],
            HoraResumen = 23,
            RepeticionesAlerta = 3
        }),
        NullLogger<TelemetriaAvisos>.Instance);

    private static HuellaErrorResumen Huella(string huella, string mensaje) => new(
        huella,
        "js",
        mensaje,
        "/viaticos/mis-viajes",
        3,
        1,
        DateTime.UtcNow.AddMinutes(-5),
        DateTime.UtcNow);

    private sealed class ConsultaFalsa : ITelemetriaConsulta
    {
        public List<HuellaErrorResumen> Nuevas { get; } = [];

        public int UltimoMinimo { get; private set; }

        public Task<ResumenTelemetria> ObtenerResumenAsync(DateTime desde, DateTime hasta, long descartados, int maximos, CancellationToken cancellationToken) =>
            Task.FromResult(new ResumenTelemetria(3, 12, 40, 2, descartados, [], []));

        public Task<IReadOnlyList<HuellaErrorResumen>> ObtenerErroresAsync(string? texto, DateTime desde, DateTime hasta, int maximo, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<HuellaErrorResumen>>(Nuevas);

        public Task<IReadOnlyList<OcurrenciaError>> ObtenerOcurrenciasAsync(string huella, int pagina, int tamano, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<OcurrenciaError>>([]);

        public Task<IReadOnlyList<BotonResumen>> ObtenerBotonesAsync(string? ruta, DateTime desde, DateTime hasta, int maximo, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<BotonResumen>>([]);

        public Task<MapaCalorResumen?> ObtenerMapaCalorAsync(string ruta, DateTime desde, DateTime hasta, int? viewportAncho, CancellationToken cancellationToken) =>
            Task.FromResult<MapaCalorResumen?>(null);

        public Task<IReadOnlyList<RutaResumen>> ObtenerRutasAsync(DateTime desde, DateTime hasta, int maximo, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<RutaResumen>>([]);

        public Task<IReadOnlyList<HuellaErrorResumen>> ObtenerHuellasNuevasAsync(DateTime desde, int minimo, int maximo, CancellationToken cancellationToken)
        {
            UltimoMinimo = minimo;
            return Task.FromResult<IReadOnlyList<HuellaErrorResumen>>(Nuevas.Take(maximo).ToList());
        }
    }
}
