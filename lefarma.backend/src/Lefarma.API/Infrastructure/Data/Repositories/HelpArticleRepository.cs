using Lefarma.API.Domain.Entities.Help;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Infrastructure.Data.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories;
/// <summary>
/// Repositorio para operaciones de artículos de ayuda.
/// Extiende BaseRepository para mantener consistencia con otros repositorios de catálogos.
/// </summary>
public class HelpArticleRepository : BaseRepository<HelpArticle>, IHelpArticleRepository
{
    private readonly ApplicationDbContext _context;

    public HelpArticleRepository(ApplicationDbContext context) : base(context)
    {
        _context = context;
    }

    /// <summary>
    /// Obtiene todos los artículos de ayuda activos ordenados por fecha de actualización descendente (más recientes primero).
    /// Implementación de interfaz con filtros específicos de HelpArticle.
    /// </summary>
    public async Task<IEnumerable<HelpArticle>> GetAllAsync(CancellationToken ct)
    {
        return await _context.HelpArticles
            .AsNoTracking()
            .Where(a => a.Activo)
            .OrderByDescending(a => a.FechaActualizacion)
            .ThenByDescending(a => a.FechaCreacion)
            .ToListAsync(ct);
    }

    /// <summary>
    /// Obtiene artículos de ayuda por módulo, ordenados por fecha de actualización descendente.
    /// </summary>
    public async Task<IEnumerable<HelpArticle>> GetByModuleAsync(string modulo, CancellationToken ct)
    {
        return await _context.HelpArticles
            .AsNoTracking()
            .Where(a => a.Modulo == modulo && a.Activo)
            .OrderByDescending(a => a.FechaActualizacion)
            .ThenByDescending(a => a.FechaCreacion)
            .ToListAsync(ct);
    }

    /// <summary>
    /// Obtiene artículos de ayuda por tipo, ordenados por fecha de actualización descendente.
    /// </summary>
    public async Task<IEnumerable<HelpArticle>> GetByTypeAsync(string tipo, CancellationToken ct)
    {
        return await _context.HelpArticles
            .AsNoTracking()
            .Where(a => a.Tipo == tipo && a.Activo)
            .OrderByDescending(a => a.FechaActualizacion)
            .ThenByDescending(a => a.FechaCreacion)
            .ToListAsync(ct);
    }

    /// <summary>
    /// Obtiene artículos de ayuda para usuarios (tipo 'usuario' o 'ambos'), ordenados por fecha de actualización descendente.
    /// Opcionalmente filtrados por módulo.
    /// </summary>
    public async Task<IEnumerable<HelpArticle>> GetForUserAsync(string? modulo, CancellationToken ct)
    {
        var query = _context.HelpArticles
            .AsNoTracking()
            .Where(a => a.Activo && (a.Tipo == "usuario" || a.Tipo == "ambos"));

        if (!string.IsNullOrWhiteSpace(modulo))
        {
            query = query.Where(a => a.Modulo == modulo);
        }

        return await query
            .OrderBy(a => a.Orden)
            .ThenByDescending(a => a.FechaActualizacion)
            .ThenByDescending(a => a.FechaCreacion)
            .ToListAsync(ct);
    }

    /// <summary>
    /// Obtiene un artículo de ayuda por ID.
    /// Implementación de interfaz con AsNoTracking.
    /// </summary>
    public async Task<HelpArticle?> GetByIdAsync(int id, CancellationToken ct)
    {
        return await _context.HelpArticles
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id, ct);
    }

    /// <summary>
    /// Crea un nuevo artículo de ayuda.
    /// Implementación de interfaz con gestión automática de timestamps.
    /// </summary>
    public async Task<HelpArticle> CreateAsync(HelpArticle article, CancellationToken ct)
    {
        article.FechaCreacion = DateTime.UtcNow;
        article.FechaActualizacion = DateTime.UtcNow;

        await base.AddAsync(article);
        await _context.SaveChangesAsync(ct);
        return article;
    }

    /// <summary>
    /// Actualiza un artículo de ayuda existente.
    /// Implementación de interfaz con gestión automática de timestamps.
    /// </summary>
    public async Task<HelpArticle> UpdateAsync(HelpArticle article, CancellationToken ct)
    {
        article.FechaActualizacion = DateTime.UtcNow;

        _context.HelpArticles.Update(article);
        await _context.SaveChangesAsync(ct);
        return article;
    }

    /// <summary>
    /// Elimina un artículo de ayuda (soft delete).
    /// Implementación de interfaz que marca como inactivo en lugar de eliminar físicamente.
    /// </summary>
    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var article = await _context.HelpArticles.FindAsync(new object[] { id }, ct);

        if (article == null)
            throw new InvalidOperationException($"Artículo de ayuda con ID {id} no encontrado");

        article.Activo = false;
        article.FechaActualizacion = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
    }
}
