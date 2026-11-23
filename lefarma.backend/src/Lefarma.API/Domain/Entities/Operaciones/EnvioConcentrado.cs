using Lefarma.API.Domain.Entities.Auth;

namespace Lefarma.API.Domain.Entities.Operaciones
{
    public class EnvioConcentrado
    {
        public int IdEnvioConcentrado { get; set; }
        public int IdUsuarioEnvio { get; set; }
        public DateTime FechaEnvio { get; set; }
        
        public string Estado { get; set; } = "PENDIENTE";
        
        public DateTime? FechaRespuesta { get; set; }
        public int? IdUsuarioRespuesta { get; set; }
        public string? ComentarioRespuesta { get; set; }
        
        public string TokenSeguridad { get; set; } = string.Empty;
        
        public decimal Total { get; set; }
        public int CantidadOrdenes { get; set; }
        
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
        
        public bool Activo { get; set; } = true;
        
        public virtual ICollection<OrdenCompra> Ordenes { get; set; } = new List<OrdenCompra>();
    }
}
