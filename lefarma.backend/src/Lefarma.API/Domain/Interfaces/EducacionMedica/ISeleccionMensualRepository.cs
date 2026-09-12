namespace Lefarma.API.Domain.Interfaces.EducacionMedica;

public interface ISeleccionMensualRepository
{
    Task<List<Domain.Entities.EducacionMedica.SeleccionMensual>> GetAllAsync(
        int? anio,
        int? mes,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.SeleccionMensual?> GetByIdAsync(
        int idSeleccionMensual,
        CancellationToken cancellationToken = default);

    Task<bool> ExisteSeleccionActivaAsync(
        DateOnly fechaInicioVigencia,
        DateOnly fechaFinVigencia,
        int? idTipoGerencia,
        CancellationToken cancellationToken = default);

    Task<List<Domain.Entities.EducacionMedica.SeleccionMensual>> GetSeleccionesSolapadasAsync(
        int idSeleccionMensual,
        DateOnly fechaInicioVigencia,
        DateOnly fechaFinVigencia,
        int? idTipoGerencia,
        CancellationToken cancellationToken = default);

    Task<List<Domain.Entities.EducacionMedica.SeleccionHospital>> GetHospitalesDeSeleccionesAsync(
        IEnumerable<int> idsSeleccionMensual,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.SeleccionMensual> CreateAsync(
        Domain.Entities.EducacionMedica.SeleccionMensual seleccion,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.SeleccionMensual> UpdateAsync(
        Domain.Entities.EducacionMedica.SeleccionMensual seleccion,
        CancellationToken cancellationToken = default);

    Task<List<Domain.Entities.EducacionMedica.SeleccionHospital>> GetHospitalesAsync(
        int idSeleccionMensual,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.SeleccionHospital?> GetHospitalByIdAsync(
        int idSeleccionHospital,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.SeleccionHospital> AddHospitalAsync(
        Domain.Entities.EducacionMedica.SeleccionHospital hospital,
        CancellationToken cancellationToken = default);

    Task RemoveHospitalAsync(
        Domain.Entities.EducacionMedica.SeleccionHospital hospital,
        CancellationToken cancellationToken = default);

    Task<List<Domain.Entities.EducacionMedica.SeleccionRegion>> GetRegionesAsync(
        int idSeleccionMensual,
        CancellationToken cancellationToken = default);

    Task<List<Domain.Entities.EducacionMedica.SeleccionRegion>> GetRegionesPorEquiposAsync(
        IEnumerable<int> idsEquipos,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.SeleccionRegion?> GetRegionByIdAsync(
        int idRegion,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.SeleccionRegion> CreateRegionAsync(
        Domain.Entities.EducacionMedica.SeleccionRegion region,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.SeleccionRegion> UpdateRegionAsync(
        Domain.Entities.EducacionMedica.SeleccionRegion region,
        CancellationToken cancellationToken = default);

    Task RemoveRegionAsync(
        Domain.Entities.EducacionMedica.SeleccionRegion region,
        CancellationToken cancellationToken = default);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
