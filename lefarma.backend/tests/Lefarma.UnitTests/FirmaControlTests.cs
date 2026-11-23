using FluentAssertions;
using Lefarma.API.Domain.Firmas;

namespace Lefarma.UnitTests;

public class FirmaControlTests
{
    private static readonly DateTime Ahora = new(2026, 9, 24, 12, 0, 0, DateTimeKind.Utc);
    private const int Usuario = 10;
    private const int Rh = 45;

[Fact]
    public void Parse_NuloOVacio_HistorialVacio()
    {
        FirmaControl.Parse(null).Subidas.Should().Be(0);
        FirmaControl.Parse("").Eventos.Should().BeEmpty();
        FirmaControl.Parse("   ").CambioHabilitado.Should().BeFalse();
    }

    [Fact]
    public void Parse_JsonCorrupto_HistorialVacio()
    {
        var control = FirmaControl.Parse("{no es json");
        control.Eventos.Should().BeEmpty("un JSON corrupto no debe romper la lectura");
    }

    [Fact]
    public void Roundtrip_SerializeYParse_ConservaEventos()
    {
        var control = new FirmaControl();
        control.AgregarSubida(Usuario, Ahora);
        control.AgregarSolicitud(Usuario, Ahora.AddHours(1));
        control.AgregarHabilitacion(Rh, Ahora.AddHours(2));

        var reparsed = FirmaControl.Parse(control.Serialize());

        reparsed.Eventos.Should().HaveCount(3);
        reparsed.Eventos.Select(e => e.Accion).Should().Equal(
            FirmaAccion.Subida, FirmaAccion.Solicitud, FirmaAccion.Habilitacion);
        reparsed.UltimaHabilitacion!.IdUsuario.Should().Be(Rh);
    }

[Fact]
    public void Subidas_CuentaSoloEventosSubida()
    {
        var control = new FirmaControl();
        control.AgregarSubida(Usuario, Ahora);
        control.AgregarSolicitud(Usuario, Ahora);
        control.AgregarSubida(Usuario, Ahora);

        control.Subidas.Should().Be(2);
    }

[Fact]
    public void CambioHabilitado_SinEventos_EsFalse()
    {
        new FirmaControl().CambioHabilitado.Should().BeFalse();
    }

    [Fact]
    public void CambioHabilitado_TrasHabilitacion_EsTrue()
    {
        var control = new FirmaControl();
        control.AgregarSubida(Usuario, Ahora);
        control.AgregarHabilitacion(Rh, Ahora);

        control.CambioHabilitado.Should().BeTrue();
    }

    [Fact]
    public void CambioHabilitado_SubidaPosterior_LoConsume()
    {
        var control = new FirmaControl();
        control.AgregarSubida(Usuario, Ahora);
        control.AgregarHabilitacion(Rh, Ahora);
        control.AgregarSubida(Usuario, Ahora);

        control.CambioHabilitado.Should().BeFalse("la habilitación es de un solo uso");
        control.Subidas.Should().Be(2);
    }

    [Fact]
    public void CambioHabilitado_EliminacionPosterior_LoConsume()
    {
        var control = new FirmaControl();
        control.AgregarSubida(Usuario, Ahora);
        control.AgregarHabilitacion(Rh, Ahora);
        control.AgregarEliminacion(Usuario, Ahora);

        control.CambioHabilitado.Should().BeFalse("eliminar también consume la habilitación");
    }

[Fact]
    public void SolicitudPendiente_TrasSolicitud_EsTrue()
    {
        var control = new FirmaControl();
        control.AgregarSubida(Usuario, Ahora);
        control.AgregarSolicitud(Usuario, Ahora);

        control.SolicitudPendiente.Should().BeTrue();
        control.UltimaSolicitud.Should().NotBeNull();
    }

    [Fact]
    public void SolicitudPendiente_TrasHabilitacion_SeAtiende()
    {
        var control = new FirmaControl();
        control.AgregarSubida(Usuario, Ahora);
        control.AgregarSolicitud(Usuario, Ahora);
        control.AgregarHabilitacion(Rh, Ahora);

        control.SolicitudPendiente.Should().BeFalse("la habilitación de RH atiende la solicitud");
        control.CambioHabilitado.Should().BeTrue();
    }

[Fact]
    public void CicloDeVida_Subir_Solicitar_Habilitar_Cambiar_VuelveABloquear()
    {
        var control = new FirmaControl();

        FirmaCambioPolicy.PuedeGuardar(control.Subidas, control.CambioHabilitado).Should().BeTrue();
        control.AgregarSubida(Usuario, Ahora);

        FirmaCambioPolicy.PuedeGuardar(control.Subidas, control.CambioHabilitado).Should().BeFalse();
        control.AgregarSolicitud(Usuario, Ahora);
        control.SolicitudPendiente.Should().BeTrue();

        control.AgregarHabilitacion(Rh, Ahora);
        control.SolicitudPendiente.Should().BeFalse();
        FirmaCambioPolicy.PuedeGuardar(control.Subidas, control.CambioHabilitado).Should().BeTrue();

        control.AgregarSubida(Usuario, Ahora);
        FirmaCambioPolicy.PuedeGuardar(control.Subidas, control.CambioHabilitado).Should().BeFalse();
    }
}
