namespace Lefarma.API.Domain.Interfaces.EducacionMedica;

public interface IHospitalRepository
{
    Task<List<Domain.Entities.EducacionMedica.Hospital>> GetHospitalesAsync(
        HospitalFilterParams? filter = null,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.Hospital?> GetByIdAsync(
        int id,
        CancellationToken cancellationToken = default);

    Task<List<Domain.Entities.EducacionMedica.Hospital>> GetByIdsAsync(
        IEnumerable<int> ids,
        CancellationToken cancellationToken = default);
}

