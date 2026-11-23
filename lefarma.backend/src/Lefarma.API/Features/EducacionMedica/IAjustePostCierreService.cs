using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

public interface IAjustePostCierreService
{
    Task<List<AjustePostCierreDto>> ListarAsync(
        string entidadTipo,
        int idEntidad,
        int idUsuario,
        CancellationToken ct = default);
}
