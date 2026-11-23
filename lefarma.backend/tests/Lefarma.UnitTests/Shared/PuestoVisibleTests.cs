using FluentAssertions;
using Lefarma.API.Shared.Extensions;

namespace Lefarma.UnitTests.Shared;

public class PuestoVisibleTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Sin asignar")]
    [InlineData("SIN ASIGNAR")]
    [InlineData(" sin asignar ")]
    public void Puesto_Sin_Dato_Real_Devuelve_Null(string? puesto)
    {
        puesto.PuestoVisible().Should().BeNull();
    }

    [Theory]
    [InlineData("COORDINADOR DE DESARROLLO")]
    [InlineData("  AUXILIAR DE COMPRAS  ")]
    [InlineData("Gerente de Recursos Humanos")]
    public void Puesto_Real_Se_Devuelve_Recortado(string puesto)
    {
        puesto.PuestoVisible().Should().Be(puesto.Trim());
    }
}
