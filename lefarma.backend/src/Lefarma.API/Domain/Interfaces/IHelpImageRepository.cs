using Lefarma.API.Domain.Entities.Help;

namespace Lefarma.API.Domain.Interfaces;
public interface IHelpImageRepository
{
    Task<HelpImage> CreateAsync(HelpImage helpImage, CancellationToken ct);

    Task<HelpImage?> GetByFileNameAsync(string nombreArchivo, CancellationToken ct);
}
