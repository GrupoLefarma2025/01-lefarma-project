namespace Lefarma.API.Domain.Interfaces.Rh.Empleados;

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
}
