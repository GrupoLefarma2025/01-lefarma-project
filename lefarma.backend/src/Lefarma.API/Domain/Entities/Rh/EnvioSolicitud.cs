namespace Lefarma.API.Domain.Entities.Rh
{
    public class EnvioSolicitud
    {
        public int IdEnvio { get; set; }
        public int IdSolicitud { get; set; }
        public int IdUsuarioEnvio { get; set; }
        public DateTime FechaEnvio { get; set; }

        public string Estado { get; set; } = "PENDIENTE";

        public DateTime? FechaRespuesta { get; set; }
        public int? IdUsuarioRespuesta { get; set; }
        public string? ComentarioRespuesta { get; set; }

        public string TokenSeguridad { get; set; } = string.Empty;

        public int? IdTipoSolicitud { get; set; }

        public virtual TipoSolicitud? TipoSolicitud { get; set; }
        public int IdUsuarioSolicitante { get; set; }

        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }

        public bool Activo { get; set; } = true;

        public virtual SolicitudPersonal? Solicitud { get; set; }
    }
}
