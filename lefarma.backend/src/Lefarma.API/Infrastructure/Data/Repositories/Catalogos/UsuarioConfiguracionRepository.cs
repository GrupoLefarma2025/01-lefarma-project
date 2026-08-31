using System.Text.Json;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Catalogos;

public class UsuarioConfiguracionRepository : IUsuarioConfiguracionRepository
{
    private readonly ApplicationDbContext _context;

    public UsuarioConfiguracionRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<int>> GetDestinatariosDefaultAsync(int idUsuario, CancellationToken ct = default)
    {
        var detalle = await _context.UsuariosDetalle
            .AsNoTracking()
            .FirstOrDefaultAsync(ud => ud.IdUsuario == idUsuario, ct);

        if (detalle == null || string.IsNullOrWhiteSpace(detalle.DestinatariosIncidenciasDefault))
        {
            return new List<int>();
        }

        try
        {
            var destinatarios = JsonSerializer.Deserialize<List<int>>(detalle.DestinatariosIncidenciasDefault);
            return destinatarios ?? new List<int>();
        }
        catch (JsonException)
        {
            return new List<int>();
        }
    }

    public async Task GuardarDestinatariosDefaultAsync(int idUsuario, List<int> destinatarios, CancellationToken ct = default)
    {
        var detalle = await _context.UsuariosDetalle
            .FirstOrDefaultAsync(ud => ud.IdUsuario == idUsuario, ct);

        var json = JsonSerializer.Serialize(destinatarios.Distinct().ToList());

        if (detalle == null)
        {
            detalle = new UsuarioDetalle
            {
                IdUsuario = idUsuario,
                DestinatariosIncidenciasDefault = json,
                FechaCreacion = DateTime.UtcNow,
                FechaModificacion = DateTime.UtcNow,
                // Valores mínimos requeridos por la entidad
                IdEmpresa = 1,
                IdSucursal = 1,
                TemaInterfaz = "light",
                Activo = true
            };
            _context.UsuariosDetalle.Add(detalle);
        }
        else
        {
            detalle.DestinatariosIncidenciasDefault = json;
            detalle.FechaModificacion = DateTime.UtcNow;
            _context.UsuariosDetalle.Update(detalle);
        }

        await _context.SaveChangesAsync(ct);
    }
}
