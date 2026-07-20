using ErrorOr;

namespace Lefarma.API.Features.Rh.Empleados;

public interface IEmpleadoService
{
    Task<ErrorOr<int?>> ResolverIdUsuarioPorNominaAsync(
        long nomina,
        CancellationToken cancellationToken = default);

    Task<ErrorOr<Dictionary<long, int>>> ResolverIdsUsuarioPorNominasAsync(
        IEnumerable<long> nominas,
        CancellationToken cancellationToken = default);
}
