using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Extensions;

namespace Lefarma.API.Features.EducacionMedica;

public class ProductoService : IProductoService
{
    private readonly IProductoRepository _repository;

    public ProductoService(IProductoRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<ProductoDto>> GetProductosAsync(string? search = null, CancellationToken ct = default)
    {
        var productos = await _repository.GetProductosAsync(search, 200, ct);

        return productos
            .Select(p => p.ToResponse())
            .ToList();
    }
}
