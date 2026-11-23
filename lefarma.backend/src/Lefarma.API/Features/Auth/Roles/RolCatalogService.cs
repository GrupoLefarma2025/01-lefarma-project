using Lefarma.API.Features.Auth.Roles.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Auth.Roles;
public class RolCatalogService : IRolCatalogService
{
    private readonly AsokamDbContext _context;

    public RolCatalogService(AsokamDbContext context)
    {
        _context = context;
    }

    public async Task<List<RolCatalogDto>> GetAllAsync(CancellationToken ct = default)
    {
        try
        {
            return await _context.Roles
                .OrderBy(r => r.NombreRol)
                .Select(r => new RolCatalogDto
                {
                    IdRol = r.IdRol,
                    NombreRol = r.NombreRol,
                    Descripcion = r.Descripcion ?? string.Empty
                })
                .ToListAsync(ct);
        }
        catch (Microsoft.Data.SqlClient.SqlException) when (ct.IsCancellationRequested == false)
        {
            return new List<RolCatalogDto>();
        }
    }
}
