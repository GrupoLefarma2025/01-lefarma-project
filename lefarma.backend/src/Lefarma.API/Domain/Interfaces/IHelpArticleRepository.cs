using Lefarma.API.Domain.Entities.Help;

namespace Lefarma.API.Domain.Interfaces;
/// <summary>
/// Repositorio para operaciones de artículos de ayuda.
/// </summary>
public interface IHelpArticleRepository
{
    /// <summary>
    /// Obtiene todos los artículos de ayuda activos.
    /// </summary>
    Task<IEnumerable<HelpArticle>> GetAllAsync(CancellationToken ct);

    /// <summary>
    /// Obtiene artículos de ayuda por módulo.
    /// </summary>
    Task<IEnumerable<HelpArticle>> GetByModuleAsync(string modulo, CancellationToken ct);

    /// <summary>
    /// Obtiene artículos de ayuda por tipo.
    /// </summary>
    Task<IEnumerable<HelpArticle>> GetByTypeAsync(string tipo, CancellationToken ct);

    /// <summary>
    /// Obtiene artículos de ayuda para usuarios (tipo 'usuario' o 'ambos').
    /// Opcionalmente filtrados por módulo.
    /// </summary>
    Task<IEnumerable<HelpArticle>> GetForUserAsync(string? modulo, CancellationToken ct);

    /// <summary>
    /// Obtiene un artículo de ayuda por ID.
    /// </summary>
    Task<HelpArticle?> GetByIdAsync(int id, CancellationToken ct);

    /// <summary>
    /// Crea un nuevo artículo de ayuda.
    /// </summary>
    Task<HelpArticle> CreateAsync(HelpArticle article, CancellationToken ct);

    /// <summary>
    /// Actualiza un artículo de ayuda existente.
    /// </summary>
    Task<HelpArticle> UpdateAsync(HelpArticle article, CancellationToken ct);

    /// <summary>
    /// Elimina un artículo de ayuda (soft delete).
    /// </summary>
    Task DeleteAsync(int id, CancellationToken ct);
}
