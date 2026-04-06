using FluentValidation;
using Lefarma.API.Features.Catalogos.Empresas.DTOs;

namespace Lefarma.API.Features.Catalogos.Empresas
{
public class EmpresaQueryRequestValidator : AbstractValidator<EmpresaRequest>
    {
        public EmpresaQueryRequestValidator()
        {
            RuleFor(x => x.OrderBy)
                .Must(value => string.IsNullOrEmpty(value) || 
                    new[] { "nombre", "fechacreacion", "ciudad" }.Contains(value.ToLower()))
                .WithMessage("OrderBy debe ser 'nombre', 'fechacreacion' o 'ciudad'")
                .When(x => !string.IsNullOrEmpty(x.OrderBy));

            RuleFor(x => x.OrderDirection)
                .Must(value => string.IsNullOrEmpty(value) || 
                    new[] { "asc", "desc" }.Contains(value.ToLower()))
                .WithMessage("OrderDirection debe ser 'asc' o 'desc'")
                .When(x => !string.IsNullOrEmpty(x.OrderDirection));
        }
    }

    public class CreateEmpresaRequestValidator : AbstractValidator<CreateEmpresaRequest>
    {
        public CreateEmpresaRequestValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre de la empresa es obligatorio")
                .MaximumLength(255).WithMessage("El nombre no puede exceder 255 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe tener al menos 3 caracteres");

            RuleFor(x => x.RazonSocial)
                .MaximumLength(255).WithMessage("La raz�n social no puede exceder 255 caracteres")
                .When(x => !string.IsNullOrEmpty(x.RazonSocial));

            RuleFor(x => x.RFC)
                .Length(12, 13).WithMessage("El RFC debe tener entre 12 y 13 caracteres")
                .Matches(@"^[A-Z�&]{3,4}\d{6}[A-Z0-9]{3}$")
                    .WithMessage("El RFC no tiene un formato v�lido");

            RuleFor(x => x.Email)
                .EmailAddress().WithMessage("El email no tiene un formato v�lido")
                .When(x => !string.IsNullOrEmpty(x.Email));

            RuleFor(x => x.CodigoPostal)
                .Matches(@"^\d{5}$").WithMessage("El c�digo postal debe tener 5 d�gitos")
                .When(x => !string.IsNullOrEmpty(x.CodigoPostal));

            RuleFor(x => x.Telefono)
                .Matches(@"^\d{10}$").WithMessage("El tel�fono debe tener 10 d�gitos")
                .When(x => !string.IsNullOrEmpty(x.Telefono));

            RuleFor(x => x.Direccion)
                .MaximumLength(500).WithMessage("La direcci�n no puede exceder 500 caracteres")
                .When(x => !string.IsNullOrEmpty(x.Direccion));
        }
    }

    public class UpdateEmpresaRequestValidator : AbstractValidator<UpdateEmpresaRequest>
    {
        public UpdateEmpresaRequestValidator()
        {
            RuleFor(x => x.IdEmpresa)
            .NotEmpty().WithMessage("El IdEmpresa es obligatorio")
            .GreaterThan(0).WithMessage("El IdEmpresa debe ser un n�mero mayor a 0");

            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre de la empresa es obligatorio")
                .MaximumLength(255).WithMessage("El nombre no puede exceder 255 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe tener al menos 3 caracteres");

            RuleFor(x => x.RazonSocial)
                .MaximumLength(255).WithMessage("La raz�n social no puede exceder 255 caracteres")
                .When(x => !string.IsNullOrEmpty(x.RazonSocial));

            RuleFor(x => x.RFC)
                .Length(12, 13).WithMessage("El RFC debe tener entre 12 y 13 caracteres")
                .Matches(@"^[A-Z�&]{3,4}\d{6}[A-Z0-9]{3}$")
                    .WithMessage("El RFC no tiene un formato v�lido");

            RuleFor(x => x.Email)
                .EmailAddress().WithMessage("El email no tiene un formato v�lido")
                .When(x => !string.IsNullOrEmpty(x.Email));

            RuleFor(x => x.CodigoPostal)
                .Matches(@"^\d{5}$").WithMessage("El c�digo postal debe tener 5 d�gitos")
                .When(x => !string.IsNullOrEmpty(x.CodigoPostal));

            RuleFor(x => x.Telefono)
                .Matches(@"^\d{10}$").WithMessage("El tel�fono debe tener 10 d�gitos")
                .When(x => !string.IsNullOrEmpty(x.Telefono));

            RuleFor(x => x.Direccion)
                .MaximumLength(500).WithMessage("La direcci�n no puede exceder 500 caracteres")
                .When(x => !string.IsNullOrEmpty(x.Direccion));
        }
    }
}