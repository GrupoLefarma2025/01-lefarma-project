using Lefarma.API.Domain.Entities.Auth;

namespace Lefarma.API.Domain.Entities.Operaciones
{
    public class EnvioConcentrado
    {
        public int IdEnvioConcentrado { get; set; }
        public int IdUsuarioEnvio { get; set; }
        public DateTime FechaEnvio { get; set; }
        
        // Estado: PENDIENTE, APROBADO, DEVUELTO
        public string Estado { get; set; } = "PENDIENTE";
        
        // Respuesta del sistema externo
        public DateTime? FechaRespuesta { get; set; }
        public int? IdUsuarioRespuesta { get; set; }
        public string? ComentarioRespuesta { get; set; }
        
        // Seguridad
        public string TokenSeguridad { get; set; } = string.Empty;
        
        // Datos del concentrado
        public decimal Total { get; set; }
        public int CantidadOrdenes { get; set; }
        
        // Auditoría
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
        
        public bool Activo { get; set; } = true;
        
        // Navegación
        public virtual ICollection<OrdenCompra> Ordenes { get; set; } = new List<OrdenCompra>();
    }
}
