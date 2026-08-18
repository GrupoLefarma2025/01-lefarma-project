using FluentValidation;
using Lefarma.API.Features.OrdenesCompra.Captura.DTOs;

namespace Lefarma.API.Features.OrdenesCompra.Captura
{
public class CreateOrdenCompraRequestValidator : AbstractValidator<CreateOrdenCompraRequest>
    {
        public CreateOrdenCompraRequestValidator()
        {
            RuleFor(x => x.IdEmpresa).GreaterThan(0);
            RuleFor(x => x.IdSucursal).GreaterThan(0);
            RuleFor(x => x.IdArea).GreaterThan(0);
            RuleFor(x => x.IdTipoGasto).GreaterThan(0).WithMessage("El tipo de gasto es obligatorio");
            RuleFor(x => x.FolioTransporte).GreaterThan(0)
                .When(x => x.FolioTransporte.HasValue)
                .WithMessage("El folio de transporte debe ser un valor válido");
            RuleFor(x => x.FechaLimitePago).GreaterThan(DateTime.Today)
                .WithMessage("La fecha límite de pago debe ser futura.");
            RuleFor(x => x.Partidas).NotEmpty().WithMessage("Debe incluir al menos una partida.");
            RuleForEach(x => x.Partidas).SetValidator(new CreatePartidaRequestValidator());
        }
    }

    public class CreatePartidaRequestValidator : AbstractValidator<CreatePartidaRequest>
    {
        public CreatePartidaRequestValidator()
        {
            RuleFor(x => x.Descripcion).NotEmpty().MaximumLength(500);
            RuleFor(x => x.Cantidad).GreaterThan(0);
            RuleFor(x => x.PrecioUnitario).GreaterThan(0);
            RuleFor(x => x.IdUnidadMedida).GreaterThan(0);
            RuleFor(x => x.PorcentajeIva).InclusiveBetween(0, 100);
            RuleFor(x => x.AjusteRedondeo).InclusiveBetween(-5, 5)
                .When(x => x.AjusteRedondeo.HasValue)
                .WithMessage("El ajuste por redondeo no puede ser mayor a 5 pesos.");
        }
    }
}
