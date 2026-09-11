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

    /// <summary>
    /// true si ya existe un equipo ACTIVO con esa región fija (opcionalmente
    /// excluyendo un equipo, p. ej. al reasignar la región del mismo equipo).
    /// </summary>
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
