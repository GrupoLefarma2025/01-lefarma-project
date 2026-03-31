using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Domain.Interfaces.Operaciones
{
    public interface IComprobacionRepository : IBaseRepository<Comprobacion>
    {
        Task<ICollection<Comprobacion>> GetByOrdenAsync(int idOrden);
        Task<Comprobacion?> GetByUuidAsync(string uuid);
    }
}
