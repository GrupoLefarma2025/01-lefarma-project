using ErrorOr;
using Lefarma.API.Features.Config.Workflows;
using Lefarma.API.Features.Config.Workflows.DTOs;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal;

public interface ISolicitudPersonalFirmasService 
{
    Task<ErrorOr<FirmarResponse>> FirmarAsync(int idSolicitud, FirmarRequest request, int idUsuario);
    Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesDisponiblesAsync(int idSolicitud, int idUsuario);
    Task<ErrorOr<AccionMetadataResponse>> GetAccionMetadataAsync(int idSolicitud, int idAccion, int idUsuario);
    Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialAsync(int idSolicitud);
}