using Lefarma.API.Domain.Entities.Catalogos;

namespace Lefarma.API.Domain.Interfaces.Catalogos {
public interface IMedidaRepository : IBaseRepository<Medida>
    {
        Task<ICollection<Medida>> GetAllConUnidadesAsync();
    }
}
