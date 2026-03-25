using FluentValidation;
using Lefarma.API.Features.Help.DTOs;

namespace Lefarma.API.Features.Help.DTOs;

/// <summary>
/// Request para crear un nuevo artículo de ayuda
/// </summary>
public record CreateHelpArticleRequest
{
    public string Titulo { get; init; } = string.Empty;
    public string Contenido { get; init; } = string.Empty;
    public string? Resumen { get; init; }
    public string Modulo { get; init; } = string.Empty;
    public string Tipo { get; init; } = string.Empty;
    public string? Categoria { get; init; }
    public int Orden { get; init; }
}

/// <summary>
/// Validador para CreateHelpArticleRequest
/// </summary>
public class CreateHelpArticleValidator : AbstractValidator<CreateHelpArticleRequest>
{
    public CreateHelpArticleValidator()
    {
        RuleFor(x => x.Titulo)
            .NotEmpty().WithMessage("El título es requerido")
            .MaximumLength(200).WithMessage("El título no puede exceder 200 caracteres");

        RuleFor(x => x.Contenido)
            .NotEmpty().WithMessage("El contenido es requerido");

        RuleFor(x => x.Resumen)
            .MaximumLength(500).WithMessage("El resumen no puede exceder 500 caracteres");

        RuleFor(x => x.Modulo)
            .NotEmpty().WithMessage("El módulo es requerido")
            .Must(BeValidModule).WithMessage("Módulo no válido");

        RuleFor(x => x.Tipo)
            .NotEmpty().WithMessage("El tipo es requerido")
            .Must(BeValidType).WithMessage("Tipo debe ser: usuario, desarrollador o ambos");
    }

    private bool BeValidModule(string modulo)
    {
        var validModules = new[] { "Catalogos", "Auth", "Notificaciones", "Profile", "Admin", "SystemConfig", "General" };
        return validModules.Contains(modulo);
    }

    private bool BeValidType(string tipo)
    {
        var validTypes = new[] { "usuario", "desarrollador", "ambos" };
        return validTypes.Contains(tipo);
    }
}
