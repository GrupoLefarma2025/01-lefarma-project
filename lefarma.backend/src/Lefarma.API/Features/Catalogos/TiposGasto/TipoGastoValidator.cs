using FluentValidation;
using Lefarma.API.Features.Catalogos.TiposGasto.DTOs;

namespace Lefarma.API.Features.Catalogos.TiposGasto
{
    public class TipoGastoValidator : AbstractValidator<CreateTipoGastoRequest>
    {
        public TipoGastoValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre es requerido")
                .MinimumLength(3).WithMessage("El nombre debe tener al menos 3 caracteres")
                .MaximumLength(255).WithMessage("El nombre no puede exceder 255 caracteres");

            RuleFor(x => x.Descripcion)
                .MaximumLength(500).WithMessage("La descripción no puede exceder 500 caracteres")
                .When(x => !string.IsNullOrEmpty(x.Descripcion));

            RuleFor(x => x.Clave)
                .MaximumLength(50).WithMessage("La clave no puede exceder 50 caracteres")
                .When(x => !string.IsNullOrEmpty(x.Clave));
        }
    }

    public class UpdateTipoGastoValidator : AbstractValidator<UpdateTipoGastoRequest>
    {
        public UpdateTipoGastoValidator()
        {
            RuleFor(x => x.IdTipoGasto)
                .GreaterThan(0).WithMessage("El ID es requerido");

            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre es requerido")
                .MinimumLength(3).WithMessage("El nombre debe tener al menos 3 caracteres")
                .MaximumLength(255).WithMessage("El nombre no puede exceder 255 caracteres");

            RuleFor(x => x.Descripcion)
                .MaximumLength(500).WithMessage("La descripción no puede exceder 500 caracteres")
                .When(x => !string.IsNullOrEmpty(x.Descripcion));

            RuleFor(x => x.Clave)
                .MaximumLength(50).WithMessage("La clave no puede exceder 50 caracteres")
                .When(x => !string.IsNullOrEmpty(x.Clave));
        }
    }
}
