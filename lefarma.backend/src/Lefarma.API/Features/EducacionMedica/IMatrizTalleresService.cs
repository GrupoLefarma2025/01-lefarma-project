using ErrorOr;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

public interface IMatrizTalleresService
{
    Task<List<MatrizGeneralResumenDto>> GetMatricesAsync(int? idTipoGerencia, string? periodo, CancellationToken ct = default);
    Task<MatrizTalleresDetalleDto> GetMatrizAsync(int idMatrizGeneral, int idUsuario, CancellationToken ct = default);
    Task<List<ConcentracionEquipoDto>> GetConcentracionAsync(int idMatrizGeneral, CancellationToken ct = default);
    Task<TallerDto> ActualizarCostosAsync(int idMatrizGeneral, int idTaller, ActualizarCostosTallerRequest request, int idUsuario, CancellationToken ct = default);
    Task<MatrizTalleresDetalleDto> FirmarAsync(int idMatrizGeneral, FirmarWorkflowRequest request, int idUsuario, CancellationToken ct = default);
    Task<ErrorOr<IEnumerable<AccionDisponibleResponse>>> GetAccionesDisponiblesAsync(int idMatrizGeneral, int idUsuario, CancellationToken ct = default);
    Task<ErrorOr<IEnumerable<HistorialWorkflowItemResponse>>> GetHistorialAsync(int idMatrizGeneral, CancellationToken ct = default);
    Task<MatrizDocumentoDto> GetDocumentoAsync(int idMatrizGeneral, CancellationToken ct = default);
}
