namespace Lefarma.API.Domain.Interfaces.EducacionMedica;

public interface ITipoGerenciaRepository
{
    Task<List<Domain.Entities.EducacionMedica.TipoGerencia>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.TipoGerencia?> GetByIdAsync(
        int id,
        CancellationToken cancellationToken = default);

    Task<Dictionary<int, int>> GetConteosHospitalesAsync(
        CancellationToken cancellationToken = default);
}
