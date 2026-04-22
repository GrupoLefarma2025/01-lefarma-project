using FluentValidation;
using Lefarma.API.Features.Facturas.DTOs;

namespace Lefarma.API.Features.Facturas;

public class SubirComprobanteRequestValidator : AbstractValidator<SubirComprobanteRequest>
{
    private static readonly string[] TiposGasto = ["cfdi", "ticket", "nota", "recibo", "manual"];
    private static readonly string[] TiposPago  = ["spei", "transferencia", "cheque", "efectivo", "tarjeta", "otro"];
    private static readonly string[] Categorias = ["gasto", "pago"];

    public SubirComprobanteRequestValidator()
    {
        RuleFor(x => x.Categoria)
            .NotEmpty()
            .Must(c => Categorias.Contains(c))
            .WithMessage("Categoria debe ser: gasto o pago");

        RuleFor(x => x.TipoComprobante)
            .NotEmpty()
            .Must((req, tipo) => req.Categoria == "pago"
                ? TiposPago.Contains(tipo)
                : TiposGasto.Contains(tipo))
            .WithMessage("TipoComprobante inválido para la categoría indicada");

        // Para gasto sin CFDI requiere TotalManual
        RuleFor(x => x.TotalManual)
            .GreaterThan(0)
            .When(x => x.Categoria == "gasto" && x.TipoComprobante != "cfdi")
            .WithMessage("TotalManual es requerido y debe ser mayor a 0 para comprobantes sin CFDI");

        // Para pago requiere MontoPago
        RuleFor(x => x.MontoPago)
            .GreaterThan(0)
            .When(x => x.Categoria == "pago")
            .WithMessage("MontoPago es requerido para comprobantes de pago");

        RuleFor(x => x.IdEmpresa).GreaterThan(0);
    }
}

public class AsignarPartidasRequestValidator : AbstractValidator<AsignarPartidasRequest>
{
    public AsignarPartidasRequestValidator()
    {
        RuleFor(x => x.Asignaciones)
            .NotEmpty()
            .WithMessage("Debe incluir al menos una asignación");

        RuleForEach(x => x.Asignaciones).SetValidator(new AsignacionItemValidator());
    }
}

public class AsignacionItemValidator : AbstractValidator<AsignacionItemRequest>
{
    public AsignacionItemValidator()
    {
        RuleFor(x => x.IdPartida).GreaterThan(0);
        RuleFor(x => x.CantidadAsignada).GreaterThan(0);
        RuleFor(x => x.ImporteAsignado).GreaterThan(0);
    }
}
