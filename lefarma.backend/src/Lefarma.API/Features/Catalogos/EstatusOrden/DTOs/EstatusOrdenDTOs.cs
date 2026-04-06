namespace Lefarma.API.Features.Catalogos.EstatusOrden.DTOs
{
public class EstatusOrdenResponse
    {
        public int IdEstatusOrden { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public int? SiguienteEstatusId { get; set; }
        public bool RequiereAccion { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
    }

    public class EstatusOrdenRequest
    {
        public bool? Activo { get; set; }
        public bool? RequiereAccion { get; set; }
        public string? OrderBy { get; set; }
        public string? OrderDirection { get; set; }
    }
}
