using FluentValidation;
using Lefarma.API.Features.Catalogos.RegimenesFiscales.DTOs;

namespace Lefarma.API.Features.Catalogos.RegimenesFiscales
{
public class CreateRegimenFiscalRequestValidator : AbstractValidator<CreateRegimenFiscalRequest>
    {
        public CreateRegimenFiscalRequestValidator()
        {
            RuleFor(x => x.Clave)
                .NotEmpty().WithMessage("La clave es obligatoria")
                .MaximumLength(10).WithMessage("La clave no puede tener más de 10 caracteres");

            RuleFor(x => x.Descripcion)
                .NotEmpty().WithMessage("La descripción es obligatoria")
                .MaximumLength(255).WithMessage("La descripción no puede tener más de 255 caracteres");

            RuleFor(x => x.TipoPersona)
                .NotEmpty().WithMessage("El tipo de persona es obligatorio")
                .Must(value => new[] { "Moral", "Física" }.Contains(value))
                .WithMessage("El tipo de persona debe ser 'Moral' o 'Física'");

            RuleFor(x => x.Activo)
                .NotNull().WithMessage("El valor de 'Activo' es obligatorio");
        }
    }

    public class UpdateRegimenFiscalRequestValidator : AbstractValidator<UpdateRegimenFiscalRequest>
    {
        public UpdateRegimenFiscalRequestValidator()
        {
            RuleFor(x => x.IdRegimenFiscal)
                .NotEmpty().WithMessage("El IdRegimenFiscal es obligatorio")
                .GreaterThan(0).WithMessage("El IdRegimenFiscal debe ser un número mayor a 0");

            RuleFor(x => x.Clave)
                .NotEmpty().WithMessage("La clave es obligatoria")
                .MaximumLength(10).WithMessage("La clave no puede tener más de 10 caracteres");

            RuleFor(x => x.Descripcion)
                .NotEmpty().WithMessage("La descripción es obligatoria")
                .MaximumLength(255).WithMessage("La descripción no puede tener más de 255 caracteres");

            RuleFor(x => x.TipoPersona)
                .NotEmpty().WithMessage("El tipo de persona es obligatorio")
                .Must(value => new[] { "Moral", "Física" }.Contains(value))
                .WithMessage("El tipo de persona debe ser 'Moral' o 'Física'");

            RuleFor(x => x.Activo)
                .NotNull().WithMessage("El valor de 'Activo' es obligatorio");
        }
    }

    public class RegimenFiscalRequestValidator : AbstractValidator<RegimenFiscalRequest>
    {
        public RegimenFiscalRequestValidator()
        {
            RuleFor(x => x.TipoPersona)
                .Must(value => string.IsNullOrWhiteSpace(value) ||
                    new[] { "Moral", "Física" }.Contains(value))
                .WithMessage("El tipo de persona debe ser 'Moral' o 'Física'")
                .When(x => !string.IsNullOrWhiteSpace(x.TipoPersona));

            RuleFor(x => x.OrderBy)
                .Must(value => string.IsNullOrWhiteSpace(value) ||
                    new[] { "clave", "descripcion" }.Contains(value.ToLower()))
                .WithMessage("OrderBy debe ser uno de: clave, descripcion")
                .When(x => !string.IsNullOrWhiteSpace(x.OrderBy));

            RuleFor(x => x.OrderDirection)
                .Must(value => string.IsNullOrWhiteSpace(value) ||
                    new[] { "asc", "desc" }.Contains(value.ToLower()))
                .WithMessage("OrderDirection debe ser 'asc' o 'desc'")
                .When(x => !string.IsNullOrWhiteSpace(x.OrderDirection));
        }
    }
}
