using FluentAssertions;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.Services;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class SeleccionEditablePolicyTests
{
    private static SeleccionMensual Seleccion(string estado) => new()
    {
        Estado = estado,
        Activo = true,
        IdPasoActual = 10,
    };

    private static WorkflowPaso Paso(bool activo = true, bool permiteEditar = true, bool esFinal = false) => new()
    {
        Activo = activo,
        PermiteEditar = permiteEditar,
        EsFinal = esFinal,
    };

    [Theory]
    [InlineData(SeleccionMensual.EstadoCreada)]
    [InlineData(SeleccionMensual.EstadoEnRevision)]
    public void EsEditable_PasoIntermedioHabilitado_DebePermitir(string estado)
    {
        SeleccionEditablePolicy.EsEditable(Seleccion(estado), Paso()).Should().BeTrue();
    }

    [Theory]
    [InlineData(SeleccionMensual.EstadoCerrada)]
    [InlineData(SeleccionMensual.EstadoCancelada)]
    [InlineData(SeleccionMensual.EstadoRechazada)]
    public void EsEditable_EstadoFinal_DebeBloquear(string estado)
    {
        SeleccionEditablePolicy.EsEditable(Seleccion(estado), Paso()).Should().BeFalse();
    }

    [Fact]
    public void EsEditable_PasoInactivo_DebeBloquear()
    {
        SeleccionEditablePolicy.EsEditable(Seleccion(SeleccionMensual.EstadoCreada), Paso(activo: false))
            .Should().BeFalse();
    }

    [Fact]
    public void EsEditable_PasoNoConfiguradoParaEditar_DebeBloquear()
    {
        SeleccionEditablePolicy.EsEditable(Seleccion(SeleccionMensual.EstadoEnRevision), Paso(permiteEditar: false))
            .Should().BeFalse();
    }

    [Fact]
    public void EsEditable_PasoFinal_DebeBloquear()
    {
        SeleccionEditablePolicy.EsEditable(Seleccion(SeleccionMensual.EstadoCreada), Paso(esFinal: true))
            .Should().BeFalse();
    }

    [Fact]
    public void EsEditable_SeleccionInactiva_DebeBloquear()
    {
        var seleccion = Seleccion(SeleccionMensual.EstadoCreada);
        seleccion.Activo = false;

        SeleccionEditablePolicy.EsEditable(seleccion, Paso()).Should().BeFalse();
    }

    [Fact]
    public void EsEditable_SinPasoEnCreada_DebePermitirPorCompatibilidad()
    {
        var seleccion = Seleccion(SeleccionMensual.EstadoCreada);
        seleccion.IdPasoActual = null;

        SeleccionEditablePolicy.EsEditable(seleccion, paso: null).Should().BeTrue();
    }

    [Fact]
    public void EsEditable_SinPasoFueraDeCreada_DebeBloquear()
    {
        var seleccion = Seleccion(SeleccionMensual.EstadoEnRevision);
        seleccion.IdPasoActual = null;

        SeleccionEditablePolicy.EsEditable(seleccion, paso: null).Should().BeFalse();
    }
}
