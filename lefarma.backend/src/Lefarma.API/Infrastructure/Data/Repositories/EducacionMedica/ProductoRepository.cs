using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica;

public class ProductoRepository : IProductoRepository
{
    private readonly AsokamDbContext _asokamDb;

    public ProductoRepository(AsokamDbContext asokamDb)
    {
        _asokamDb = asokamDb;
    }

    public async Task<List<Producto>> GetProductosAsync(
        string? search = null,
        int take = 200,
        CancellationToken cancellationToken = default)
    {
        var query = _asokamDb.Productos
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLowerInvariant();
            query = query.Where(p =>
                (p.NombreInternoProducto != null && p.NombreInternoProducto.ToLower().Contains(s)) ||
                (p.DescripcionCorta != null && p.DescripcionCorta.ToLower().Contains(s)) ||
                (p.CodigoFactura != null && p.CodigoFactura.ToLower().Contains(s)));
        }

        return await query
            .OrderBy(p => p.NombreInternoProducto)
            .Take(take)
            .ToListAsync(cancellationToken);
    }
}
