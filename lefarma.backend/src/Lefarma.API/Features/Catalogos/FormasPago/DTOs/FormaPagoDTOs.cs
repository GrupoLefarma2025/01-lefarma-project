namespace Lefarma.API.Features.Catalogos.FormasPago.DTOs
{
    public class FormaPagoResponse
    {
        public int IdFormaPago { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public string Clave { get; set; } = string.Empty;
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }

    public class CreateFormaPagoRequest
    {
        public required string Nombre { get; set; }
        public string? Descripcion { get; set; }
        public string? Clave { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class UpdateFormaPagoRequest
    {
        public required int IdFormaPago { get; set; }
        public required string Nombre { get; set; }
        public string? Descripcion { get; set; }
        public string? Clave { get; set; }
        public bool Activo { get; set; }
    }
}
