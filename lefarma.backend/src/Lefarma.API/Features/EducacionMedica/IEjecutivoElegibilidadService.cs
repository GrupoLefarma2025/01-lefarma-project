namespace Lefarma.API.Features.EducacionMedica;

public interface IEjecutivoElegibilidadService
{
    Task<bool> EsEjecutivoPrimarioAsync(
        int idUsuario,
        int? idRegionCatalogo,
        int? idTipoGerencia,
        CancellationToken ct = default);

    Task<bool> EsEjecutivoSuplenteAsync(
        int idUsuario,
        int? idRegionCatalogo,
        int? idTipoGerencia,
        CancellationToken ct = default);

    Task<int?> BuscarSuplenteAsync(
        int? idRegionCatalogo,
        int? idTipoGerencia,
        CancellationToken ct = default);
}
