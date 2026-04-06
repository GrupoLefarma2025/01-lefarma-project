using FluentValidation;
using Lefarma.API.Features.Catalogos.Areas.DTOs;

namespace Lefarma.API.Features.Catalogos.Areas
{
public class CreateAreaRequestValidator : AbstractValidator<CreateAreaRequest>
    {
        public CreateAreaRequestValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre de la �rea es obligatorio")
                .MaximumLength(255).WithMessage("El nombre no puede exceder 255 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe tener al menos 3 caracteres");
        }
    }

    public class UpdateAreaRequestValidator : AbstractValidator<UpdateAreaRequest>
    {
        public UpdateAreaRequestValidator()
        {
            RuleFor(x => x.IdArea)
            .NotEmpty().WithMessage("El IdArea es obligatorio")
            .GreaterThan(0).WithMessage("El IdArea debe ser un n�mero mayor a 0");

            RuleFor(x => x.IdEmpresa)
            .NotEmpty().WithMessage("El IdEmpresa es obligatorio")
            .GreaterThan(0).WithMessage("El IdEmpresa debe ser un n�mero mayor a 0");

            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre de la �rea es obligatorio")
                .MaximumLength(255).WithMessage("El nombre no puede exceder 255 caracteres")
                .MinimumLength(3).WithMessage("El nombre debe tener al menos 3 caracteres");

        }
    }

    public class AreaRequestValidator : AbstractValidator<AreaRequest>
    {
        public AreaRequestValidator()
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
