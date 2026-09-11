namespace Lefarma.API.Domain.Interfaces.EducacionMedica;

public interface IProductoRepository
{
    Task<List<Domain.Entities.EducacionMedica.Producto>> GetProductosAsync(
        string? search = null,
        int take = 200,
        CancellationToken cancellationToken = default);
}
