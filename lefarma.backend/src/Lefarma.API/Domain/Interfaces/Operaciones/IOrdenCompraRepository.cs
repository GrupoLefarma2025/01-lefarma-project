using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Domain.Interfaces.Operaciones
{
    public interface IOrdenCompraRepository : IBaseRepository<OrdenCompra>
    {
        Task<OrdenCompra?> GetWithPartidasAsync(int idOrden);
        Task<ICollection<OrdenCompra>> GetByEstadoAsync(EstadoOC estado);
        Task<ICollection<OrdenCompra>> GetBandejaAsync(int idUsuario, EstadoOC[] estados);
        Task<string> GenerarFolioAsync();
    }
}
