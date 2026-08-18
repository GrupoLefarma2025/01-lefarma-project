using FluentAssertions;
using Lefarma.API.Features.OrdenesCompra.Captura;
using Lefarma.API.Features.OrdenesCompra.Captura.DTOs;

namespace Lefarma.UnitTests;

/// <summary>
/// Pruebas del campo AjusteRedondeo por partida: rango de validación (±5) y el
/// efecto en el total de la partida (solo ajusta el total final, no subtotal/IVA).
/// </summary>
public class AjusteRedondeoTests
{
    private static CreatePartidaRequest NewPartida(decimal? ajusteRedondeo = null) => new()
    {
        Descripcion = "Partida de prueba",
        Cantidad = 1m,
        IdUnidadMedida = 1,
        PrecioUnitario = 100m,
        PorcentajeIva = 0m,
        AjusteRedondeo = ajusteRedondeo
    };

    [Theory]
    [InlineData(5.01)]
    [InlineData(-5.01)]
    public void Validator_Rechaza_Ajuste_Fuera_De_Rango(decimal ajuste)
    {
        var validator = new CreatePartidaRequestValidator();
        var result = validator.Validate(NewPartida(ajuste));
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.ErrorMessage == "El ajuste por redondeo no puede ser mayor a 5 pesos.");
    }

    [Theory]
    [InlineData(5)]
    [InlineData(-5)]
    [InlineData(1.20)]
    public void Validator_Acepta_Ajuste_En_Rango(decimal ajuste)
    {
        var validator = new CreatePartidaRequestValidator();
        validator.Validate(NewPartida(ajuste)).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validator_Acepta_Ajuste_Nulo()
    {
        var validator = new CreatePartidaRequestValidator();
        validator.Validate(NewPartida(null)).IsValid.Should().BeTrue();
    }

    [Fact]
    public void CalcularTotalPartida_934_x_18_20_IVA0_Ajuste_1_20_Es_17000()
    {
        var partida = new CreatePartidaRequest
        {
            Descripcion = "Partida redondeo",
            Cantidad = 934m,
            IdUnidadMedida = 1,
            PrecioUnitario = 18.20m,
            Descuento = 0m,
            PorcentajeIva = 0m,
            AjusteRedondeo = 1.20m
        };

        var total = OrdenCompraService.CalcularTotalPartida(partida);

        total.Should().Be(17000.00m);
    }

    [Fact]
    public void CalcularTotalPartida_Ajuste_Nulo_No_Cambia_Total()
    {
        var partida = new CreatePartidaRequest
        {
            Descripcion = "Partida sin ajuste",
            Cantidad = 2m,
            IdUnidadMedida = 1,
            PrecioUnitario = 100m,
            Descuento = 0m,
            PorcentajeIva = 16m
        };

        var total = OrdenCompraService.CalcularTotalPartida(partida);

        total.Should().Be(232m); // (100*2) * 1.16
    }

    [Fact]
    public void CalcularTotalPartida_Ajuste_Negativo_Resta_Al_Total()
    {
        var partida = new CreatePartidaRequest
        {
            Descripcion = "Partida ajuste negativo",
            Cantidad = 1m,
            IdUnidadMedida = 1,
            PrecioUnitario = 100m,
            Descuento = 0m,
            PorcentajeIva = 0m,
            AjusteRedondeo = -0.50m
        };

        var total = OrdenCompraService.CalcularTotalPartida(partida);

        total.Should().Be(99.50m);
    }
}
