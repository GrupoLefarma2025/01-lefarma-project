using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Catalogos {
public class FormaPagoRepository : IFormaPagoRepository
    {
        private readonly ApplicationDbContext _context;

        public FormaPagoRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<FormaPago?>> GetAllAsync()
        {
            return await _context.FormasPago.ToListAsync();
        }

        public async Task<FormaPago?> GetByIdAsync(int id)
        {
            return await _context.FormasPago.FindAsync(id);
        }

        public async Task<bool> ExistsAsync(System.Linq.Expressions.Expression<Func<FormaPago, bool>> predicate)
        {
            return await _context.FormasPago.AnyAsync(predicate);
        }

        public async Task<FormaPago> AddAsync(FormaPago entity)
        {
            _context.FormasPago.Add(entity);
            await _context.SaveChangesAsync();
            return entity;
        }

        public async Task<FormaPago> UpdateAsync(FormaPago entity)
        {
            _context.FormasPago.Update(entity);
            await _context.SaveChangesAsync();
            return entity;
        }

        public async Task<bool> DeleteAsync(FormaPago entity)
        {
            _context.FormasPago.Remove(entity);
            var result = await _context.SaveChangesAsync();
            return result > 0;
        }
    }
}
