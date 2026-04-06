using Lefarma.API.Domain.Entities.Help;

namespace Lefarma.API.Domain.Interfaces;
public interface IHelpModuleRepository
{
    Task<IEnumerable<HelpModule>> GetAllAsync(CancellationToken ct);
    Task<HelpModule?> GetByIdAsync(int id, CancellationToken ct);
    Task<HelpModule?> GetByNombreAsync(string nombre, CancellationToken ct);
    Task<HelpModule> CreateAsync(HelpModule module, CancellationToken ct);
    Task<HelpModule> UpdateAsync(HelpModule module, CancellationToken ct);
    Task DeleteAsync(int id, CancellationToken ct);
}
