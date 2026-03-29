namespace Lefarma.API.Domain.Entities.Config
{
    public class WorkflowCondicion
    {
        public int IdCondicion { get; set; }
        public int IdPaso { get; set; }
        public string CampoEvaluacion { get; set; } = null!; // 'Total', 'TipoGasto', 'Empresa'
        public string Operador { get; set; } = null!;         // '>', '<', '=', 'IN'
        public string ValorComparacion { get; set; } = null!;
        public int IdPasoSiCumple { get; set; }
        public bool Activo { get; set; } = true;

        public virtual WorkflowPaso? Paso { get; set; }
    }
}
