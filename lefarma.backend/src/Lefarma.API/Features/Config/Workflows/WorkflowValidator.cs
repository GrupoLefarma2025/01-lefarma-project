using FluentValidation;
using Lefarma.API.Features.Config.Workflows.DTOs;

namespace Lefarma.API.Features.Config.Workflows
{
public class CreateWorkflowRequestValidator : AbstractValidator<CreateWorkflowRequest>
    {
        public CreateWorkflowRequestValidator()
        {
            RuleFor(x => x.Nombre).NotEmpty().MinimumLength(3).MaximumLength(100);
            RuleFor(x => x.CodigoProceso)
                .NotEmpty().MaximumLength(50)
                .Matches(@"^[A-Z0-9_]+$")
                .WithMessage("Solo may�sculas, n�meros y gui�n bajo. Ej: ORDEN_COMPRA");
        }
    }

    public class UpdateWorkflowRequestValidator : AbstractValidator<UpdateWorkflowRequest>
    {
        public UpdateWorkflowRequestValidator()
        {
            RuleFor(x => x.Nombre).NotEmpty().MinimumLength(3).MaximumLength(100);
        }
    }
}
