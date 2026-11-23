using Lefarma.API.Domain.Entities.Help;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Infrastructure.Data.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories;
public class HelpArticleRepository : BaseRepository<HelpArticle>, IHelpArticleRepository
{
    private readonly ApplicationDbContext _context;

    public HelpArticleRepository(ApplicationDbContext context) : base(context)
    {
        _context = context;
    }

    public async Task<IEnumerable<HelpArticle>> GetAllAsync(CancellationToken ct)
    {
        return await _context.HelpArticles
            .AsNoTracking()
            .Where(a => a.Activo)
            .OrderByDescending(a => a.FechaActualizacion)
            .ThenByDescending(a => a.FechaCreacion)
            .ToListAsync(ct);
    }

    public async Task<IEnumerable<HelpArticle>> GetByModuleAsync(string modulo, CancellationToken ct)
    {
        return await _context.HelpArticles
            .AsNoTracking()
            .Where(a => a.Modulo == modulo && a.Activo)
            .OrderByDescending(a => a.FechaActualizacion)
            .ThenByDescending(a => a.FechaCreacion)
            .ToListAsync(ct);
    }

    public async Task<IEnumerable<HelpArticle>> GetByTypeAsync(string tipo, CancellationToken ct)
    {
        return await _context.HelpArticles
            .AsNoTracking()
            .Where(a => a.Tipo == tipo && a.Activo)
            .OrderByDescending(a => a.FechaActualizacion)
            .ThenByDescending(a => a.FechaCreacion)
            .ToListAsync(ct);
    }

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

    public async Task<HelpArticle?> GetByIdAsync(int id, CancellationToken ct)
    {
        return await _context.HelpArticles
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id, ct);
    }

    public async Task<HelpArticle> CreateAsync(HelpArticle article, CancellationToken ct)
    {
        article.FechaCreacion = DateTime.UtcNow;
        article.FechaActualizacion = DateTime.UtcNow;

        await base.AddAsync(article);
        await _context.SaveChangesAsync(ct);
        return article;
    }

    public async Task<HelpArticle> UpdateAsync(HelpArticle article, CancellationToken ct)
    {
        article.FechaActualizacion = DateTime.UtcNow;

        _context.HelpArticles.Update(article);
        await _context.SaveChangesAsync(ct);
        return article;
    }

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
