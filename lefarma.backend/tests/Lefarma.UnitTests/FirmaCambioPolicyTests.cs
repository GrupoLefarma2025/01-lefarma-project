using FluentAssertions;
using Lefarma.API.Domain.Firmas;

namespace Lefarma.UnitTests;

/// <summary>
/// Pruebas puras (sin DB) de la regla de control de cambios de firma:
/// solo la subida inicial es libre; reemplazos requieren habilitación RH (un solo uso).
/// El consumo de la habilitación es implícito (ver FirmaControlTests).
/// </summary>
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
