using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Catalogos;

public class ProveedorRepository : BaseRepository<Proveedor>, IProveedorRepository
{
    private readonly ApplicationDbContext _context;

    public ProveedorRepository(ApplicationDbContext context) : base(context)
    {
        _context = context;
    }

    public async Task<Proveedor?> GetByIdWithDetailsAsync(int id)
    {
        return await _context.Set<Proveedor>()
            .Include(p => p.RegimenFiscal!)
            .Include(p => p.Detalle)
            .Include(p => p.CuentasFormaPago)
                .ThenInclude(c => c.FormaPago)
            .Include(p => p.CuentasFormaPago)
                .ThenInclude(c => c.Banco)
            .FirstOrDefaultAsync(p => p.IdProveedor == id);
    }

    public void RemoveCuenta(ProveedorFormaPagoCuenta cuenta)
    {
        _context.Set<ProveedorFormaPagoCuenta>().Remove(cuenta);
    }
}
