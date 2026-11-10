using FluentValidation;
using Lefarma.API.Features.Configuracion.DTOs;

namespace Lefarma.API.Features.Configuracion.Validators;

public class CreateConfigVariableRequestValidator : AbstractValidator<CreateConfigVariableRequest>
{
    public CreateConfigVariableRequestValidator()
    {
        RuleFor(x => x.IdOperacion)
            .NotEmpty().WithMessage("El identificador de operación (idOperacion) es obligatorio.");

        RuleFor(x => x.Clave)
            .NotEmpty().WithMessage("La clave es obligatoria.")
            .MaximumLength(200).WithMessage("La clave no puede exceder 200 caracteres.");

        RuleFor(x => x.Nombre)
            .NotEmpty().WithMessage("El nombre es obligatorio.")
            .MaximumLength(200).WithMessage("El nombre no puede exceder 200 caracteres.");

        RuleFor(x => x.Descripcion)
            .MaximumLength(1000).WithMessage("La descripción no puede exceder 1000 caracteres.");

        RuleFor(x => x.TipoDato)
            .NotEmpty().WithMessage("El tipo de dato es obligatorio.")
            .Must(ConfiguracionTiposDato.EsValido)
            .WithMessage($"El tipo de dato debe ser uno de: {string.Join(", ", ConfiguracionTiposDato.Todos)}.");

        RuleFor(x => x)
            .Must(x => ConfiguracionReglas.TieneDestino(
                x.DisponibleBackend,
                x.DisponibleFrontend,
                x.DisponibleSql,
                x.DisponibleIntegraciones))
            .WithName("disponibleBackend")
            .WithMessage("La variable debe estar disponible al menos en un destino (backend, frontend, sql o integraciones).");

        RuleFor(x => x.Valor)
            .Custom((valor, contexto) =>
            {
                var solicitud = (CreateConfigVariableRequest)contexto.InstanceToValidate;
                if (!ConfiguracionTiposDato.EsValido(solicitud.TipoDato))
                {
                    return;
                }

                var resultado = ConfiguracionValueValidator.Validar(solicitud.TipoDato, valor, solicitud.Esquema);
                if (!resultado.IsError)
                {
                    return;
                }

                foreach (var error in resultado.Errors)
                {
                    contexto.AddFailure("Valor", error.Description);
                }
            });
    }
}

public class UpdateConfigVariableRequestValidator : AbstractValidator<UpdateConfigVariableRequest>
{
    public UpdateConfigVariableRequestValidator()
    {
        RuleFor(x => x.IdOperacion)
            .NotEmpty().WithMessage("El identificador de operación (idOperacion) es obligatorio.");

        RuleFor(x => x.VersionEsperada)
            .GreaterThan(0).WithMessage("La versión esperada debe ser mayor a 0.");

        RuleFor(x => x.Nombre)
            .NotEmpty().WithMessage("El nombre es obligatorio.")
            .MaximumLength(200).WithMessage("El nombre no puede exceder 200 caracteres.");

        RuleFor(x => x.Descripcion)
            .MaximumLength(1000).WithMessage("La descripción no puede exceder 1000 caracteres.");

        RuleFor(x => x)
            .Must(x => ConfiguracionReglas.TieneDestino(
                x.DisponibleBackend,
                x.DisponibleFrontend,
                x.DisponibleSql,
                x.DisponibleIntegraciones))
            .WithName("disponibleBackend")
            .WithMessage("La variable debe estar disponible al menos en un destino (backend, frontend, sql o integraciones).");

        RuleFor(x => x.TipoDato)
            .Must(tipo => string.IsNullOrWhiteSpace(tipo) || ConfiguracionTiposDato.EsValido(tipo))
            .WithMessage($"El tipo de dato debe ser uno de: {string.Join(", ", ConfiguracionTiposDato.Todos)}.");
    }
}

public class CambiarEstadoVariableRequestValidator : AbstractValidator<CambiarEstadoVariableRequest>
{
    public CambiarEstadoVariableRequestValidator()
    {
        RuleFor(x => x.IdOperacion)
            .NotEmpty().WithMessage("El identificador de operación (idOperacion) es obligatorio.");

        RuleFor(x => x.VersionEsperada)
            .GreaterThan(0).WithMessage("La versión esperada debe ser mayor a 0.");
    }
}

public class RestaurarVariableRequestValidator : AbstractValidator<RestaurarVariableRequest>
{
    public RestaurarVariableRequestValidator()
    {
        RuleFor(x => x.IdOperacion)
            .NotEmpty().WithMessage("El identificador de operación (idOperacion) es obligatorio.");

        RuleFor(x => x.IdBitacoraOrigen)
            .GreaterThan(0).WithMessage("La entrada de bitácora de origen es obligatoria.");

        RuleFor(x => x.VersionEsperada)
            .GreaterThan(0).WithMessage("La versión esperada debe ser mayor a 0.");
    }
}

public class FrontendConsultarRequestValidator : AbstractValidator<FrontendConsultarRequest>
{
    public FrontendConsultarRequestValidator()
    {
        RuleFor(x => x.Variables)
            .NotNull().WithMessage("El arreglo de variables es obligatorio.");

        RuleForEach(x => x.Variables)
            .ChildRules(variable =>
            {
                variable.RuleFor(v => v.Clave)
                    .NotEmpty().WithMessage("La clave es obligatoria.")
                    .MaximumLength(200).WithMessage("La clave no puede exceder 200 caracteres.");
            });
    }
}

public class FrontendSyncRequestValidator : AbstractValidator<FrontendSyncRequest>
{
    public FrontendSyncRequestValidator()
    {
        RuleFor(x => x.Desde)
            .GreaterThanOrEqualTo(0).WithMessage("La revisión 'desde' no puede ser negativa.");
    }
}

public class CrearIntegracionRequestValidator : AbstractValidator<CrearIntegracionRequest>
{
    public CrearIntegracionRequestValidator()
    {
        RuleFor(x => x.Nombre)
            .NotEmpty().WithMessage("El nombre es obligatorio.")
            .MaximumLength(200).WithMessage("El nombre no puede exceder 200 caracteres.");

        RuleForEach(x => x.ClavesPermitidas)
            .NotEmpty().WithMessage("Las claves permitidas no pueden estar vacías.")
            .MaximumLength(200).WithMessage("Cada clave permitida no puede exceder 200 caracteres.");
    }
}
