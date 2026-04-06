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
                .MaximumLength(255).WithMessage("El nombre no puede tener m�s de 255 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe contener al menos 3 caracteres");

            RuleFor(x => x.Descripcion)
                .MaximumLength(500).WithMessage("La descripci�n no puede tener m�s de 500 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe contener al menos 3 caracteres");

            RuleFor(x => x.Clave)
                .NotEmpty().WithMessage("La clave es obligatoria")
                .MaximumLength(50).WithMessage("La clave no puede tener m�s de 50 caracteres");

            RuleFor(x => x.Concepto)
                .MaximumLength(255).WithMessage("El concepto no puede tener m�s de 255 caracteres");

            RuleFor(x => x.Cuenta)
                .NotEmpty().WithMessage("La cuenta es obligatoria")
                .Matches(@"^\d{3}$")
                .WithMessage("La cuenta debe tener exactamente 3 d�gitos");

            RuleFor(x => x.SubCuenta)
                .NotEmpty().WithMessage("La subcuenta es obligatoria")
                .Matches(@"^\d{3}$")
                .WithMessage("La subcuenta debe tener exactamente 3 d�gitos");

            RuleFor(x => x.Analitica)
                .NotEmpty().WithMessage("La anal�tica es obligatoria")
                .Matches(@"^\d{3}$")
                .WithMessage("La anal�tica debe tener exactamente 3 d�gitos");

            RuleFor(x => x.Integracion)
                .NotEmpty().WithMessage("La integraci�n es obligatoria")
                .Matches(@"^\d{2}$")
                .WithMessage("La integraci�n debe tener exactamente 2 d�gitos");

            RuleFor(x => x.RequiereComprobacionPago)
                .NotNull().WithMessage("El valor de 'RequiereComprobacionPago' es obligatorio");

            RuleFor(x => x.RequiereComprobacionGasto)
                .NotNull().WithMessage("El valor de 'RequiereComprobacionGasto' es obligatorio");

            RuleFor(x => x.PermiteSinDatosFiscales)
                .NotNull().WithMessage("El valor de 'PermiteSinDatosFiscales' es obligatorio");

            RuleFor(x => x.DiasLimiteComprobacion)
                .GreaterThanOrEqualTo(0).WithMessage("Los d�as l�mite de comprobaci�n deben ser mayores o iguales a 0");

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
            .GreaterThan(0).WithMessage("El IdGasto debe ser un n�mero mayor a 0");

            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre es obligatorio")
                .MaximumLength(255).WithMessage("El nombre no puede tener m�s de 255 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe contener al menos 3 caracteres");

            RuleFor(x => x.Descripcion)
                .MaximumLength(500).WithMessage("La descripci�n no puede tener m�s de 500 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe contener al menos 3 caracteres");

            RuleFor(x => x.Clave)
                .NotEmpty().WithMessage("La clave es obligatoria")
                .MaximumLength(50).WithMessage("La clave no puede tener m�s de 50 caracteres");

            RuleFor(x => x.Concepto)
                .MaximumLength(255).WithMessage("El concepto no puede tener m�s de 255 caracteres");

            RuleFor(x => x.Cuenta)
                 .NotEmpty().WithMessage("La cuenta es obligatoria")
                 .Matches(@"^\d{3}$")
                 .WithMessage("La cuenta debe tener exactamente 3 d�gitos");

            RuleFor(x => x.SubCuenta)
                .NotEmpty().WithMessage("La subcuenta es obligatoria")
                .Matches(@"^\d{3}$")
                .WithMessage("La subcuenta debe tener exactamente 3 d�gitos");

            RuleFor(x => x.Analitica)
                .NotEmpty().WithMessage("La anal�tica es obligatoria")
                .Matches(@"^\d{3}$")
                .WithMessage("La anal�tica debe tener exactamente 3 d�gitos");

            RuleFor(x => x.Integracion)
                .NotEmpty().WithMessage("La integraci�n es obligatoria")
                .Matches(@"^\d{2}$")
                .WithMessage("La integraci�n debe tener exactamente 2 d�gitos");

            RuleFor(x => x.RequiereComprobacionPago)
                .NotNull().WithMessage("El valor de 'RequiereComprobacionPago' es obligatorio");

            RuleFor(x => x.RequiereComprobacionGasto)
                .NotNull().WithMessage("El valor de 'RequiereComprobacionGasto' es obligatorio");

            RuleFor(x => x.PermiteSinDatosFiscales)
                .NotNull().WithMessage("El valor de 'PermiteSinDatosFiscales' es obligatorio");

            RuleFor(x => x.DiasLimiteComprobacion)
                .GreaterThanOrEqualTo(0).WithMessage("Los d�as l�mite de comprobaci�n deben ser mayores o iguales a 0");

            RuleFor(x => x.Activo)
                .NotNull().WithMessage("El valor de 'Activo' es obligatorio");
        }
    }

    public class GastoRequestValidator : AbstractValidator<GastoRequest>
    {
        public GastoRequestValidator()
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
