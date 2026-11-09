using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica;

public class HospitalRepository : IHospitalRepository
{
    private const string CacheActivosKey = "educacion-medica:hospitales-activos:v1";
    private const string CacheInactivosKey = "educacion-medica:hospitales-inactivos:v1";
    private const string CacheIdsKey = "educacion-medica:hospitales-ids:v1";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan CacheLoadTimeout = TimeSpan.FromSeconds(90);
    private static readonly SemaphoreSlim CacheLock = new(1, 1);
    private static readonly CompareInfo Comparador = CultureInfo.InvariantCulture.CompareInfo;

    private readonly AsokamDbContext _asokamDb;
    private readonly IMemoryCache _cache;

    public HospitalRepository(AsokamDbContext asokamDb, IMemoryCache cache)
    {
        _asokamDb = asokamDb;
        _cache = cache;
    }

    public async Task<List<Hospital>> GetHospitalesAsync(
        HospitalFilterParams? filter = null,
        CancellationToken cancellationToken = default)
    {
        filter ??= new HospitalFilterParams();

        if (filter.Ids is { Count: > 0 })
        {
            var ids = filter.Ids;
            var cacheKey = CrearCacheKeyIds(ids, filter.Activo == false);

            if (_cache.TryGetValue(cacheKey, out List<Hospital>? cached) && cached is not null)
            {
                return AplicarFiltros(cached, filter);
            }

            await CacheLock.WaitAsync(cancellationToken);
            try
            {
                if (_cache.TryGetValue(cacheKey, out cached) && cached is not null)
                {
                    return AplicarFiltros(cached, filter);
                }

                var query = ConsultaBase().Where(h => ids.Contains(h.CodigoContacto));
                query = filter.Activo == false
                    ? query.Where(h => h.Activo != 1 || h.Activo == null)
                    : query.Where(h => h.Activo == 1);

                using var loadCts = new CancellationTokenSource(CacheLoadTimeout);
                var cargados = await query.ToListAsync(loadCts.Token);
                _cache.Set(cacheKey, cargados, CacheTtl);
                return AplicarFiltros(cargados, filter);
            }
            finally
            {
                CacheLock.Release();
            }
        }

        var hospitales = filter.Activo == false
            ? await ObtenerCatalogoInactivosAsync(cancellationToken)
            : await ObtenerCatalogoActivosAsync(cancellationToken);

        return AplicarFiltros(hospitales, filter);
    }

    private static List<Hospital> AplicarFiltros(
        List<Hospital> hospitales,
        HospitalFilterParams filter)
    {
        if (filter.ExcluirTipos is { Count: > 0 })
        {
            var tiposExcluidos = filter.ExcluirTipos;
            hospitales = hospitales
                .Where(h => h.Tipo == null || !tiposExcluidos.Contains(h.Tipo))
                .ToList();
        }

        if (!string.IsNullOrWhiteSpace(filter.ModoInstitucion))
        {
            var modo = filter.ModoInstitucion.ToLowerInvariant();
            int[] principales = [364, 370, 385];

            hospitales = modo switch
            {
                "todas" => hospitales
                    .Where(h => h.CodigoContactoPrincipal != null && h.CodigoContactoPrincipal != 0)
                    .ToList(),
                "otras" => hospitales
                    .Where(h =>
                        h.CodigoContactoPrincipal != null &&
                        h.CodigoContactoPrincipal != 0 &&
                        !principales.Contains(h.CodigoContactoPrincipal.Value))
                    .ToList(),
                "imss" => hospitales.Where(h => h.CodigoContactoPrincipal == 364).ToList(),
                "issste" => hospitales.Where(h => h.CodigoContactoPrincipal == 370).ToList(),
                "bienestar" => hospitales.Where(h => h.CodigoContactoPrincipal == 385).ToList(),
                _ => hospitales,
            };
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var s = filter.Search.Trim();
            hospitales = hospitales
                .Where(h =>
                    Contiene(h.NombreContacto, s) ||
                    Contiene(h.Clues, s) ||
                    Contiene(h.NombreCorto, s))
                .ToList();
        }

        if (filter.TieneCoordenadas.HasValue)
        {
            // Coordenadas validas = no nulas y no ambas en 0 (0/0 es dato basura).
            var tiene = filter.TieneCoordenadas.Value;
            hospitales = hospitales
                .Where(h =>
                    (h.Latitud.HasValue && h.Longitud.HasValue && (h.Latitud.Value != 0m || h.Longitud.Value != 0m)) == tiene)
                .ToList();
        }

        return hospitales;
    }

    private async Task<List<Hospital>> ObtenerCatalogoActivosAsync(CancellationToken cancellationToken)
    {
        if (_cache.TryGetValue(CacheActivosKey, out List<Hospital>? cached) && cached is not null)
        {
            return cached;
        }

        await CacheLock.WaitAsync(cancellationToken);
        try
        {
            if (_cache.TryGetValue(CacheActivosKey, out cached) && cached is not null)
            {
                return cached;
            }

            using var loadCts = new CancellationTokenSource(CacheLoadTimeout);
            var hospitales = await ConsultarCatalogoAsync(activos: true, loadCts.Token);

            _cache.Set(CacheActivosKey, hospitales, CacheTtl);
            return hospitales;
        }
        finally
        {
            CacheLock.Release();
        }
    }

    private async Task<List<Hospital>> ObtenerCatalogoInactivosAsync(CancellationToken cancellationToken)
    {
        if (_cache.TryGetValue(CacheInactivosKey, out List<Hospital>? cached) && cached is not null)
        {
            return cached;
        }

        await CacheLock.WaitAsync(cancellationToken);
        try
        {
            if (_cache.TryGetValue(CacheInactivosKey, out cached) && cached is not null)
            {
                return cached;
            }

            using var loadCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            loadCts.CancelAfter(CacheLoadTimeout);
            var hospitales = await ConsultarCatalogoAsync(activos: false, loadCts.Token);

            _cache.Set(CacheInactivosKey, hospitales, CacheTtl);
            return hospitales;
        }
        finally
        {
            CacheLock.Release();
        }
    }

    private async Task<List<Hospital>> ConsultarCatalogoAsync(
        bool activos,
        CancellationToken cancellationToken)
    {
        return activos
            ? await ConsultaBase().Where(h => h.Activo == 1).ToListAsync(cancellationToken)
            : await ConsultaBase()
                .Where(h => h.Activo != 1 || h.Activo == null)
                .ToListAsync(cancellationToken);
    }

    private IQueryable<Hospital> ConsultaBase() =>
        _asokamDb.Hospitales
            .AsNoTracking()
            .Select(h => new Hospital
            {
                CodigoContacto = h.CodigoContacto,
                NombreContacto = h.NombreContacto,
                NombreCorto = h.NombreCorto,
                Clues = h.Clues,
                Ciudad = h.Ciudad,
                CodigoEstado = h.CodigoEstado,
                CodigoContactoPrincipal = h.CodigoContactoPrincipal,
                Latitud = h.Latitud,
                Longitud = h.Longitud,
                Activo = h.Activo,
                Tipo = h.Tipo,
            });

    private static string CrearCacheKeyIds(IEnumerable<int> ids, bool inactivos)
    {
        var texto = string.Join(',', ids.OrderBy(id => id));
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(texto)));
        return $"{CacheIdsKey}:{(inactivos ? "inactivos" : "activos")}:{hash}";
    }

    private static bool Contiene(string? source, string value) =>
        source is not null &&
        Comparador.IndexOf(source, value, CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace) >= 0;

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
