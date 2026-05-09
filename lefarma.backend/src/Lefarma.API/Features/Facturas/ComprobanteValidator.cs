using FluentValidation;
using Lefarma.API.Features.Facturas.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Facturas;

public class SubirComprobanteRequestValidator : AbstractValidator<SubirComprobanteRequest>
{
    private static readonly string[] TiposGasto = ["cfdi", "ticket", "nota", "recibo", "manual"];
    private static readonly string[] Categorias = ["gasto", "pago"];

    public SubirComprobanteRequestValidator()
    {
        RuleFor(x => x.Categoria)
            .NotEmpty()
            .Must(c => Categorias.Contains(c))
            .WithMessage("Categoria debe ser: gasto o pago");

        RuleFor(x => x.TipoComprobante)
            .NotEmpty()
            .Must((req, tipo) => req.Categoria == "pago" || TiposGasto.Contains(tipo))
            .WithMessage("TipoComprobante invalido para la categoria indicada");

        RuleFor(x => x.IdMedioPago)
            .NotNull()
            .When(x => x.Categoria == "pago")
            .WithMessage("IdMedioPago es requerido para comprobantes de pago");

        RuleFor(x => x.TotalManual)
            .GreaterThan(0)
            .When(x => x.Categoria == "gasto" && x.TipoComprobante != "cfdi")
            .WithMessage("TotalManual es requerido y debe ser mayor a 0 para comprobantes sin CFDI");

        RuleFor(x => x.MontoPago)
            .GreaterThan(0)
            .When(x => x.Categoria == "pago")
            .WithMessage("MontoPago es requerido para comprobantes de pago");

        RuleFor(x => x.IdEmpresa).GreaterThan(0);
    }
}
