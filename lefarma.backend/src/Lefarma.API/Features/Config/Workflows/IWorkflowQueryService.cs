using ErrorOr;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.Config.Workflows.DTOs;

namespace Lefarma.API.Features.Config.Workflows;

public interface IWorkflowQueryService
{
    Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesDisponiblesAsync(
        int idWorkflow,
        int idEntidad,
        int idPasoActual,
        int idUsuario,
        string tipoEntidad,
        IWorkflowEntity entidadParaHandlers,
        CancellationToken ct = default);

    Task<ErrorOr<AccionMetadataResponse>> GetAccionMetadataAsync(
        int idWorkflow,
        int idPasoActual,
        int idAccion,
        int idEntidad,
        CancellationToken ct = default);

    Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialWorkflowAsync(
        int idEntidad,
        string tipoEntidad,
        CancellationToken ct = default);
}