using FluentAssertions;
using Lefarma.API.Domain.Firmas;

namespace Lefarma.UnitTests;

public class FirmaCambioPolicyTests
{
    [Fact]
    public void PuedeGuardar_PrimeraSubida_EsLibre()
    {
        FirmaCambioPolicy.PuedeGuardar(subidasEfectivas: 0, cambioHabilitado: false)
            .Should().BeTrue("la subida inicial siempre está permitida");
    }

    [Fact]
    public void PuedeGuardar_YaRegistrada_SinHabilitacion_Bloquea()
    {
        FirmaCambioPolicy.PuedeGuardar(subidasEfectivas: 1, cambioHabilitado: false)
            .Should().BeFalse("una vez registrada, el reemplazo requiere habilitación RH");
    }

    [Fact]
    public void PuedeGuardar_VariasSubidas_SinHabilitacion_Bloquea()
    {
        FirmaCambioPolicy.PuedeGuardar(subidasEfectivas: 3, cambioHabilitado: false)
            .Should().BeFalse("ningún reemplazo posterior es libre");
    }

    [Fact]
    public void PuedeGuardar_YaRegistrada_ConHabilitacion_Permite()
    {
        FirmaCambioPolicy.PuedeGuardar(subidasEfectivas: 1, cambioHabilitado: true)
            .Should().BeTrue("RH habilitó el cambio");
    }
}
