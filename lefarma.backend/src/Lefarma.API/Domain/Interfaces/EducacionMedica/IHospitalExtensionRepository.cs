namespace Lefarma.API.Domain.Interfaces.EducacionMedica;

public interface IHospitalExtensionRepository
{
    Task<List<Domain.Entities.EducacionMedica.HospitalExtension>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.HospitalExtension?> GetByHospitalIdAsync(
        int idHospital,
        CancellationToken cancellationToken = default);

    Task<List<Domain.Entities.EducacionMedica.HospitalExtension>> GetByHospitalIdsAsync(
        IEnumerable<int> idsHospital,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.HospitalExtension> CreateAsync(
        Domain.Entities.EducacionMedica.HospitalExtension extension,
        CancellationToken cancellationToken = default);

    Task UpdateAsync(
        Domain.Entities.EducacionMedica.HospitalExtension extension,
        CancellationToken cancellationToken = default);
}
