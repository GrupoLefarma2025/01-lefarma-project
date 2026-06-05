using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Domain.Interfaces.Operaciones {
public interface IOrdenCompraRepository : IBaseRepository<OrdenCompra>
    {
        Task<OrdenCompra?> GetWithPartidasAsync(int idOrden);
        Task<ICollection<OrdenCompra>> GetByEstadoAsync(int idEstado);
        Task<ICollection<OrdenCompra>> GetBandejaAsync(int idUsuario, int[] idsEstados);
        Task<string> GenerarFolioAsync();
    }
}
