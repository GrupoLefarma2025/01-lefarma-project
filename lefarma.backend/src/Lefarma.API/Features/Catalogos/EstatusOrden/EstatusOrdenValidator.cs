using FluentValidation;
using Lefarma.API.Features.Catalogos.EstatusOrden.DTOs;

namespace Lefarma.API.Features.Catalogos.EstatusOrden
{
public class EstatusOrdenRequestValidator : AbstractValidator<EstatusOrdenRequest>
    {
        public EstatusOrdenRequestValidator()
        {
            RuleFor(x => x.OrderBy)
                .Must(value => string.IsNullOrWhiteSpace(value) ||
                    new[] { "nombre", "idestatusorden" }.Contains(value.ToLower()))
                .WithMessage("OrderBy debe ser uno de: nombre, idestatusorden")
                .When(x => !string.IsNullOrWhiteSpace(x.OrderBy));

            RuleFor(x => x.OrderDirection)
                .Must(value => string.IsNullOrWhiteSpace(value) ||
                    new[] { "asc", "desc" }.Contains(value.ToLower()))
                .WithMessage("OrderDirection debe ser 'asc' o 'desc'")
                .When(x => !string.IsNullOrWhiteSpace(x.OrderDirection));
        }
    }
}
