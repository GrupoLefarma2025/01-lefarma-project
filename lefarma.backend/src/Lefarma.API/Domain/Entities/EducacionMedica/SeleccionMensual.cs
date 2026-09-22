using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Shared.Constants;

namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class SeleccionMensual : IWorkflowEntity
{
    public const string EstadoBorrador = "Borrador";
    public const string EstadoEnRevision = "EnRevision";
    public const string EstadoAutorizada = "Autorizada";
    public const string EstadoCerrada = "Cerrada";

    public int IdSeleccionMensual { get; set; }
    public DateOnly FechaSeleccion { get; set; }
    public int? IdTipoGerencia { get; set; }
    public DateOnly? FechaInicioVigencia { get; set; }
    public DateOnly? FechaFinVigencia { get; set; }
    public int? TalleresObjetivoMes { get; set; }
    public string Estado { get; set; } = EstadoBorrador;
    public DateTime? FirmaGvFecha { get; set; }
    public DateTime? FirmaGgFecha { get; set; }
    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    // Workflow (ADR-00006): la selección es la entidad del proceso EDUCACION_MEDICA / SUBPROCESO=1
    public int? IdWorkflow { get; set; }
    public int? IdPasoActual { get; set; }
    public int? IdEstado { get; set; }
    public virtual WorkflowEstados? EstadoWorkflow { get; set; }

    // IWorkflowEntity (implementación explícita: las columnas de auditoría son nullable)
    int IWorkflowEntity.Id { get => IdSeleccionMensual; set => IdSeleccionMensual = value; }
    int IWorkflowEntity.IdWorkflow { get => IdWorkflow ?? 0; set => IdWorkflow = value; }
    int? IWorkflowEntity.IdPasoActual { get => IdPasoActual; set => IdPasoActual = value; }
    int IWorkflowEntity.IdEstado { get => IdEstado ?? 0; set => IdEstado = value; }
    int IWorkflowEntity.IdUsuarioCreador { get => IdUsuarioCreacion ?? 0; set => IdUsuarioCreacion = value; }
    public string ObtenerTipoEntidad() => CodigoProceso.EDUCACION_MEDICA_SELECCION;
}
