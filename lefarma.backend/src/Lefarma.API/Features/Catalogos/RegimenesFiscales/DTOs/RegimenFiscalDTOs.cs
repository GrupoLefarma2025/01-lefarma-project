namespace Lefarma.API.Features.Catalogos.RegimenesFiscales.DTOs
{
public class RegimenFiscalResponse
    {
        public int IdRegimenFiscal { get; set; }
        public string Clave { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public string TipoPersona { get; set; } = string.Empty;
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
    }

    public class CreateRegimenFiscalRequest
    {
        public required string Clave { get; set; } = null!;
        public required string Descripcion { get; set; } = null!;
        public required string TipoPersona { get; set; } = null!;
        public bool Activo { get; set; } = true;
    }

    public class UpdateRegimenFiscalRequest
    {
        public required int IdRegimenFiscal { get; set; }
        public required string Clave { get; set; } = null!;
        public required string Descripcion { get; set; } = null!;
        public required string TipoPersona { get; set; } = null!;
        public bool Activo { get; set; }
    }

    public class RegimenFiscalRequest
    {
        public string? Clave { get; set; }
        public string? TipoPersona { get; set; }
        public bool? Activo { get; set; }
        public string? OrderBy { get; set; }
        public string? OrderDirection { get; set; }
    }
}
