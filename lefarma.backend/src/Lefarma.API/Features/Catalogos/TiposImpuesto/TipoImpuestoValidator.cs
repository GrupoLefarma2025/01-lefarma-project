using FluentValidation;
using Lefarma.API.Features.Catalogos.TiposImpuesto.DTOs;

namespace Lefarma.API.Features.Catalogos.TiposImpuesto
{
    public class CreateTipoImpuestoRequestValidator : AbstractValidator<CreateTipoImpuestoRequest>
    {
        public CreateTipoImpuestoRequestValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre del tipo de impuesto es obligatorio")
                .MaximumLength(255).WithMessage("El nombre no puede exceder 255 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe tener al menos 3 caracteres");

            RuleFor(x => x.Clave)
                .NotEmpty().WithMessage("La clave es obligatoria")
                .MaximumLength(100).WithMessage("La clave no puede exceder 100 caracteres");

            RuleFor(x => x.Tasa)
                .NotEmpty().WithMessage("La tasa es obligatoria")
                .GreaterThanOrEqualTo(0).WithMessage("La tasa no puede ser negativa")
                .LessThanOrEqualTo(1).WithMessage("La tasa no puede ser mayor a 1 (100%)");

            RuleFor(x => x.Descripcion)
                .MaximumLength(1000).WithMessage("La descripción no puede exceder 1000 caracteres")
                .When(x => !string.IsNullOrWhiteSpace(x.Descripcion));
        }
    }

    public class UpdateTipoImpuestoRequestValidator : AbstractValidator<UpdateTipoImpuestoRequest>
    {
        public UpdateTipoImpuestoRequestValidator()
        {
            RuleFor(x => x.IdTipoImpuesto)
                .NotEmpty().WithMessage("El IdTipoImpuesto es obligatorio")
                .GreaterThan(0).WithMessage("El IdTipoImpuesto debe ser un número mayor a 0");

            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre del tipo de impuesto es obligatorio")
                .MaximumLength(255).WithMessage("El nombre no puede exceder 255 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe tener al menos 3 caracteres");

            RuleFor(x => x.Clave)
                .NotEmpty().WithMessage("La clave es obligatoria")
                .MaximumLength(100).WithMessage("La clave no puede exceder 100 caracteres");

            RuleFor(x => x.Tasa)
                .NotEmpty().WithMessage("La tasa es obligatoria")
                .GreaterThanOrEqualTo(0).WithMessage("La tasa no puede ser negativa")
                .LessThanOrEqualTo(1).WithMessage("La tasa no puede ser mayor a 1 (100%)");

            RuleFor(x => x.Descripcion)
                .MaximumLength(1000).WithMessage("La descripción no puede exceder 1000 caracteres")
                .When(x => !string.IsNullOrWhiteSpace(x.Descripcion));
        }
    }
}
