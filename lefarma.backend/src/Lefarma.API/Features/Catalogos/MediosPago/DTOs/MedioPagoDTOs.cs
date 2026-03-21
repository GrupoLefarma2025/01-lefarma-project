namespace Lefarma.API.Features.Catalogos.MediosPago.DTOs
{
    public class MedioPagoResponse
    {
        public int IdMedioPago { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public string Clave { get; set; } = string.Empty;
        public string CodigoSAT { get; set; } = string.Empty;
        public bool RequiereReferencia { get; set; }
        public bool RequiereAutorizacion { get; set; }
        public decimal? LimiteMonto { get; set; }
        public int? PlazoMaximoDias { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }

    public class CreateMedioPagoRequest
    {
        public required string Nombre { get; set; }
        public string? Descripcion { get; set; }
        public string? Clave { get; set; }
        public string? CodigoSAT { get; set; }
        public bool RequiereReferencia { get; set; } = false;
        public bool RequiereAutorizacion { get; set; } = false;
        public decimal? LimiteMonto { get; set; }
        public int? PlazoMaximoDias { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class UpdateMedioPagoRequest
    {
        public required int IdMedioPago { get; set; }
        public required string Nombre { get; set; }
        public string? Descripcion { get; set; }
        public string? Clave { get; set; }
        public string? CodigoSAT { get; set; }
        public bool RequiereReferencia { get; set; }
        public bool RequiereAutorizacion { get; set; }
        public decimal? LimiteMonto { get; set; }
        public int? PlazoMaximoDias { get; set; }
        public bool Activo { get; set; }
    }
}
