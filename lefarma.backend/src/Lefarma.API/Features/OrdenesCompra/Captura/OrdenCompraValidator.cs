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
            RuleFor(x => x.IdTipoGasto).GreaterThan(0);
            RuleFor(x => x.IdFormaPago).GreaterThan(0);
            RuleFor(x => x.FechaLimitePago).GreaterThan(DateTime.Today)
                .WithMessage("La fecha límite de pago debe ser futura.");
            RuleFor(x => x.RazonSocialProveedor).NotEmpty().MaximumLength(255);
            RuleFor(x => x.RfcProveedor)
                .Length(12, 13).WithMessage("El RFC debe tener 12 o 13 caracteres.")
                .When(x => !x.SinDatosFiscales && !string.IsNullOrEmpty(x.RfcProveedor));
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
        }
    }
}
