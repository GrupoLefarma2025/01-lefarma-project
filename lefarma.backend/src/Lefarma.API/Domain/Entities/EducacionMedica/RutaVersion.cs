using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Shared.Constants;

namespace Lefarma.API.Domain.Entities.EducacionMedica;

/// <summary>
/// Versión de rutas de una selección mensual: es la entidad autorizable del workflow
/// (GV firma -> CA revisa costos -> DC autoriza). Una fila por selección + versión;
/// las filas de <see cref="Ruta"/> apuntan aquí con IdRutaVersion (ADR-00006).
/// </summary>
public class RutaVersion : IWorkflowEntity
{
    public const string EstadoDraft = "Draft";
    public const string EstadoConfirmada = "Confirmada";
    public const string EstadoCancelada = "Cancelada";
    public const string EstadoArchivada = "Archivada";

    public int IdRutaVersion { get; set; }
    public int IdSeleccionMensual { get; set; }
    public int Version { get; set; }
    public int? IdTipoGerencia { get; set; }   // denormalizado de la selección (condición del GV)
    public string Estado { get; set; } = EstadoDraft;
    public DateTime? FechaConfirmacion { get; set; }
    public int? IdWorkflow { get; set; }
    public int? IdPasoActual { get; set; }
    public int? IdEstado { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
    public int? IdUsuarioCreacion { get; set; }
    public int? IdUsuarioModificacion { get; set; }

    public virtual WorkflowEstados? EstadoWorkflow { get; set; }
    public virtual ICollection<Ruta> Rutas { get; set; } = new List<Ruta>();

    // IWorkflowEntity (implementación explícita: las columnas de auditoría son nullable)
    int IWorkflowEntity.Id { get => IdRutaVersion; set => IdRutaVersion = value; }
    int IWorkflowEntity.IdWorkflow { get => IdWorkflow ?? 0; set => IdWorkflow = value; }
    int? IWorkflowEntity.IdPasoActual { get => IdPasoActual; set => IdPasoActual = value; }
    int IWorkflowEntity.IdEstado { get => IdEstado ?? 0; set => IdEstado = value; }
    int IWorkflowEntity.IdUsuarioCreador { get => IdUsuarioCreacion ?? 0; set => IdUsuarioCreacion = value; }
    public string ObtenerTipoEntidad() => CodigoProceso.EDUCACION_MEDICA_RUTAS;
}
