using Lefarma.API.Domain.Entities.Archivos;
using Lefarma.API.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories;
public class ArchivoRepository : IArchivoRepository
{
    private readonly ApplicationDbContext _context;

    public ArchivoRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Archivo> CreateAsync(Archivo archivo, CancellationToken cancellationToken = default)
    {
        _context.Archivos.Add(archivo);
        await _context.SaveChangesAsync(cancellationToken);
        return archivo;
    }

    public async Task<Archivo?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        return await _context.Archivos
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
    }

    public async Task<IEnumerable<Archivo>> GetAllAsync(
        string? entidadTipo = null,
        int? entidadId = null,
        bool soloActivos = true,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Archivos.AsQueryable();

        if (!string.IsNullOrEmpty(entidadTipo))
            query = query.Where(a => a.EntidadTipo == entidadTipo);

        if (entidadId.HasValue)
            query = query.Where(a => a.EntidadId == entidadId.Value);

        if (soloActivos)
            query = query.Where(a => a.Activo);

        return await query
            .OrderByDescending(a => a.FechaCreacion)
            .ToListAsync(cancellationToken);
    }

    public async Task<Archivo?> GetByNombreFisicoAsync(string nombreFisico, CancellationToken cancellationToken = default)
    {
        return await _context.Archivos
            .FirstOrDefaultAsync(a => a.NombreFisico == nombreFisico, cancellationToken);
    }

    public async Task UpdateAsync(Archivo archivo, CancellationToken cancellationToken = default)
    {
        _context.Archivos.Update(archivo);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        var archivo = await GetByIdAsync(id, cancellationToken);
        if (archivo != null)
        {
            archivo.Activo = false;
            archivo.NombreFisico = $"{Path.GetFileNameWithoutExtension(archivo.NombreFisico)}_inactivo{archivo.Extension}";
            await UpdateAsync(archivo, cancellationToken);
        }
    }
}
