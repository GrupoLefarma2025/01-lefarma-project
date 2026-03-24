using FluentValidation;
using Lefarma.API.Features.Profile.DTOs;

namespace Lefarma.API.Features.Profile;

/// <summary>
/// Validador para actualización de perfil
/// </summary>
public class UpdateProfileRequestValidator : AbstractValidator<UpdateProfileRequest>
{
    public UpdateProfileRequestValidator()
    {
        // Validaciones de datos básicos
        RuleFor(x => x.NombreCompleto)
            .MaximumLength(255)
            .When(x => !string.IsNullOrWhiteSpace(x.NombreCompleto))
            .WithMessage("El nombre completo no puede exceder 255 caracteres");

        RuleFor(x => x.Correo)
            .EmailAddress()
            .When(x => !string.IsNullOrWhiteSpace(x.Correo))
            .WithMessage("El correo no es válido")
            .MaximumLength(255)
            .When(x => !string.IsNullOrWhiteSpace(x.Correo))
            .WithMessage("El correo no puede exceder 255 caracteres");

        // Validaciones de datos laborales
        RuleFor(x => x.Puesto)
            .MaximumLength(100)
            .When(x => !string.IsNullOrWhiteSpace(x.Puesto))
            .WithMessage("El puesto no puede exceder 100 caracteres");

        RuleFor(x => x.NumeroEmpleado)
            .MaximumLength(50)
            .When(x => !string.IsNullOrWhiteSpace(x.NumeroEmpleado))
            .WithMessage("El número de empleado no puede exceder 50 caracteres");

        RuleFor(x => x.FirmaDigital)
            .MaximumLength(500)
            .When(x => !string.IsNullOrWhiteSpace(x.FirmaDigital))
            .WithMessage("La firma digital no puede exceder 500 caracteres");

        // Validaciones de contacto
        RuleFor(x => x.TelefonoOficina)
            .MaximumLength(20)
            .When(x => !string.IsNullOrWhiteSpace(x.TelefonoOficina))
            .WithMessage("El teléfono de oficina no puede exceder 20 caracteres");

        RuleFor(x => x.Extension)
            .MaximumLength(10)
            .When(x => !string.IsNullOrWhiteSpace(x.Extension))
            .WithMessage("La extensión no puede exceder 10 caracteres");

        RuleFor(x => x.Celular)
            .MaximumLength(20)
            .When(x => !string.IsNullOrWhiteSpace(x.Celular))
            .WithMessage("El celular no puede exceder 20 caracteres");

        RuleFor(x => x.TelegramChat)
            .MaximumLength(100)
            .When(x => !string.IsNullOrWhiteSpace(x.TelegramChat))
            .WithMessage("El chat de Telegram no puede exceder 100 caracteres");

        // Validaciones de configuración de interfaz
        RuleFor(x => x.AvatarUrl)
            .MaximumLength(500)
            .When(x => !string.IsNullOrWhiteSpace(x.AvatarUrl))
            .WithMessage("La URL del avatar no puede exceder 500 caracteres");

        RuleFor(x => x.TemaInterfaz)
            .Must(x => x == "light" || x == "dark")
            .When(x => !string.IsNullOrWhiteSpace(x.TemaInterfaz))
            .WithMessage("El tema de interfaz debe ser 'light' o 'dark'");

        RuleFor(x => x.DashboardInicio)
            .MaximumLength(100)
            .When(x => !string.IsNullOrWhiteSpace(x.DashboardInicio))
            .WithMessage("El dashboard de inicio no puede exceder 100 caracteres");

        // Validación de delegación
        RuleFor(x => x.DelegacionHasta)
            .GreaterThan(DateTime.UtcNow)
            .When(x => x.DelegacionHasta.HasValue)
            .WithMessage("La fecha de delegación debe ser futura");
    }
}
