using Lefarma.API.Domain.Entities.Help;

namespace Lefarma.API.Domain.Interfaces;
public interface IHelpArticleRepository
{
    Task<IEnumerable<HelpArticle>> GetAllAsync(CancellationToken ct);

    Task<IEnumerable<HelpArticle>> GetByModuleAsync(string modulo, CancellationToken ct);

    Task<IEnumerable<HelpArticle>> GetByTypeAsync(string tipo, CancellationToken ct);

    Task<IEnumerable<HelpArticle>> GetForUserAsync(string? modulo, CancellationToken ct);

    Task<HelpArticle?> GetByIdAsync(int id, CancellationToken ct);

    Task<HelpArticle> CreateAsync(HelpArticle article, CancellationToken ct);

    Task<HelpArticle> UpdateAsync(HelpArticle article, CancellationToken ct);

    Task DeleteAsync(int id, CancellationToken ct);
}
