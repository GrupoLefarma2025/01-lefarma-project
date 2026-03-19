namespace Lefarma.API.Features.Catalogos.UnidadesMedida.DTOs
{
    public class UnidadMedidaResponse
    {
        public int IdUnidadMedida { get; set; }
        public int IdMedida { get; set; }
        public string? NombreMedida { get; set; }
        public string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public string Abreviatura { get; set; } = null!;
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }

    public class CreateUnidadMedidaRequest
    {
        public required int IdMedida { get; set; }
        public required string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public required string Abreviatura { get; set; } = null!;
        public bool Activo { get; set; } = true;
    }

    public class UpdateUnidadMedidaRequest
    {
        public required int IdUnidadMedida { get; set; }
        public required int IdMedida { get; set; }
        public required string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public required string Abreviatura { get; set; } = null!;
        public bool Activo { get; set; }
    }
}
