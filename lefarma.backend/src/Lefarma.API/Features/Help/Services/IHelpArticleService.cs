using ErrorOr;
using Lefarma.API.Features.Help.DTOs;

namespace Lefarma.API.Features.Help.Services;

/// <summary>
/// Interfaz del servicio de artículos de ayuda
/// </summary>
public interface IHelpArticleService
{
    Task<ErrorOr<IEnumerable<HelpArticleDto>>> GetAllAsync(CancellationToken ct);
    Task<ErrorOr<IEnumerable<HelpArticleDto>>> GetByModuleAsync(string modulo, CancellationToken ct);
    Task<ErrorOr<IEnumerable<HelpArticleDto>>> GetByTypeAsync(string tipo, CancellationToken ct);
    Task<ErrorOr<IEnumerable<HelpArticleDto>>> GetForUserAsync(string? modulo, CancellationToken ct);
    Task<ErrorOr<HelpArticleDto>> GetByIdAsync(int id, CancellationToken ct);
    Task<ErrorOr<HelpArticleDto>> CreateAsync(CreateHelpArticleRequest request, string createdBy, CancellationToken ct);
    Task<ErrorOr<HelpArticleDto>> UpdateAsync(UpdateHelpArticleRequest request, string updatedBy, CancellationToken ct);
    Task<ErrorOr<Success>> DeleteAsync(int id, CancellationToken ct);
}
