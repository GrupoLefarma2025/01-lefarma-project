namespace Lefarma.API.Domain.Interfaces.EducacionMedica;

public interface IParametroAnestesiaRepository
{
    Task<List<Domain.Entities.EducacionMedica.ParametroAnestesia>> GetByAnioAsync(
        int anio,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.EducacionMedica.ParametroAnestesia?> GetByAnioYClaveAsync(
        int anio,
        string clave,
        CancellationToken cancellationToken = default);

    Task<int> GetUltimoAnioAsync(CancellationToken cancellationToken = default);

    Task<bool> ExisteAnioAsync(int anio, CancellationToken cancellationToken = default);

    Task AddRangeAsync(
        IEnumerable<Domain.Entities.EducacionMedica.ParametroAnestesia> parametros,
        CancellationToken cancellationToken = default);

    Task UpdateAsync(
        Domain.Entities.EducacionMedica.ParametroAnestesia parametro,
        CancellationToken cancellationToken = default);

    Task DeleteByAnioAsync(int anio, CancellationToken cancellationToken = default);
}
