using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Features.OrdenesCompra.Visibilidad;

public interface IOrdenCompraVisibilidadService
{
    Task<AlcanceOrdenCompra> ResolverAsync(int idUsuario, CancellationToken ct = default);

    IQueryable<OrdenCompra> Aplicar(IQueryable<OrdenCompra> query, AlcanceOrdenCompra alcance);

    Task<bool> PuedeVerAsync(int idOrden, int idUsuario, CancellationToken ct = default);
}
