namespace Lefarma.API.Features.EducacionMedica;

public interface IParametroAnestesiaService
{
    Task<List<DTOs.ParametroAnestesiaDto>> GetByAnioAsync(int anio, CancellationToken ct = default);
    Task<List<DTOs.ParametroAnestesiaDto>> GetActualAsync(CancellationToken ct = default);
    Task<List<DTOs.ParametroAnestesiaDto>> UpsertAsync(
        int anio,
        DTOs.UpsertParametrosAnestesiasRequest request,
        int idUsuario,
        CancellationToken ct = default);
}
