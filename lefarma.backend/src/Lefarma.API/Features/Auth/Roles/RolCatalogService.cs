using Lefarma.API.Features.Auth.Roles.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Auth.Roles;

/// <summary>
/// Service for Rol catalog operations
/// </summary>
public class RolCatalogService : IRolCatalogService
{
    private readonly ApplicationDbContext _context;

    public RolCatalogService(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Gets all roles for catalog selection
    /// Returns empty list if table doesn't exist
    /// </summary>
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
            // Table doesn't exist yet, return empty list
            return new List<RolCatalogDto>();
        }
    }
}
