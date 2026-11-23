using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

public interface ITallerImparticionService
{
    Task<TallerMaterialDto?> GetMaterialAsync(int idTaller, CancellationToken ct = default);
    Task<TallerMaterialDto> GuardarMaterialAsync(int idTaller, GuardarTallerMaterialRequest request, int idUsuario, CancellationToken ct = default);
    Task<TallerMaterialDto> ConfirmarMaterialAsync(int idTaller, ConfirmarMaterialRequest request, int idUsuario, CancellationToken ct = default);

    Task<List<TallerAsistenciaDto>> GetAsistenciasAsync(int idTaller, CancellationToken ct = default);
    Task<TallerAsistenciaDto> CrearAsistenciaAsync(int idTaller, GuardarTallerAsistenciaRequest request, int idUsuario, CancellationToken ct = default);
    Task<TallerAsistenciaDto> ActualizarAsistenciaAsync(int idTaller, int idAsistencia, GuardarTallerAsistenciaRequest request, int idUsuario, CancellationToken ct = default);
    Task EliminarAsistenciaAsync(int idTaller, int idAsistencia, int idUsuario, CancellationToken ct = default);

    Task<List<TallerEvidenciaDto>> GetEvidenciasAsync(int idTaller, CancellationToken ct = default);
    Task<TallerEvidenciaDto> AgregarEvidenciaAsync(int idTaller, GuardarTallerEvidenciaRequest request, int idUsuario, CancellationToken ct = default);
    Task EliminarEvidenciaAsync(int idTaller, int idEvidencia, int idUsuario, CancellationToken ct = default);

    Task<TallerDto> CambiarEstadoAsync(int idTaller, CambiarEstadoTallerRequest request, int idUsuario, CancellationToken ct = default);

    Task<List<TallerEstadoHistorialDto>> GetHistorialEstadosAsync(int idTaller, CancellationToken ct = default);

    Task<TallerDocumentoMaterialDto> GetDocumentoMaterialAsync(int idTaller, CancellationToken ct = default);
    Task<TallerDocumentoAsistenciaDto> GetDocumentoAsistenciaAsync(int idTaller, CancellationToken ct = default);
}
