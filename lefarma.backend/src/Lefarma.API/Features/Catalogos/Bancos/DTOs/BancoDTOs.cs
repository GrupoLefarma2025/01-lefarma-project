namespace Lefarma.API.Features.Catalogos.Bancos.DTOs
{
    public class BancoResponse
    {
        public int IdBanco { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? Clave { get; set; }
        public string? CodigoSWIFT { get; set; }
        public string? Descripcion { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }

    public class CreateBancoRequest
    {
        public required string Nombre { get; set; }
        public string? Clave { get; set; }
        public string? CodigoSWIFT { get; set; }
        public string? Descripcion { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class UpdateBancoRequest
    {
        public required int IdBanco { get; set; }
        public required string Nombre { get; set; }
        public string? Clave { get; set; }
        public string? CodigoSWIFT { get; set; }
        public string? Descripcion { get; set; }
        public bool Activo { get; set; }
    }
}
