namespace Lefarma.API.Features.EducacionMedica;

public interface IParametroModuloService
{
    Task<List<DTOs.ParametroModuloDto>> GetAllAsync(CancellationToken ct = default);

    Task<List<DTOs.ParametroModuloDto>> UpsertAsync(
        List<DTOs.UpsertParametroModuloRequest> parametros,
        int idUsuario,
        CancellationToken ct = default);
}
