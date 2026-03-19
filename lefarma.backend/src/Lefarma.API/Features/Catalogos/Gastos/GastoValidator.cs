using FluentValidation;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Catalogos.Gastos.DTOs;

namespace Lefarma.API.Features.Catalogos.Gastos
{
    public class CreateGastoRequestValidator : AbstractValidator<CreateGastoRequest>
    {
        public CreateGastoRequestValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre es obligatorio")
                .MaximumLength(255).WithMessage("El nombre no puede tener más de 255 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe contener al menos 3 caracteres");

            RuleFor(x => x.Descripcion)
                .MaximumLength(500).WithMessage("La descripción no puede tener más de 500 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe contener al menos 3 caracteres");

            RuleFor(x => x.Clave)
                .NotEmpty().WithMessage("La clave es obligatoria")
                .MaximumLength(50).WithMessage("La clave no puede tener más de 50 caracteres");

            RuleFor(x => x.Concepto)
                .MaximumLength(255).WithMessage("El concepto no puede tener más de 255 caracteres");

            RuleFor(x => x.Cuenta)
                .NotEmpty().WithMessage("La cuenta es obligatoria")
                .Matches(@"^\d{3}$")
                .WithMessage("La cuenta debe tener exactamente 3 dígitos");

            RuleFor(x => x.SubCuenta)
                .NotEmpty().WithMessage("La subcuenta es obligatoria")
                .Matches(@"^\d{3}$")
                .WithMessage("La subcuenta debe tener exactamente 3 dígitos");

            RuleFor(x => x.Analitica)
                .NotEmpty().WithMessage("La analítica es obligatoria")
                .Matches(@"^\d{3}$")
                .WithMessage("La analítica debe tener exactamente 3 dígitos");

            RuleFor(x => x.Integracion)
                .NotEmpty().WithMessage("La integración es obligatoria")
                .Matches(@"^\d{2}$")
                .WithMessage("La integración debe tener exactamente 2 dígitos");

            RuleFor(x => x.RequiereComprobacionPago)
                .NotNull().WithMessage("El valor de 'RequiereComprobacionPago' es obligatorio");

            RuleFor(x => x.RequiereComprobacionGasto)
                .NotNull().WithMessage("El valor de 'RequiereComprobacionGasto' es obligatorio");

            RuleFor(x => x.PermiteSinDatosFiscales)
                .NotNull().WithMessage("El valor de 'PermiteSinDatosFiscales' es obligatorio");

            RuleFor(x => x.DiasLimiteComprobacion)
                .GreaterThanOrEqualTo(0).WithMessage("Los días límite de comprobación deben ser mayores o iguales a 0");

            RuleFor(x => x.Activo)
                .NotNull().WithMessage("El valor de 'Activo' es obligatorio");
        }
    }

    public class UpdateGastoRequestValidator : AbstractValidator<UpdateGastoRequest>
    {
        public UpdateGastoRequestValidator()
        {
            RuleFor(x => x.IdGasto)
            .NotEmpty().WithMessage("El IdGasto es obligatorio")
            .GreaterThan(0).WithMessage("El IdGasto debe ser un número mayor a 0");

            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre es obligatorio")
                .MaximumLength(255).WithMessage("El nombre no puede tener más de 255 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe contener al menos 3 caracteres");

            RuleFor(x => x.Descripcion)
                .MaximumLength(500).WithMessage("La descripción no puede tener más de 500 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe contener al menos 3 caracteres");

            RuleFor(x => x.Clave)
                .NotEmpty().WithMessage("La clave es obligatoria")
                .MaximumLength(50).WithMessage("La clave no puede tener más de 50 caracteres");

            RuleFor(x => x.Concepto)
                .MaximumLength(255).WithMessage("El concepto no puede tener más de 255 caracteres");

            RuleFor(x => x.Cuenta)
                 .NotEmpty().WithMessage("La cuenta es obligatoria")
                 .Matches(@"^\d{3}$")
                 .WithMessage("La cuenta debe tener exactamente 3 dígitos");

            RuleFor(x => x.SubCuenta)
                .NotEmpty().WithMessage("La subcuenta es obligatoria")
                .Matches(@"^\d{3}$")
                .WithMessage("La subcuenta debe tener exactamente 3 dígitos");

            RuleFor(x => x.Analitica)
                .NotEmpty().WithMessage("La analítica es obligatoria")
                .Matches(@"^\d{3}$")
                .WithMessage("La analítica debe tener exactamente 3 dígitos");

            RuleFor(x => x.Integracion)
                .NotEmpty().WithMessage("La integración es obligatoria")
                .Matches(@"^\d{2}$")
                .WithMessage("La integración debe tener exactamente 2 dígitos");

            RuleFor(x => x.RequiereComprobacionPago)
                .NotNull().WithMessage("El valor de 'RequiereComprobacionPago' es obligatorio");

            RuleFor(x => x.RequiereComprobacionGasto)
                .NotNull().WithMessage("El valor de 'RequiereComprobacionGasto' es obligatorio");

            RuleFor(x => x.PermiteSinDatosFiscales)
                .NotNull().WithMessage("El valor de 'PermiteSinDatosFiscales' es obligatorio");

            RuleFor(x => x.DiasLimiteComprobacion)
                .GreaterThanOrEqualTo(0).WithMessage("Los días límite de comprobación deben ser mayores o iguales a 0");

            RuleFor(x => x.Activo)
                .NotNull().WithMessage("El valor de 'Activo' es obligatorio");
        }
    }
}
