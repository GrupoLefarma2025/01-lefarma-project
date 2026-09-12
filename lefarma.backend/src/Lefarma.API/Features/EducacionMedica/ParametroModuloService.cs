using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Extensions;

namespace Lefarma.API.Features.EducacionMedica;

public class ParametroModuloService : IParametroModuloService
{
    private readonly IParametroModuloRepository _repository;

    public ParametroModuloService(IParametroModuloRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<ParametroModuloDto>> GetAllAsync(CancellationToken ct = default)
    {
        var parametros = await _repository.GetAllAsync(ct);
        return parametros.Select(p => p.ToResponse()).ToList();
    }

    public async Task<List<ParametroModuloDto>> UpsertAsync(
        List<UpsertParametroModuloRequest> parametros,
        int idUsuario,
        CancellationToken ct = default)
    {
        if (parametros.Count == 0)
        {
            throw new InvalidOperationException("No se recibieron parámetros para guardar.");
        }

        var invalidos = parametros.Where(p => p.Valor < 0).Select(p => p.Clave).ToList();
        if (invalidos.Count > 0)
        {
            throw new InvalidOperationException(
                $"Valores inválidos (deben ser positivos): {string.Join(", ", invalidos)}.");
        }

        var guardados = await _repository.UpsertAsync(
            parametros.Select(p => (p.Clave, p.Valor)), idUsuario, ct);

        return guardados.Select(p => p.ToResponse()).ToList();
    }
}
