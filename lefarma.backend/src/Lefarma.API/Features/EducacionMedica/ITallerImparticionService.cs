using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

/// <summary>Impartición del taller (ADR-00008): material, asistencias, evidencias, estados e imprimibles.</summary>
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

    /// <summary>Máquina de estados del taller validada en servicio; cada transición escribe taller_estados_historial.</summary>
    Task<TallerDto> CambiarEstadoAsync(int idTaller, CambiarEstadoTallerRequest request, int idUsuario, CancellationToken ct = default);

    Task<List<TallerEstadoHistorialDto>> GetHistorialEstadosAsync(int idTaller, CancellationToken ct = default);

    Task<TallerDocumentoMaterialDto> GetDocumentoMaterialAsync(int idTaller, CancellationToken ct = default);
    Task<TallerDocumentoAsistenciaDto> GetDocumentoAsistenciaAsync(int idTaller, CancellationToken ct = default);
}
