namespace Lefarma.API.Domain.Interfaces.EducacionMedica;

public interface IParametroModuloRepository
{
    Task<List<Domain.Entities.EducacionMedica.ParametroModulo>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<List<Domain.Entities.EducacionMedica.ParametroModulo>> UpsertAsync(
        IEnumerable<(string Clave, decimal Valor)> valores,
        int idUsuario,
        CancellationToken cancellationToken = default);
}
