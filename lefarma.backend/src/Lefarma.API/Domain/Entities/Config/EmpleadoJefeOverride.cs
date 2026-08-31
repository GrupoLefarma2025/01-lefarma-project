namespace Lefarma.API.Domain.Entities.Config
{
    public class EmpleadoJefeOverride
    {
        public int IdOverride { get; set; }
        public int IdUsuario { get; set; }
        public int Nivel { get; set; }
        public int IdUsuarioJefe { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }
}