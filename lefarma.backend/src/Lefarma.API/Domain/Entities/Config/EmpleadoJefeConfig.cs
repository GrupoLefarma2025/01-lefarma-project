namespace Lefarma.API.Domain.Entities.Config
{
    public class EmpleadoJefeConfig
    {
        public int IdConfig { get; set; }
        public int IdUsuario { get; set; }
        public int Nivel { get; set; }
        public bool Aplica { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }
}
