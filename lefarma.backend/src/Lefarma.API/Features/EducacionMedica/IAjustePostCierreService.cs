using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

/// <summary>Consulta de la bitácora de ajustes post-cierre (ADR-00010).</summary>
public interface IAjustePostCierreService
{
    Task<List<AjustePostCierreDto>> ListarAsync(
        string entidadTipo,
        int idEntidad,
        int idUsuario,
        CancellationToken ct = default);
}
