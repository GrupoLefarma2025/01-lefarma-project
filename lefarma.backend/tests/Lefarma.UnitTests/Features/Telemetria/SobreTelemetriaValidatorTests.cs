using FluentAssertions;
using Lefarma.API.Features.Telemetria;
using Lefarma.API.Features.Telemetria.Ingesta;
using Microsoft.Extensions.Options;

namespace Lefarma.UnitTests.Features.Telemetria;

public sealed class SobreTelemetriaValidatorTests
{
    private readonly SobreTelemetriaValidator _validador =
        new(Options.Create(new TelemetriaOpciones { LoteMaximoEventos = 100 }));

    private readonly EventoTelemetriaValidator _validadorEvento = new();

    [Fact]
    public void Validar_SobreCompleto_EsValido()
    {
        _validador.Validate(Sobre()).IsValid.Should().BeTrue();
        _validador.Validate(Sobre()).Errors.Should().BeEmpty();
    }

    [Fact]
    public void Validar_LoteIdConEspacios_DevuelveError()
    {
        var sobre = Sobre();
        sobre.LoteId = "lote con espacios";

        var resultado = _validador.Validate(sobre);

        resultado.IsValid.Should().BeFalse();
        resultado.Errors.Should().Contain(error => error.PropertyName == "LoteId");
    }

    [Fact]
    public void Validar_MasEventosQueElMaximo_DevuelveError()
    {
        var sobre = Sobre();
        sobre.Eventos = Enumerable.Range(0, 101).Select(_ => ErrorDto()).ToList();

        var resultado = _validador.Validate(sobre);

        resultado.IsValid.Should().BeFalse();
        resultado.Errors.Should().Contain(error => error.PropertyName == "Eventos");
    }

    [Fact]
    public void Validar_TipoDeEventoDesconocido_DevuelveError()
    {
        var evento = ErrorDto();
        evento.Tipo = "video";

        var resultado = _validadorEvento.Validate(evento);

        resultado.IsValid.Should().BeFalse();
        resultado.Errors.Should().Contain(error => error.PropertyName == "Tipo");
    }

    [Fact]
    public void Validar_RutaSinDiagonalInicial_DevuelveError()
    {
        var evento = ErrorDto();
        evento.Ruta = "viaticos/mis-viajes";

        var resultado = _validadorEvento.Validate(evento);

        resultado.IsValid.Should().BeFalse();
        resultado.Errors.Should().Contain(error => error.PropertyName == "Ruta");
    }

    [Fact]
    public void Validar_RejillaQueNoCoincide_DevuelveError()
    {
        var evento = new EventoTelemetriaDto
        {
            Tipo = "mapa_calor",
            OcurridoEn = DateTime.UtcNow,
            Ruta = "/viaticos/mis-viajes",
            Celdas = [0, 1, 2, 0],
            Columnas = 3,
            Filas = 2,
            TamanoCelda = 32,
            ViewportAncho = 1440,
            ViewportAlto = 900
        };

        var resultado = _validadorEvento.Validate(evento);

        resultado.IsValid.Should().BeFalse();
        resultado.Errors.Should().Contain(error => error.PropertyName == "Celdas");
    }

    private static SobreTelemetriaDto Sobre() => new()
    {
        LoteId = "lote-valido",
        EnviadoEn = DateTime.UtcNow,
        VisitaId = "visita-1",
        VersionApp = "1.13.0",
        Eventos = [ErrorDto()]
    };

    private static EventoTelemetriaDto ErrorDto() => new()
    {
        Tipo = "error",
        OcurridoEn = DateTime.UtcNow,
        Ruta = "/viaticos/mis-viajes",
        TipoError = "js",
        Mensaje = "boom"
    };
}
