using System.Linq.Expressions;

namespace Lefarma.API.Domain.Interfaces {
public interface IBaseRepository<T> where T : class
    {
        //Metodo para obtener todos los registros
        Task<ICollection<T>> GetAllAsync();

        //Metodo para obtener un registro por su Id
        Task<T?> GetByIdAsync(int id);

        //Metodo para agregar un nuevo registro
        Task<T> AddAsync(T entity);

        //Metodo para actualizar un registro existente
        Task<T> UpdateAsync(T entity);

        //Metodo para eliminar un registro
        Task<bool> DeleteAsync(T entity);

        //Metodo para verificar si un registro existe
        Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate);

        //Metodo para obtener un IQueryable para filtros personalizados
        IQueryable<T> GetQueryable();
    }
}
