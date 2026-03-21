using FluentValidation;
using Lefarma.API.Features.Catalogos.Bancos.DTOs;

namespace Lefarma.API.Features.Catalogos.Bancos
{
    public class CreateBancoRequestValidator : AbstractValidator<CreateBancoRequest>
    {
        public CreateBancoRequestValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre del banco es obligatorio")
                .MaximumLength(255).WithMessage("El nombre no puede exceder 255 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe tener al menos 3 caracteres");

            RuleFor(x => x.Clave)
                .MaximumLength(100).WithMessage("La clave no puede exceder 100 caracteres")
                .When(x => !string.IsNullOrWhiteSpace(x.Clave));

            RuleFor(x => x.CodigoSWIFT)
                .MaximumLength(11).WithMessage("El código SWIFT no puede exceder 11 caracteres")
                .When(x => !string.IsNullOrWhiteSpace(x.CodigoSWIFT));

            RuleFor(x => x.Descripcion)
                .MaximumLength(1000).WithMessage("La descripción no puede exceder 1000 caracteres")
                .When(x => !string.IsNullOrWhiteSpace(x.Descripcion));
        }
    }

    public class UpdateBancoRequestValidator : AbstractValidator<UpdateBancoRequest>
    {
        public UpdateBancoRequestValidator()
        {
            RuleFor(x => x.IdBanco)
                .NotEmpty().WithMessage("El IdBanco es obligatorio")
                .GreaterThan(0).WithMessage("El IdBanco debe ser un número mayor a 0");

            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre del banco es obligatorio")
                .MaximumLength(255).WithMessage("El nombre no puede exceder 255 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe tener al menos 3 caracteres");

            RuleFor(x => x.Clave)
                .MaximumLength(100).WithMessage("La clave no puede exceder 100 caracteres")
                .When(x => !string.IsNullOrWhiteSpace(x.Clave));

            RuleFor(x => x.CodigoSWIFT)
                .MaximumLength(11).WithMessage("El código SWIFT no puede exceder 11 caracteres")
                .When(x => !string.IsNullOrWhiteSpace(x.CodigoSWIFT));

            RuleFor(x => x.Descripcion)
                .MaximumLength(1000).WithMessage("La descripción no puede exceder 1000 caracteres")
                .When(x => !string.IsNullOrWhiteSpace(x.Descripcion));
        }
    }
}
