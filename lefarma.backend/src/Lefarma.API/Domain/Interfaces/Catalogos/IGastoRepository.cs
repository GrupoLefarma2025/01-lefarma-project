using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Catalogos.Gastos.DTOs;

namespace Lefarma.API.Domain.Interfaces.Catalogos {
public interface IGastoRepository : IBaseRepository<Gasto>
    {
        Task<ICollection<Gasto>> GetAllConUnidadesAsync();
        Task<Gasto?> GetByIdConUnidadesAsync(int id);
        Task ActualizarUnidadesMedidaAsync(int idGasto, List<int> idsUnidadesMedidaActivas);
    }
}
