using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Shared.Constants;

namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Matriz general de talleres por gerencia (IMSS/Descentralizado) y mes: es la entidad
/// autorizable del workflow EDUCACION_MEDICA_MATRIZ (GV -> costos AEM -> CA -> DC).
/// No tiene estado propio: su estado es el del motor (IdEstado). Nace automáticamente
/// con el primer taller capturado de la gerencia/mes (ADR-00007).
/// </summary>
public class MatrizGeneral : IWorkflowEntity
{
    public int IdMatrizGeneral { get; set; }
    public int IdTipoGerencia { get; set; }
    public DateOnly Periodo { get; set; }   // primer día del mes
    public int? IdWorkflow { get; set; }
    public int? IdPasoActual { get; set; }
    public int? IdEstado { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public virtual TipoGerencia? TipoGerencia { get; set; }
    public virtual WorkflowEstados? EstadoWorkflow { get; set; }
    public virtual ICollection<Taller> Talleres { get; set; } = new List<Taller>();

    // IWorkflowEntity (implementación explícita: las columnas de auditoría son nullable)
    int IWorkflowEntity.Id { get => IdMatrizGeneral; set => IdMatrizGeneral = value; }
    int IWorkflowEntity.IdWorkflow { get => IdWorkflow ?? 0; set => IdWorkflow = value; }
    int? IWorkflowEntity.IdPasoActual { get => IdPasoActual; set => IdPasoActual = value; }
    int IWorkflowEntity.IdEstado { get => IdEstado ?? 0; set => IdEstado = value; }
    int IWorkflowEntity.IdUsuarioCreador { get => IdUsuarioCreacion ?? 0; set => IdUsuarioCreacion = value; }
    public string ObtenerTipoEntidad() => CodigoProceso.EDUCACION_MEDICA_MATRIZ;
}
