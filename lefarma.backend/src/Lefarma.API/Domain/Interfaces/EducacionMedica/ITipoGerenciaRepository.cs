namespace Lefarma.API.Domain.Interfaces.EducacionMedica;

public interface ITipoGerenciaRepository
{
    Task<List<Domain.Entities.EducacionMedica.TipoGerencia>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.TipoGerencia?> GetByIdAsync(
        int id,
        CancellationToken cancellationToken = default);

    /// <summary>Conteo de hospitales con extensión activa por id de tipo de gerencia.</summary>
    Task<Dictionary<int, int>> GetConteosHospitalesAsync(
        CancellationToken cancellationToken = default);
}
