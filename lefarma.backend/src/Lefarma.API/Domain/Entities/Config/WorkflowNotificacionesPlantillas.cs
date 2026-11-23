namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowNotificacionesPlantillas
    {
        public int IdPlantilla { get; set; }
        public string Nombre { get; set; } = null!;
        public string? CodigoTipoNotificacion { get; set; }
        public string CodigoCanal { get; set; } = null!;
        public string? AsuntoTemplate { get; set; }
        public string CuerpoTemplate { get; set; } = null!;
        public string? ListadoRowHtml { get; set; }
        public bool Activo { get; set; } = true;
    }
}
