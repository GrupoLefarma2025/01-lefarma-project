using Lefarma.API.Domain.Entities.Archivos;

namespace Lefarma.API.Domain.Interfaces;
public interface IArchivoRepository
{
    Task<Archivo> CreateAsync(Archivo archivo, CancellationToken cancellationToken = default);
    Task<Archivo?> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<IEnumerable<Archivo>> GetAllAsync(
        string? entidadTipo = null,
        int? entidadId = null,
        bool soloActivos = true,
        CancellationToken cancellationToken = default);
    Task<Archivo?> GetByNombreFisicoAsync(string nombreFisico, CancellationToken cancellationToken = default);
    Task UpdateAsync(Archivo archivo, CancellationToken cancellationToken = default);
    Task DeleteAsync(int id, CancellationToken cancellationToken = default);
}
