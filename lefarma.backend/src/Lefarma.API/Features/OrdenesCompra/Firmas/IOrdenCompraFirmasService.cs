using ErrorOr;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.OrdenesCompra.Firmas.DTOs;

namespace Lefarma.API.Features.OrdenesCompra.Firmas;

public interface IOrdenCompraFirmasService
{
    Task<ErrorOr<FirmarResponse>> FirmarAsync(int idOrden, FirmarRequest request, int idUsuario);
    Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesDisponiblesAsync(int idOrden, int idUsuario);
    Task<ErrorOr<AccionMetadataResponse>> GetAccionMetadataAsync(int idOrden, int idAccion, int idUsuario);
    Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialAsync(int idOrden);
    Task<ErrorOr<EnvioConcentradoResponse>> EnvioConcentradoAsync(EnvioConcentradoRequest request, int idUsuario);
    Task<ErrorOr<EnvioConcentradoResponse>> EnvioConcentradoConPdfAsync(EnvioConcentradoConPdfRequest request, int idUsuario);
    Task<ErrorOr<RespuestaConcentradoResponse>> ProcesarRespuestaConcentradoAsync(RespuestaConcentradoExternoRequest request);
}
