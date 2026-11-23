namespace Lefarma.API.Domain.Interfaces.EducacionMedica;

public interface IEquipoPareoRepository
{
    Task<List<Domain.Entities.EducacionMedica.EquipoPareo>> GetAllAsync(
        EquipoPareoFiltro? filtro,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.EquipoPareo?> GetByIdAsync(
        int idEquipo,
        CancellationToken cancellationToken = default);

    Task<bool> ExisteActivoConIntegranteAsync(
        int idUsuario,
        CancellationToken cancellationToken = default);

    Task<bool> ExisteActivoConRegionAsync(
        int idRegion,
        int? excluirIdEquipo,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.EquipoPareo> CreateAsync(
        Domain.Entities.EducacionMedica.EquipoPareo equipo,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.EquipoPareo> UpdateAsync(
        Domain.Entities.EducacionMedica.EquipoPareo equipo,
        CancellationToken cancellationToken = default);
}
