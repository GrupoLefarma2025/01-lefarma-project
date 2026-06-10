namespace Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs
{
    public class TipoSolicitudResponse
    {
        public int IdTipoSolicitud { get; set; }
        public string Nombre { get; set; }
        public string Clave { get; set; }
        public string Categoria { get; set; }
        public bool EsIncidencia { get; set; }
        public bool EsPermiso { get; set; }
        public bool RequiereReposicionTiempo { get; set; }
        public bool RequiereFechaFin { get; set; }
        public bool RequiereFechaRegreso { get; set; }
        public bool RequiereLugarComision { get; set; }
        public bool DescuentaNomina { get; set; }
        public bool DescuentaVacaciones { get; set; }
        public bool RequiereDocumentacion { get; set; }
        public bool RequiereValidacionRH { get; set; }
        public bool RequiereValidacionJefeDirecto { get; set; }
        public bool RequiereValidacionGerencia { get; set; }
        public bool RequiereValidacionDirector { get; set; }
    }
}
