namespace Lefarma.API.Domain.Interfaces.Rh;

public interface IEmpleadoRepository
{
    Task<long?> ResolverNominaPorUsuarioAsync(
        int idUsuario,
        CancellationToken cancellationToken = default);

    Task<int?> ResolverIdUsuarioPorNominaAsync(
        long nomina,
        CancellationToken cancellationToken = default);

    Task<Dictionary<long, int>> ResolverIdsUsuarioPorNominasAsync(
        IEnumerable<long> nominas,
        CancellationToken cancellationToken = default);

    Task<Domain.Entities.Asistencias.VwEmpleado?> ObtenerEmpleadoPorUsuarioAsync(
        int idUsuario,
        CancellationToken cancellationToken = default);
}
