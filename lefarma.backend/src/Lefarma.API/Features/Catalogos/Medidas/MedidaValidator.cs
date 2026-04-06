using FluentValidation;
using Lefarma.API.Features.Catalogos.Medidas.DTOs;

namespace Lefarma.API.Features.Catalogos.Medidas
{
public class CreateMedidaValidator : AbstractValidator<CreateMedidaRequest>
    {
        public CreateMedidaValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre es obligatorio")
                .MaximumLength(80).WithMessage("El nombre no puede exceder 80 caracteres");
        }
    }

    public class UpdateMedidaValidator : AbstractValidator<UpdateMedidaRequest>
    {
        public UpdateMedidaValidator()
        {
            RuleFor(x => x.IdMedida)
                .GreaterThan(0).WithMessage("El ID es obligatorio");

            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre es obligatorio")
                .MaximumLength(80).WithMessage("El nombre no puede exceder 80 caracteres");
        }
    }

    public class MedidaRequestValidator : AbstractValidator<MedidaRequest>
    {
        public MedidaRequestValidator()
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
