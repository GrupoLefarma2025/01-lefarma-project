using FluentValidation;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;
using Lefarma.API.Shared.Helpers;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal
{
    public class TipoSolicitudQueryRequestValidator : AbstractValidator<TipoSolicitudRequest>
    {
        public TipoSolicitudQueryRequestValidator()
        {
            RuleFor(x => x.OrderBy)
                .Must(value => string.IsNullOrEmpty(value) ||
                    new[] { "nombre", "clave", "categoria", "fechacreacion" }.Contains(value.ToLower()))
                .WithMessage("OrderBy debe ser 'nombre', 'clave', 'categoria' o 'fechacreacion'")
                .When(x => !string.IsNullOrEmpty(x.OrderBy));

            RuleFor(x => x.OrderDirection)
                .Must(value => string.IsNullOrEmpty(value) ||
                    new[] { "asc", "desc" }.Contains(value.ToLower()))
                .WithMessage("OrderDirection debe ser 'asc' o 'desc'")
                .When(x => !string.IsNullOrEmpty(x.OrderDirection));
        }
    }

    public class CreateTipoSolicitudRequestValidator : AbstractValidator<CreateTipoSolicitudRequest>
    {
        public CreateTipoSolicitudRequestValidator()
        {
            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre del tipo de solicitud es obligatorio")
                .MaximumLength(100).WithMessage("El nombre no puede exceder 100 caracteres");

            RuleFor(x => x.Clave)
                .NotEmpty().WithMessage("La clave es obligatoria")
                .MaximumLength(50).WithMessage("La clave no puede exceder 50 caracteres");

            RuleFor(x => x.Categoria)
                .NotEmpty().WithMessage("La categoría es obligatoria")
                .Must(SerCategoriaValida).WithMessage("La categoría no es válida");

            RuleFor(x => x.Descripcion)
                .MaximumLength(500).WithMessage("La descripción no puede exceder 500 caracteres")
                .When(x => !string.IsNullOrEmpty(x.Descripcion));

            RuleFor(x => x.PeriodoLimite)
                .Must(SerPeriodoValidoONull)
                .WithMessage("PeriodoLimite debe ser 'semana', 'quincena' o 'mes'")
                .When(x => !string.IsNullOrEmpty(x.PeriodoLimite));

            RuleFor(x => x.LimitePorPeriodo)
                .GreaterThanOrEqualTo(1).WithMessage("El límite por periodo debe ser mayor a 0")
                .When(x => x.LimitePorPeriodo.HasValue);

            RuleFor(x => x.TotalParaDescuento)
                .GreaterThanOrEqualTo(1).WithMessage("El total para descuento debe ser mayor a 0")
                .When(x => x.TotalParaDescuento.HasValue);
        }

        private static bool SerCategoriaValida(string categoria)
        {
            return Enum.TryParse<CategoriaSolicitud>(categoria, ignoreCase: true, out _);
        }

        private static bool SerPeriodoValidoONull(string? periodo)
        {
            if (string.IsNullOrEmpty(periodo)) return true;
            return new[] { PeriodoHelper.Semana, PeriodoHelper.Quincena, PeriodoHelper.Mes }
                .Contains(periodo.ToLowerInvariant());
        }
    }

    public class UpdateTipoSolicitudRequestValidator : AbstractValidator<UpdateTipoSolicitudRequest>
    {
        public UpdateTipoSolicitudRequestValidator()
        {
            RuleFor(x => x.IdTipoSolicitud)
                .NotEmpty().WithMessage("El IdTipoSolicitud es obligatorio")
                .GreaterThan(0).WithMessage("El IdTipoSolicitud debe ser mayor a 0");

            RuleFor(x => x.Nombre)
                .NotEmpty().WithMessage("El nombre del tipo de solicitud es obligatorio")
                .MaximumLength(100).WithMessage("El nombre no puede exceder 100 caracteres");

            RuleFor(x => x.Clave)
                .NotEmpty().WithMessage("La clave es obligatoria")
                .MaximumLength(50).WithMessage("La clave no puede exceder 50 caracteres");

            RuleFor(x => x.Categoria)
                .NotEmpty().WithMessage("La categoría es obligatoria")
                .Must(SerCategoriaValida).WithMessage("La categoría no es válida");

            RuleFor(x => x.Descripcion)
                .MaximumLength(500).WithMessage("La descripción no puede exceder 500 caracteres")
                .When(x => !string.IsNullOrEmpty(x.Descripcion));

            RuleFor(x => x.PeriodoLimite)
                .Must(SerPeriodoValidoONull)
                .WithMessage("PeriodoLimite debe ser 'semana', 'quincena' o 'mes'")
                .When(x => !string.IsNullOrEmpty(x.PeriodoLimite));

            RuleFor(x => x.LimitePorPeriodo)
                .GreaterThanOrEqualTo(1).WithMessage("El límite por periodo debe ser mayor a 0")
                .When(x => x.LimitePorPeriodo.HasValue);

            RuleFor(x => x.TotalParaDescuento)
                .GreaterThanOrEqualTo(1).WithMessage("El total para descuento debe ser mayor a 0")
                .When(x => x.TotalParaDescuento.HasValue);
        }

        private static bool SerCategoriaValida(string categoria)
        {
            return Enum.TryParse<CategoriaSolicitud>(categoria, ignoreCase: true, out _);
        }

        private static bool SerPeriodoValidoONull(string? periodo)
        {
            if (string.IsNullOrEmpty(periodo)) return true;
            return new[] { PeriodoHelper.Semana, PeriodoHelper.Quincena, PeriodoHelper.Mes }
                .Contains(periodo.ToLowerInvariant());
        }
    }
}
