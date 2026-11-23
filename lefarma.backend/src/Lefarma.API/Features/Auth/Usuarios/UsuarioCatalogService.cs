using Lefarma.API.Features.Auth.Usuarios.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Auth.Usuarios;
public class UsuarioCatalogService : IUsuarioCatalogService
{
    private readonly AsokamDbContext _context;

    public UsuarioCatalogService(AsokamDbContext context)
    {
        _context = context;
    }

    public async Task<List<UsuarioCatalogDto>> GetAllAsync(CancellationToken ct = default)
    {
        try
        {
            return await _context.Usuarios
                .Where(u => u.EsActivo && !u.EsAnonimo && !u.EsRobot)
                .OrderBy(u => u.NombreCompleto)
                .Select(u => new UsuarioCatalogDto
                {
                    IdUsuario = u.IdUsuario,
                    NombreCompleto = u.NombreCompleto ?? string.Empty,
                    Correo = u.Correo ?? string.Empty
                })
                .ToListAsync(ct);
        }
        catch (Microsoft.Data.SqlClient.SqlException) when (ct.IsCancellationRequested == false)
        {
            return new List<UsuarioCatalogDto>();
        }
    }
}
