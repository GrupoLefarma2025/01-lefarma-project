namespace Lefarma.API.Features.EducacionMedica;

public interface ITipoGerenciaService
{
    Task<List<DTOs.TipoGerenciaDto>> GetAllAsync(CancellationToken ct = default);
}
