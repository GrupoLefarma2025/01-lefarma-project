namespace Lefarma.API.Features.Catalogos.CentrosCosto.DTOs
{
    public class CentroCostoResponse
    {
        public int IdCentroCosto { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string NombreNormalizado { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public string? DescripcionNormalizada { get; set; }
        public decimal? LimitePresupuesto { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }

    public class CreateCentroCostoRequest
    {
        public required string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public decimal? LimitePresupuesto { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class UpdateCentroCostoRequest
    {
        public required int IdCentroCosto { get; set; }
        public required string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public decimal? LimitePresupuesto { get; set; }
        public bool Activo { get; set; }
    }

    public class CentroCostoRequest
    {
        public string? Nombre { get; set; }
        public bool? Activo { get; set; }
        public string? OrderBy { get; set; }
        public string? OrderDirection { get; set; }
    }
}
