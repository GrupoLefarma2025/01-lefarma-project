using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica;

public class ParametroModuloRepository : IParametroModuloRepository
{
    private readonly ApplicationDbContext _context;

    public ParametroModuloRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<ParametroModulo>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _context.ParametrosModulo
            .AsNoTracking()
            .Where(p => p.Activo)
            .OrderBy(p => p.Clave)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<ParametroModulo>> UpsertAsync(
        IEnumerable<(string Clave, decimal Valor)> valores,
        int idUsuario,
        CancellationToken cancellationToken = default)
    {
        var claves = valores.Select(v => v.Clave).ToList();
        var existentes = await _context.ParametrosModulo
            .Where(p => claves.Contains(p.Clave))
            .ToDictionaryAsync(p => p.Clave, cancellationToken);

        foreach (var (clave, valor) in valores)
        {
            if (existentes.TryGetValue(clave, out var parametro))
            {
                parametro.Valor = valor;
                parametro.IdUsuarioModificacion = idUsuario;
                parametro.FechaModificacion = DateTime.UtcNow;
                _context.ParametrosModulo.Update(parametro);
            }
            else
            {
                _context.ParametrosModulo.Add(new ParametroModulo
                {
                    Clave = clave,
                    Valor = valor,
                    Activo = true,
                    FechaCreacion = DateTime.UtcNow,
                    FechaModificacion = DateTime.UtcNow,
                    IdUsuarioCreacion = idUsuario,
                    IdUsuarioModificacion = idUsuario,
                });
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        return await GetAllAsync(cancellationToken);
    }
}
