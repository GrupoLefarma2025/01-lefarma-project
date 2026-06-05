using FluentValidation;
using Lefarma.API.Features.Catalogos.CuentasContables.DTOs;

namespace Lefarma.API.Features.Catalogos.CuentasContables
{
public class CreateCuentaContableRequestValidator : AbstractValidator<CreateCuentaContableRequest>
    {
        public CreateCuentaContableRequestValidator()
        {
            RuleFor(x => x.Cuenta)
                .NotEmpty().WithMessage("La cuenta es obligatoria")
                .MaximumLength(20).WithMessage("La cuenta no puede tener más de 20 caracteres")
                .Matches(@"^[\d-]+$").WithMessage("La cuenta solo puede contener números y guiones");

            RuleFor(x => x.Descripcion)
                .NotEmpty().WithMessage("La descripción es obligatoria")
                .MaximumLength(255).WithMessage("La descripción no puede tener más de 255 caracteres");

            RuleFor(x => x.Nivel1)
                .NotEmpty().WithMessage("El nivel 1 es obligatorio")
                .MaximumLength(3).WithMessage("El nivel 1 no puede tener más de 3 caracteres");

            RuleFor(x => x.Nivel2)
                .NotEmpty().WithMessage("El nivel 2 es obligatorio")
                .MaximumLength(10).WithMessage("El nivel 2 no puede tener más de 10 caracteres");

            RuleFor(x => x.IdEmpresa)
                .GreaterThan(0).WithMessage("El ID de empresa debe ser mayor a 0")
                .When(x => x.IdEmpresa.HasValue);

            RuleFor(x => x.Activo)
                .NotNull().WithMessage("El valor de 'Activo' es obligatorio");
        }
    }

    public class UpdateCuentaContableRequestValidator : AbstractValidator<UpdateCuentaContableRequest>
    {
        public UpdateCuentaContableRequestValidator()
        {
            RuleFor(x => x.IdCuentaContable)
                .NotEmpty().WithMessage("El IdCuentaContable es obligatorio")
                .GreaterThan(0).WithMessage("El IdCuentaContable debe ser un número mayor a 0");

            RuleFor(x => x.Cuenta)
                .NotEmpty().WithMessage("La cuenta es obligatoria")
                .MaximumLength(20).WithMessage("La cuenta no puede tener más de 20 caracteres")
                .Matches(@"^[\d-]+$").WithMessage("La cuenta solo puede contener números y guiones");

            RuleFor(x => x.Descripcion)
                .NotEmpty().WithMessage("La descripción es obligatoria")
                .MaximumLength(255).WithMessage("La descripción no puede tener más de 255 caracteres");

            RuleFor(x => x.Nivel1)
                .NotEmpty().WithMessage("El nivel 1 es obligatorio")
                .MaximumLength(3).WithMessage("El nivel 1 no puede tener más de 3 caracteres");

            RuleFor(x => x.Nivel2)
                .NotEmpty().WithMessage("El nivel 2 es obligatorio")
                .MaximumLength(10).WithMessage("El nivel 2 no puede tener más de 10 caracteres");

            RuleFor(x => x.IdEmpresa)
                .GreaterThan(0).WithMessage("El ID de empresa debe ser mayor a 0")
                .When(x => x.IdEmpresa.HasValue);

            RuleFor(x => x.Activo)
                .NotNull().WithMessage("El valor de 'Activo' es obligatorio");
        }
    }

    public class CuentaContableRequestValidator : AbstractValidator<CuentaContableRequest>
    {
        public CuentaContableRequestValidator()
        {
            RuleFor(x => x.OrderBy)
                .Must(value => string.IsNullOrWhiteSpace(value) ||
                    new[] { "cuenta", "descripcion", "nivel1" }.Contains(value.ToLower()))
                .WithMessage("OrderBy debe ser uno de: cuenta, descripcion, nivel1")
                .When(x => !string.IsNullOrWhiteSpace(x.OrderBy));

            RuleFor(x => x.OrderDirection)
                .Must(value => string.IsNullOrWhiteSpace(value) ||
                    new[] { "asc", "desc" }.Contains(value.ToLower()))
                .WithMessage("OrderDirection debe ser 'asc' o 'desc'")
                .When(x => !string.IsNullOrWhiteSpace(x.OrderDirection));
        }
    }
}
