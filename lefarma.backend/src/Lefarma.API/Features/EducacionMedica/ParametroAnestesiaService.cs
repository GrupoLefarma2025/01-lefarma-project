using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Extensions;

namespace Lefarma.API.Features.EducacionMedica;

public class ParametroAnestesiaService : IParametroAnestesiaService
{
    private readonly IParametroAnestesiaRepository _repository;

    public ParametroAnestesiaService(IParametroAnestesiaRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<ParametroAnestesiaDto>> GetByAnioAsync(int anio, CancellationToken ct = default)
    {
        var items = await _repository.GetByAnioAsync(anio, ct);
        return items
            .Select(p => p.ToResponse())
            .ToList();
    }

    public async Task<List<ParametroAnestesiaDto>> GetActualAsync(CancellationToken ct = default)
    {
        var ultimoAnio = await _repository.GetUltimoAnioAsync(ct);
        return await GetByAnioAsync(ultimoAnio, ct);
    }

    public async Task<List<ParametroAnestesiaDto>> UpsertAsync(
        int anio,
        UpsertParametrosAnestesiasRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var resultados = new List<ParametroAnestesiaDto>();
        var ahora = DateTime.UtcNow;

        foreach (var item in request.Parametros)
        {
            var existente = await _repository.GetByAnioYClaveAsync(anio, item.Clave, ct);

            if (existente is null)
            {
                var nuevo = new ParametroAnestesia
                {
                    Anio = anio,
                    Clave = item.Clave,
                    Valor = item.Valor,
                    Descripcion = null,
                    Orden = 0,
                    IdUsuarioCreacion = idUsuario,
                    IdUsuarioModificacion = idUsuario,
                    FechaCreacion = ahora,
                    FechaModificacion = ahora,
                    Activo = true
                };

                await _repository.AddRangeAsync(new[] { nuevo }, ct);
                resultados.Add(nuevo.ToResponse());
            }
            else
            {
                existente.Valor = item.Valor;
                existente.IdUsuarioModificacion = idUsuario;
                await _repository.UpdateAsync(existente, ct);
                resultados.Add(existente.ToResponse());
            }
        }

        return resultados
            .OrderBy(r => r.Orden)
            .ThenBy(r => r.Clave)
            .ToList();
    }
}
