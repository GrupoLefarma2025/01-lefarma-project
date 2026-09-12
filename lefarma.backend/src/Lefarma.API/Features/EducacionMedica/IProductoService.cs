namespace Lefarma.API.Features.EducacionMedica;

public interface IProductoService
{
    Task<List<DTOs.ProductoDto>> GetProductosAsync(string? search = null, CancellationToken ct = default);
}
