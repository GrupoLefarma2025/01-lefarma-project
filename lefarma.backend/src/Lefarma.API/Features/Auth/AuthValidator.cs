using FluentValidation;
using Lefarma.API.Features.Auth.DTOs;

namespace Lefarma.API.Features.Auth;
/// <summary>
/// Validator for LoginStepOneRequest.
/// </summary>
public class LoginStepOneRequestValidator : AbstractValidator<LoginStepOneRequest>
{
    public LoginStepOneRequestValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("El nombre de usuario es requerido")
            .MaximumLength(256).WithMessage("El nombre de usuario no puede exceder 256 caracteres");
    }
}

/// <summary>
/// Validator for LoginStepTwoRequest.
/// </summary>
public class LoginStepTwoRequestValidator : AbstractValidator<LoginStepTwoRequest>
{
    public LoginStepTwoRequestValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("El nombre de usuario es requerido")
            .MaximumLength(256).WithMessage("El nombre de usuario no puede exceder 256 caracteres");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("La contrasena es requerida")
            .MinimumLength(1).WithMessage("La contrasena es requerida");

        RuleFor(x => x.Domain)
            .NotEmpty().WithMessage("El dominio es requerido")
            .MaximumLength(256).WithMessage("El dominio no puede exceder 256 caracteres");
    }
}

/// <summary>
/// Validator for RefreshTokenRequest.
/// </summary>
public class RefreshTokenRequestValidator : AbstractValidator<RefreshTokenRequest>
{
    public RefreshTokenRequestValidator()
    {
        RuleFor(x => x.RefreshToken)
            .NotEmpty().WithMessage("El refresh token es requerido");
    }
}
