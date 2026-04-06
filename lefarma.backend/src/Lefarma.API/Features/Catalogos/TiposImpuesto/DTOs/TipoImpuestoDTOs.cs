namespace Lefarma.API.Features.Catalogos.TiposImpuesto.DTOs
{
    public class TipoImpuestoResponse
    {
        public int IdTipoImpuesto { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Clave { get; set; } = string.Empty;
        public decimal Tasa { get; set; }
        public string? Descripcion { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }

    public class CreateTipoImpuestoRequest
    {
        public required string Nombre { get; set; }
        public required string Clave { get; set; }
        public required decimal Tasa { get; set; }
        public string? Descripcion { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class UpdateTipoImpuestoRequest
    {
        public required int IdTipoImpuesto { get; set; }
        public required string Nombre { get; set; }
        public required string Clave { get; set; }
        public required decimal Tasa { get; set; }
        public string? Descripcion { get; set; }
        public bool Activo { get; set; }
    }
}
