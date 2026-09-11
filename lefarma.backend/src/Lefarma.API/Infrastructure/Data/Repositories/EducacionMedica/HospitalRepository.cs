using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica;

public class HospitalRepository : IHospitalRepository
{
    private readonly AsokamDbContext _asokamDb;

    public HospitalRepository(AsokamDbContext asokamDb)
    {
        _asokamDb = asokamDb;
    }

    public async Task<List<Hospital>> GetHospitalesAsync(
        HospitalFilterParams? filter = null,
        CancellationToken cancellationToken = default)
    {
        filter ??= new HospitalFilterParams();

        var query = _asokamDb.Hospitales
            .AsNoTracking()
            .AsQueryable();

        if (filter.Activo.HasValue)
        {
            query = filter.Activo.Value
                ? query.Where(h => h.Activo == 1)
                : query.Where(h => h.Activo != 1 || h.Activo == null);
        }
        else
        {
            query = query.Where(h => h.Activo == 1);
        }

        if (filter.ExcluirTipos is { Count: > 0 })
        {
            var tiposExcluidos = filter.ExcluirTipos;
            query = query.Where(h => h.Tipo == null || !tiposExcluidos.Contains(h.Tipo));
        }

        if (!string.IsNullOrWhiteSpace(filter.ModoInstitucion))
        {
            var modo = filter.ModoInstitucion.ToLowerInvariant();
            int[] principales = [364, 370, 385];

            query = modo switch
            {
                "todas" => query.Where(h => h.CodigoContactoPrincipal != null && h.CodigoContactoPrincipal != 0),
                "otras" => query.Where(h =>
                    h.CodigoContactoPrincipal != null &&
                    h.CodigoContactoPrincipal != 0 &&
                    !principales.Contains(h.CodigoContactoPrincipal.Value)),
                "imss" => query.Where(h => h.CodigoContactoPrincipal == 364),
                "issste" => query.Where(h => h.CodigoContactoPrincipal == 370),
                "bienestar" => query.Where(h => h.CodigoContactoPrincipal == 385),
                _ => query,
            };
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var s = filter.Search.Trim().ToLowerInvariant();
            query = query.Where(h =>
                (h.NombreContacto != null && h.NombreContacto.ToLower().Contains(s)) ||
                (h.Clues != null && h.Clues.ToLower().Contains(s)) ||
                (h.NombreCorto != null && h.NombreCorto.ToLower().Contains(s)));
        }

        if (filter.TieneCoordenadas.HasValue)
        {
            // Coordenadas validas = no nulas y no ambas en 0 (0/0 es dato basura).
            var tiene = filter.TieneCoordenadas.Value;
            query = query.Where(h =>
                (h.Latitud.HasValue && h.Longitud.HasValue && (h.Latitud.Value != 0m || h.Longitud.Value != 0m)) == tiene);
        }

        return await query
            .OrderBy(h => h.NombreContacto)
            .ToListAsync(cancellationToken);
    }

    public async Task<Hospital?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        return await _asokamDb.Hospitales
            .AsNoTracking()
            .FirstOrDefaultAsync(h => h.CodigoContacto == id, cancellationToken);
    }

    public async Task<List<Hospital>> GetByIdsAsync(
        IEnumerable<int> ids,
        CancellationToken cancellationToken = default)
    {
        var idsList = ids.Distinct().ToList();
        if (idsList.Count == 0) return new List<Hospital>();

        return await _asokamDb.Hospitales
            .AsNoTracking()
            .Where(h => idsList.Contains(h.CodigoContacto))
            .ToListAsync(cancellationToken);
    }
}
