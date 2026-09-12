namespace Lefarma.API.Domain.Interfaces.EducacionMedica;

public interface IRutaRepository
{
    Task<List<Domain.Entities.EducacionMedica.Ruta>> GetBySeleccionAsync(
        int idSeleccionMensual,
        int? version,
        CancellationToken cancellationToken = default);

    Task<int?> GetVersionActualAsync(
        int idSeleccionMensual,
        CancellationToken cancellationToken = default);

    Task<List<Domain.Entities.EducacionMedica.Ruta>> GetConfirmadasPorEquiposAsync(
        IEnumerable<int> idsEquipos,
        CancellationToken cancellationToken = default);

    Task<List<Domain.Entities.EducacionMedica.Ruta>> GetByEquipoAsync(
        int idEquipo,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.Ruta?> GetByIdAsync(
        int idRuta,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.Ruta> CreateAsync(
        Domain.Entities.EducacionMedica.Ruta ruta,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.Ruta> UpdateAsync(
        Domain.Entities.EducacionMedica.Ruta ruta,
        CancellationToken cancellationToken = default);

    Task<List<Domain.Entities.EducacionMedica.RutaVisita>> GetVisitasAsync(
        int idRuta,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.RutaVisita?> GetVisitaByIdAsync(
        int idRutaVisita,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.RutaVisita> AddVisitaAsync(
        Domain.Entities.EducacionMedica.RutaVisita visita,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.RutaVisita> UpdateVisitaAsync(
        Domain.Entities.EducacionMedica.RutaVisita visita,
        CancellationToken cancellationToken = default);

    Task RemoveVisitaAsync(
        Domain.Entities.EducacionMedica.RutaVisita visita,
        CancellationToken cancellationToken = default);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
