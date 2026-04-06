using FluentValidation;
using Lefarma.API.Features.Catalogos.Proveedores.DTOs;

namespace Lefarma.API.Features.Catalogos.Proveedores
{
public class CreateProveedorRequestValidator : AbstractValidator<CreateProveedorRequest>
    {
        public CreateProveedorRequestValidator()
        {
            RuleFor(x => x.RazonSocial)
                .NotEmpty().WithMessage("La razón social es obligatoria")
                .MaximumLength(255).WithMessage("La razón social no puede tener más de 255 caracteres")
                .MinimumLength(3).WithMessage("La razón social debe contener al menos 3 caracteres");

            RuleFor(x => x.RFC)
                .MaximumLength(13).WithMessage("El RFC no puede tener más de 13 caracteres")
                .Matches(@"^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{0,3}$").WithMessage("El RFC no tiene un formato válido")
                .When(x => !string.IsNullOrWhiteSpace(x.RFC));

            RuleFor(x => x.CodigoPostal)
                .MaximumLength(10).WithMessage("El código postal no puede tener más de 10 caracteres")
                .Matches(@"^\d{5}$").WithMessage("El código postal debe tener 5 dígitos")
                .When(x => !string.IsNullOrWhiteSpace(x.CodigoPostal));

            RuleFor(x => x.RegimenFiscalId)
                .NotEmpty().WithMessage("El régimen fiscal es obligatorio cuando el proveedor tiene datos fiscales")
                .When(x => !x.SinDatosFiscales);

            RuleFor(x => x.RFC)
                .NotEmpty().WithMessage("El RFC es obligatorio cuando el proveedor tiene datos fiscales")
                .When(x => !x.SinDatosFiscales);

            RuleFor(x => x.CodigoPostal)
                .NotEmpty().WithMessage("El código postal es obligatorio cuando el proveedor tiene datos fiscales")
                .When(x => !x.SinDatosFiscales);

            RuleFor(x => x.PersonaContacto)
                .MaximumLength(255).WithMessage("La persona de contacto no puede tener más de 255 caracteres");

            RuleFor(x => x.NotaFormaPago)
                .MaximumLength(500).WithMessage("La nota de forma de pago no puede tener más de 500 caracteres");

            RuleFor(x => x.NotasGenerales)
                .MaximumLength(1000).WithMessage("Las notas generales no pueden tener más de 1000 caracteres");

            RuleFor(x => x.SinDatosFiscales)
                .NotNull().WithMessage("El valor de 'SinDatosFiscales' es obligatorio");

            RuleFor(x => x.AutorizadoPorCxP)
                .NotNull().WithMessage("El valor de 'AutorizadoPorCxP' es obligatorio");
        }
    }

    public class UpdateProveedorRequestValidator : AbstractValidator<UpdateProveedorRequest>
    {
        public UpdateProveedorRequestValidator()
        {
            RuleFor(x => x.IdProveedor)
                .NotEmpty().WithMessage("El IdProveedor es obligatorio")
                .GreaterThan(0).WithMessage("El IdProveedor debe ser un número mayor a 0");

            RuleFor(x => x.RazonSocial)
                .NotEmpty().WithMessage("La razón social es obligatoria")
                .MaximumLength(255).WithMessage("La razón social no puede tener más de 255 caracteres")
                .MinimumLength(3).WithMessage("La razón social debe contener al menos 3 caracteres");

            RuleFor(x => x.RFC)
                .MaximumLength(13).WithMessage("El RFC no puede tener más de 13 caracteres")
                .Matches(@"^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{0,3}$").WithMessage("El RFC no tiene un formato válido")
                .When(x => !string.IsNullOrWhiteSpace(x.RFC));

            RuleFor(x => x.CodigoPostal)
                .MaximumLength(10).WithMessage("El código postal no puede tener más de 10 caracteres")
                .Matches(@"^\d{5}$").WithMessage("El código postal debe tener 5 dígitos")
                .When(x => !string.IsNullOrWhiteSpace(x.CodigoPostal));

            RuleFor(x => x.RegimenFiscalId)
                .NotEmpty().WithMessage("El régimen fiscal es obligatorio cuando el proveedor tiene datos fiscales")
                .When(x => !x.SinDatosFiscales);

            RuleFor(x => x.RFC)
                .NotEmpty().WithMessage("El RFC es obligatorio cuando el proveedor tiene datos fiscales")
                .When(x => !x.SinDatosFiscales);

            RuleFor(x => x.CodigoPostal)
                .NotEmpty().WithMessage("El código postal es obligatorio cuando el proveedor tiene datos fiscales")
                .When(x => !x.SinDatosFiscales);

            RuleFor(x => x.PersonaContacto)
                .MaximumLength(255).WithMessage("La persona de contacto no puede tener más de 255 caracteres");

            RuleFor(x => x.NotaFormaPago)
                .MaximumLength(500).WithMessage("La nota de forma de pago no puede tener más de 500 caracteres");

            RuleFor(x => x.NotasGenerales)
                .MaximumLength(1000).WithMessage("Las notas generales no pueden tener más de 1000 caracteres");

            RuleFor(x => x.SinDatosFiscales)
                .NotNull().WithMessage("El valor de 'SinDatosFiscales' es obligatorio");

            RuleFor(x => x.AutorizadoPorCxP)
                .NotNull().WithMessage("El valor de 'AutorizadoPorCxP' es obligatorio");
        }
    }

    public class ProveedorRequestValidator : AbstractValidator<ProveedorRequest>
    {
        public ProveedorRequestValidator()
        {
            RuleFor(x => x.OrderBy)
                .Must(value => string.IsNullOrWhiteSpace(value) ||
                    new[] { "razonsocial", "rfc", "fecharegistro" }.Contains(value.ToLower()))
                .WithMessage("OrderBy debe ser uno de: razonsocial, rfc, fecharegistro")
                .When(x => !string.IsNullOrWhiteSpace(x.OrderBy));

            RuleFor(x => x.OrderDirection)
                .Must(value => string.IsNullOrWhiteSpace(value) ||
                    new[] { "asc", "desc" }.Contains(value.ToLower()))
                .WithMessage("OrderDirection debe ser 'asc' o 'desc'")
                .When(x => !string.IsNullOrWhiteSpace(x.OrderDirection));
        }
    }
}
