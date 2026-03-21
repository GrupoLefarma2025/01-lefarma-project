using Lefarma.API.Domain.Entities.Catalogos;

namespace Lefarma.API.Domain.Interfaces.Catalogos
{
    public interface IFormaPagoRepository
    {
        Task<IEnumerable<FormaPago?>> GetAllAsync();
        Task<FormaPago?> GetByIdAsync(int id);
        Task<bool> ExistsAsync(System.Linq.Expressions.Expression<Func<FormaPago, bool>> predicate);
        Task<FormaPago> AddAsync(FormaPago entity);
        Task<FormaPago> UpdateAsync(FormaPago entity);
        Task<bool> DeleteAsync(FormaPago entity);
    }
}
