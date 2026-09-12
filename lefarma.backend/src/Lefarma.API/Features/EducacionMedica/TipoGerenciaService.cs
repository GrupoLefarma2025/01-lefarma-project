using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Extensions;

namespace Lefarma.API.Features.EducacionMedica;

public class TipoGerenciaService : ITipoGerenciaService
{
    private readonly ITipoGerenciaRepository _repository;

    public TipoGerenciaService(ITipoGerenciaRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<TipoGerenciaDto>> GetAllAsync(CancellationToken ct = default)
    {
        var items = await _repository.GetAllAsync(ct);
        return items
            .Select(t => t.ToResponse())
            .ToList();
    }
}
