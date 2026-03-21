using FluentValidation;
using Lefarma.API.Features.Catalogos.FormasPago.DTOs;

namespace Lefarma.API.Features.Catalogos.FormasPago
{
    public class FormaPagoValidator : AbstractValidator<CreateFormaPagoRequest>
    {
        public FormaPagoValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre es obligatorio")
                .MinimumLength(3).WithMessage("El nombre debe tener al menos 3 caracteres")
                .MaximumLength(255).WithMessage("El nombre no puede exceder 255 caracteres");

            RuleFor(x => x.Descripcion)
                .MaximumLength(500).WithMessage("La descripción no puede exceder 500 caracteres");

            RuleFor(x => x.Clave)
                .MaximumLength(50).WithMessage("La clave no puede exceder 50 caracteres");
        }
    }
}
