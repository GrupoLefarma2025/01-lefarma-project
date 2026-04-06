using FluentValidation;
using Lefarma.API.Features.Catalogos.MediosPago.DTOs;

namespace Lefarma.API.Features.Catalogos.MediosPago
{
public class CreateMedioPagoRequestValidator : AbstractValidator<CreateMedioPagoRequest>
    {
        public CreateMedioPagoRequestValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre del medio de pago es obligatorio")
                .MaximumLength(255).WithMessage("El nombre no puede exceder 255 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe tener al menos 3 caracteres");

            RuleFor(x => x.Descripcion)
                .MaximumLength(500).WithMessage("La descripción no puede exceder 500 caracteres")
                .When(x => !string.IsNullOrEmpty(x.Descripcion));

            RuleFor(x => x.Clave)
                .MaximumLength(50).WithMessage("La clave no puede exceder 50 caracteres")
                .When(x => !string.IsNullOrEmpty(x.Clave));

            RuleFor(x => x.CodigoSAT)
                .MaximumLength(10).WithMessage("El código SAT no puede exceder 10 caracteres")
                .Matches(@"^[A-Z0-9]+$").WithMessage("El código SAT solo puede contener letras mayúsculas y números")
                .When(x => !string.IsNullOrEmpty(x.CodigoSAT));

            RuleFor(x => x.LimiteMonto)
                .GreaterThanOrEqualTo(0).WithMessage("El límite de monto debe ser mayor o igual a cero")
                .When(x => x.LimiteMonto.HasValue);

            RuleFor(x => x.PlazoMaximoDias)
                .GreaterThanOrEqualTo(0).WithMessage("El plazo máximo en días debe ser mayor o igual a cero")
                .When(x => x.PlazoMaximoDias.HasValue);
        }
    }

    public class UpdateMedioPagoRequestValidator : AbstractValidator<UpdateMedioPagoRequest>
    {
        public UpdateMedioPagoRequestValidator()
        {
            RuleFor(x => x.IdMedioPago)
                .NotEmpty().WithMessage("El IdMedioPago es obligatorio")
                .GreaterThan(0).WithMessage("El IdMedioPago debe ser un número mayor a 0");

            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre del medio de pago es obligatorio")
                .MaximumLength(255).WithMessage("El nombre no puede exceder 255 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe tener al menos 3 caracteres");

            RuleFor(x => x.Descripcion)
                .MaximumLength(500).WithMessage("La descripción no puede exceder 500 caracteres")
                .When(x => !string.IsNullOrEmpty(x.Descripcion));

            RuleFor(x => x.Clave)
                .MaximumLength(50).WithMessage("La clave no puede exceder 50 caracteres")
                .When(x => !string.IsNullOrEmpty(x.Clave));

            RuleFor(x => x.CodigoSAT)
                .MaximumLength(10).WithMessage("El código SAT no puede exceder 10 caracteres")
                .Matches(@"^[A-Z0-9]+$").WithMessage("El código SAT solo puede contener letras mayúsculas y números")
                .When(x => !string.IsNullOrEmpty(x.CodigoSAT));

            RuleFor(x => x.LimiteMonto)
                .GreaterThanOrEqualTo(0).WithMessage("El límite de monto debe ser mayor o igual a cero")
                .When(x => x.LimiteMonto.HasValue);

            RuleFor(x => x.PlazoMaximoDias)
                .GreaterThanOrEqualTo(0).WithMessage("El plazo máximo en días debe ser mayor o igual a cero")
                .When(x => x.PlazoMaximoDias.HasValue);
        }
    }
}
