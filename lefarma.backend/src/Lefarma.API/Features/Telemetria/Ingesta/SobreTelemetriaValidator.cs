using FluentValidation;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Telemetria.Ingesta;

public sealed class SobreTelemetriaValidator : AbstractValidator<SobreTelemetriaDto>
{
    public SobreTelemetriaValidator(IOptions<TelemetriaOpciones> opciones)
    {
        var maximoEventos = opciones.Value.LoteMaximoEventos > 0 ? opciones.Value.LoteMaximoEventos : 100;

        RuleFor(x => x.LoteId)
            .NotEmpty().WithMessage("El lote necesita un identificador.")
            .MaximumLength(64)
            .Matches("^[A-Za-z0-9_-]+$")
            .WithMessage("El identificador del lote solo admite letras, números, guion y guion bajo.");

        RuleFor(x => x.EnviadoEn)
            .Must(SerReciente).WithMessage("La marca de envío está fuera de la ventana permitida.");

        RuleFor(x => x.VisitaId).MaximumLength(64);
        RuleFor(x => x.VersionApp).MaximumLength(40);

        RuleFor(x => x.Eventos)
            .NotEmpty().WithMessage("El lote no trae eventos.")
            .Must(eventos => eventos.Count <= maximoEventos)
            .WithMessage($"El lote supera el máximo de {maximoEventos} eventos.");

        RuleForEach(x => x.Eventos).SetValidator(new EventoTelemetriaValidator());
    }

    private static bool SerReciente(DateTime? enviadoEn)
    {
        if (enviadoEn is null)
        {
            return false;
        }

        var momento = enviadoEn.Value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(enviadoEn.Value, DateTimeKind.Utc)
            : enviadoEn.Value.ToUniversalTime();

        return momento >= DateTime.UtcNow.AddDays(-7) && momento <= DateTime.UtcNow.AddMinutes(5);
    }
}

public sealed class EventoTelemetriaValidator : AbstractValidator<EventoTelemetriaDto>
{
    private static readonly string[] Tipos = ["error", "clic", "mapa_calor", "visita"];
    private static readonly string[] TiposError = ["arranque", "js", "promesa", "react", "http"];

    public EventoTelemetriaValidator()
    {
        RuleFor(x => x.Tipo)
            .NotEmpty().WithMessage("El evento necesita un tipo.")
            .Must(tipo => Tipos.Contains((tipo ?? string.Empty).Trim().ToLowerInvariant()))
            .WithMessage("Tipo de evento desconocido.");

        RuleFor(x => x.OcurridoEn)
            .Must(SerReciente).WithMessage("El evento está fuera de la ventana permitida.");

        RuleFor(x => x.Ruta)
            .NotEmpty().MaximumLength(512)
            .Must(ruta => ruta!.StartsWith('/')).WithMessage("La ruta debe empezar con /.");

        When(x => Es(x, "error"), () =>
        {
            RuleFor(x => x.TipoError)
                .NotEmpty()
                .Must(tipo => TiposError.Contains((tipo ?? string.Empty).Trim().ToLowerInvariant()))
                .WithMessage("Tipo de error desconocido.");
            RuleFor(x => x.Mensaje).NotEmpty().MaximumLength(2048);
            RuleFor(x => x.Stack).MaximumLength(16384);
            RuleFor(x => x.Url).MaximumLength(2048);
            RuleFor(x => x.MetodoHttp).MaximumLength(10);
            RuleFor(x => x.EstadoHttp).Must(valor => valor is null or (>= 100 and <= 599));
            RuleFor(x => x.RequestId).MaximumLength(100);
            RuleFor(x => x.Navegador).MaximumLength(256);
            RuleFor(x => x.Contexto).MaximumLength(4096);
        });

        When(x => Es(x, "clic"), () =>
        {
            RuleFor(x => x.Elemento).MaximumLength(200);
            RuleFor(x => x.Etiqueta).MaximumLength(120);
            RuleFor(x => x.TipoElemento).MaximumLength(30);
            RuleFor(x => x.X).Must(valor => valor is null or >= 0);
            RuleFor(x => x.Y).Must(valor => valor is null or >= 0);
            RuleFor(x => x.ViewportAncho).Must(valor => valor is null or (> 0 and <= 20000));
            RuleFor(x => x.ViewportAlto).Must(valor => valor is null or (> 0 and <= 20000));
        });

        When(x => Es(x, "mapa_calor"), () =>
        {
            RuleFor(x => x.Celdas).NotNull().WithMessage("Falta la rejilla del mapa de calor.");
            RuleFor(x => x.Columnas).Must(valor => valor is > 0 and <= 80);
            RuleFor(x => x.Filas).Must(valor => valor is > 0 and <= 400);
            RuleFor(x => x.TamanoCelda).Must(valor => valor is >= 8 and <= 128);
            RuleFor(x => x.ViewportAncho).Must(valor => valor is > 0 and <= 20000);
            RuleFor(x => x.ViewportAlto).Must(valor => valor is > 0 and <= 20000);
            RuleFor(x => x.ScrollMax).Must(valor => valor is null or >= 0);
            RuleFor(x => x.SegundosVisibles).Must(valor => valor is null or (>= 0 and <= 86400));
            RuleFor(x => x.Celdas)
                .Must((evento, celdas) =>
                {
                    var esperadas = (evento.Columnas ?? 0) * (evento.Filas ?? 0);
                    return celdas is not null && esperadas > 0 && celdas.Count == esperadas;
                })
                .WithMessage("La rejilla no coincide con las columnas y filas declaradas.")
                .Must(celdas => celdas is null || celdas.All(valor => valor is >= 0 and <= 100000))
                .WithMessage("Hay celdas fuera de rango.");
        });

        When(x => Es(x, "visita"), () =>
        {
            RuleFor(x => x.Segundos).Must(valor => valor is null or (>= 0 and <= 86400));
            RuleFor(x => x.ScrollMax).Must(valor => valor is null or >= 0);
            RuleFor(x => x.Navegador).MaximumLength(256);
            RuleFor(x => x.Sistema).MaximumLength(120);
        });
    }

    private static bool Es(EventoTelemetriaDto evento, string tipo) =>
        string.Equals(evento.Tipo?.Trim(), tipo, StringComparison.OrdinalIgnoreCase);

    private static bool SerReciente(DateTime? ocurridoEn)
    {
        if (ocurridoEn is null)
        {
            return false;
        }

        var momento = ocurridoEn.Value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(ocurridoEn.Value, DateTimeKind.Utc)
            : ocurridoEn.Value.ToUniversalTime();

        return momento >= DateTime.UtcNow.AddDays(-30) && momento <= DateTime.UtcNow.AddMinutes(5);
    }
}
