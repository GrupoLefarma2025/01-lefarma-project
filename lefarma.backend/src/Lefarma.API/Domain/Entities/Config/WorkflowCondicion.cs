namespace Lefarma.API.Domain.Entities.Config {
public class WorkflowCondicion
    {
        public int IdCondicion { get; set; }
        public int IdAccion { get; set; }
        public string CampoEvaluacion { get; set; } = null!; // Propiedad de OrdenCompra (ej: 'Total', 'RequierePagoAnticipado')
        public string Operador { get; set; } = null!;         // '>', '<', '=', 'true', 'false'
        public string ValorComparacion { get; set; } = null!;
        public int IdPasoSiCumple { get; set; }
        public bool Activo { get; set; } = true;

        public virtual WorkflowAccion? Accion { get; set; }
        public virtual WorkflowPaso? PasoSiCumple { get; set; }
    }
}
