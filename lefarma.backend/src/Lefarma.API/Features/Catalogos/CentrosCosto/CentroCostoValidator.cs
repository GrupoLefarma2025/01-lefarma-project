using FluentValidation;
using Lefarma.API.Features.Catalogos.CentrosCosto.DTOs;

namespace Lefarma.API.Features.Catalogos.CentrosCosto
{
public class CreateCentroCostoRequestValidator : AbstractValidator<CreateCentroCostoRequest>
    {
        public CreateCentroCostoRequestValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre es obligatorio")
                .MaximumLength(255).WithMessage("El nombre no puede tener más de 255 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe contener al menos 3 caracteres");

            RuleFor(x => x.Descripcion)
                .MaximumLength(500).WithMessage("La descripción no puede tener más de 500 caracteres")
                .MinimumLength(3).WithMessage("La descripción debe contener al menos 3 caracteres")
                .When(x => !string.IsNullOrWhiteSpace(x.Descripcion));

            RuleFor(x => x.LimitePresupuesto)
                .GreaterThanOrEqualTo(0).WithMessage("El límite de presupuesto no puede ser negativo")
                .When(x => x.LimitePresupuesto.HasValue);

            RuleFor(x => x.Activo)
                .NotNull().WithMessage("El valor de 'Activo' es obligatorio");
        }
    }

    public class UpdateCentroCostoRequestValidator: AbstractValidator<UpdateCentroCostoRequest>
    {
        public UpdateCentroCostoRequestValidator()
        {
            RuleFor(x => x.IdCentroCosto)
                .NotEmpty().WithMessage("El IdCentroCosto es obligatorio")
                .GreaterThan(0).WithMessage("El IdCentroCosto debe ser un número mayor a 0");

            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre es obligatorio")
                .MaximumLength(255).WithMessage("El nombre no puede tener más de 255 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe contener al menos 3 caracteres");

            RuleFor(x => x.Descripcion)
                .MaximumLength(500).WithMessage("La descripción no puede tener más de 500 caracteres")
                .MinimumLength(3).WithMessage("La descripción debe contener al menos 3 caracteres")
                .When(x => !string.IsNullOrWhiteSpace(x.Descripcion));

            RuleFor(x => x.LimitePresupuesto)
                .GreaterThanOrEqualTo(0).WithMessage("El límite de presupuesto no puede ser negativo")
                .When(x => x.LimitePresupuesto.HasValue);

            RuleFor(x => x.Activo)
                .NotNull().WithMessage("El valor de 'Activo' es obligatorio");
        }
    }

    public class CentroCostoRequestValidator: AbstractValidator<CentroCostoRequest>
    {
        public CentroCostoRequestValidator()
        {
            RuleFor(x => x.OrderBy)
                .Must(value => string.IsNullOrWhiteSpace(value) ||
                    new[] { "nombre", "fechacreacion" }.Contains(value.ToLower()))
                .WithMessage("OrderBy debe ser uno de: nombre, fechacreacion")
                .When(x => !string.IsNullOrWhiteSpace(x.OrderBy));

            RuleFor(x => x.OrderDirection)
                .Must(value => string.IsNullOrWhiteSpace(value) ||
                    new[] { "asc", "desc" }.Contains(value.ToLower()))
                .WithMessage("OrderDirection debe ser 'asc' o 'desc'")
                .When(x => !string.IsNullOrWhiteSpace(x.OrderDirection));
        }
    }
}
