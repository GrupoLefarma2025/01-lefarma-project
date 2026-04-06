namespace Lefarma.API.Features.Catalogos.Proveedores.DTOs
{
    public class ProveedorResponse
    {
        public int IdProveedor { get; set; }
        public string RazonSocial { get; set; } = string.Empty;
        public string? RazonSocialNormalizada { get; set; }
        public string? RFC { get; set; }
        public string? CodigoPostal { get; set; }
        public int? RegimenFiscalId { get; set; }
        public string? RegimenFiscalDescripcion { get; set; }
        public string? PersonaContacto { get; set; }
        public string? NotasGenerales { get; set; }
        public string? UsoCfdi { get; set; }
        public bool? AutorizadoPorCxP { get; set; }
        public DateTime FechaRegistro { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }

    public class CreateProveedorRequest
    {
        public required string RazonSocial { get; set; } = null!;
        public string? RFC { get; set; }
        public string? CodigoPostal { get; set; }
        public int? RegimenFiscalId { get; set; }
        public string? PersonaContacto { get; set; }
        public string? NotasGenerales { get; set; }
        public string? UsoCfdi { get; set; }
    }

    public class UpdateProveedorRequest
    {
        public required int IdProveedor { get; set; }
        public required string RazonSocial { get; set; } = null!;
        public string? RFC { get; set; }
        public string? CodigoPostal { get; set; }
        public int? RegimenFiscalId { get; set; }
        public string? PersonaContacto { get; set; }
        public string? NotasGenerales { get; set; }
        public string? UsoCfdi { get; set; }
    }

    public class ProveedorRequest
    {
        public string? RazonSocial { get; set; }
        public string? RFC { get; set; }
        public string? OrderBy { get; set; }
        public string? OrderDirection { get; set; }
    }
}
