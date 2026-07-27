using ErrorOr;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.Config.Workflows.DTOs;

namespace Lefarma.API.Features.Config.Workflows;

public interface IWorkflowQueryService
{
    /// <summary>
    /// Devuelve las acciones disponibles para el usuario en el paso actual de la entidad,
    /// incluyendo handlers pre-evaluados y metadata del paso (RequiereComentario, etc.).
    /// </summary>
    Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesDisponiblesAsync(
        int idWorkflow,
        int idEntidad,
        int idPasoActual,
        int idUsuario,
        string tipoEntidad,
        IWorkflowEntity entidadParaHandlers,
        CancellationToken ct = default);

    /// <summary>
    /// Devuelve metadata de una acción específica (handlers, campos, requisitos del paso).
    /// Usado por el frontend para construir el modal dinámico antes de ejecutar.
    /// </summary>
    Task<ErrorOr<AccionMetadataResponse>> GetAccionMetadataAsync(
        int idWorkflow,
        int idPasoActual,
        int idAccion,
        int idEntidad,
        CancellationToken ct = default);

    /// <summary>
    /// Devuelve el historial completo de transiciones de workflow para una entidad.
    /// Funciona para cualquier tipo (OC, SolicitudPersonal, futuro) por la columna polimórfica.
    /// </summary>
    Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialWorkflowAsync(
        int idEntidad,
        string tipoEntidad,
        CancellationToken ct = default);
}