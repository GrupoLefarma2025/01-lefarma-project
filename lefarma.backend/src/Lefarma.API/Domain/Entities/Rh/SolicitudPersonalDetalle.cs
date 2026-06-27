namespace Lefarma.API.Domain.Entities.Rh
{
    public class SolicitudPersonalDetalle
    {
        public int IdDetalle { get; set; }
        public int IdSolicitud { get; set; }
        public DateTime Fecha { get; set; }
        public string? Comentario { get; set; }
        public DateTime FechaCreacion { get; set; }

        public virtual SolicitudPersonal? Solicitud { get; set; }
    }
}
