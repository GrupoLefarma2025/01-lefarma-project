using System.Linq.Expressions;

namespace Lefarma.API.Domain.Interfaces {
public interface IBaseRepository<T> where T : class
    {
        Task<ICollection<T>> GetAllAsync();

        Task<T?> GetByIdAsync(int id);

        Task<T> AddAsync(T entity);

        Task<T> UpdateAsync(T entity);

        Task<bool> DeleteAsync(T entity);

        Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate);

        IQueryable<T> GetQueryable();
    }
}
