using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Runtime.CompilerServices;

namespace Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica;

public class RegionRepository : IRegionRepository
{
    private readonly ApplicationDbContext _context;

    public RegionRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<RegionCatalogo>> GetAllAsync(CancellationToken cancellationToken = default, int? idTipoGerencia = null)
    {
        var query = _context.RegionesCat.AsNoTracking();

        if (idTipoGerencia.HasValue)
        {
            query = query.Where(r => r.IdTipoGerencia == idTipoGerencia.Value);
        }

        return await query
            .OrderBy(r => r.IdTipoGerencia)
            .ThenBy(r => r.Nombre)
            .ToListAsync(cancellationToken);
    }

    public async Task<RegionCatalogo?> GetByIdAsync(int idRegion, CancellationToken cancellationToken = default)
    {
        return await _context.RegionesCat
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.IdRegion == idRegion, cancellationToken);
    }

    public async Task<RegionCatalogo?> GetByNombreAsync(string nombre, CancellationToken cancellationToken = default, int? idTipoGerencia = null)
    {
        var query = _context.RegionesCat.AsNoTracking().Where(r => r.Nombre == nombre);

        if (idTipoGerencia.HasValue)
        {
            query = query.Where(r => r.IdTipoGerencia == idTipoGerencia.Value);
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<RegionCatalogo> CreateAsync(RegionCatalogo region, CancellationToken cancellationToken = default)
    {
        region.Activo = true;
        region.FechaCreacion = DateTime.UtcNow;
        region.FechaModificacion = DateTime.UtcNow;

        _context.RegionesCat.Add(region);
        await _context.SaveChangesAsync(cancellationToken);

        return region;
    }

    public async Task UpdateAsync(RegionCatalogo region, CancellationToken cancellationToken = default)
    {
        region.FechaModificacion = DateTime.UtcNow;

        _context.RegionesCat.Update(region);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<Dictionary<int, int>> GetConteosHospitalesAsync(CancellationToken cancellationToken = default)
    {
        return await _context.HospitalesExtension
            .Where(h => h.IdRegion.HasValue)
            .GroupBy(h => h.IdRegion!.Value)
            .Select(g => new { IdRegion = g.Key, Total = g.Count() })
            .ToDictionaryAsync(x => x.IdRegion, x => x.Total, cancellationToken);
    }

    public async Task<List<RegionEstado>> GetMapeosAsync(CancellationToken cancellationToken = default, int? idTipoGerencia = null)
    {
        var query = _context.RegionesEstados.AsNoTracking().Include(m => m.Region).AsQueryable();

        if (idTipoGerencia.HasValue)
        {
            query = query.Where(m => m.IdTipoGerencia == idTipoGerencia.Value);
        }

        return await query
            .OrderBy(m => m.CodigoEstado)
            .ToListAsync(cancellationToken);
    }

    public async Task<RegionEstado?> GetMapeoByEstadoAsync(int codigoEstado, CancellationToken cancellationToken = default, int? idTipoGerencia = null)
    {
        var query = _context.RegionesEstados.Where(m => m.CodigoEstado == codigoEstado);

        if (idTipoGerencia.HasValue)
        {
            query = query.Where(m => m.IdTipoGerencia == idTipoGerencia.Value);
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<RegionEstado> CreateMapeoAsync(RegionEstado mapeo, CancellationToken cancellationToken = default)
    {
        mapeo.FechaCreacion = DateTime.UtcNow;
        mapeo.FechaModificacion = DateTime.UtcNow;

        _context.RegionesEstados.Add(mapeo);
        await _context.SaveChangesAsync(cancellationToken);

        return mapeo;
    }

    public async Task UpdateMapeoAsync(RegionEstado mapeo, CancellationToken cancellationToken = default)
    {
        mapeo.FechaModificacion = DateTime.UtcNow;

        _context.RegionesEstados.Update(mapeo);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task SyncEstadosAsync(
        int idRegion,
        IEnumerable<int> codigoEstados,
        int idUsuario,
        CancellationToken cancellationToken = default)
    {
        var region = await _context.RegionesCat
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.IdRegion == idRegion, cancellationToken)
            ?? throw new InvalidOperationException($"No existe la región {idRegion}.");

        var idTipoGerencia = region.IdTipoGerencia;
        var deseados = codigoEstados.Distinct().ToList();

        var existentes = await _context.RegionesEstados
            .Where(m => m.IdRegion == idRegion)
            .ToListAsync(cancellationToken);

        // Estados que salieron de la región: se elimina el mapeo.
        var aQuitar = existentes.Where(m => !deseados.Contains(m.CodigoEstado)).ToList();
        if (aQuitar.Count > 0)
        {
            _context.RegionesEstados.RemoveRange(aQuitar);
        }

        // 1 estado = 1 región DENTRO DE LA MISMA GERENCIA: si el estado estaba en
        // otra región de esta gerencia, se mueve. Las regiones de otras gerencias
        // conservan su propio mapeo del estado.
        var ocupadosEnOtra = await _context.RegionesEstados
            .Where(m => m.IdRegion != idRegion
                        && m.IdTipoGerencia == idTipoGerencia
                        && deseados.Contains(m.CodigoEstado))
            .ToListAsync(cancellationToken);
        if (ocupadosEnOtra.Count > 0)
        {
            _context.RegionesEstados.RemoveRange(ocupadosEnOtra);
        }

        // Defensivo: mapeos de esta región deben declarar su misma gerencia.
        foreach (var mapeo in existentes.Where(m => m.IdTipoGerencia != idTipoGerencia))
        {
            mapeo.IdTipoGerencia = idTipoGerencia;
            mapeo.FechaModificacion = DateTime.UtcNow;
        }

        var existentesCodigos = existentes.Select(m => m.CodigoEstado).ToHashSet();
        foreach (var codigo in deseados.Where(c => !existentesCodigos.Contains(c)))
        {
            _context.RegionesEstados.Add(new RegionEstado
            {
                CodigoEstado = codigo,
                IdRegion = idRegion,
                IdTipoGerencia = idTipoGerencia,
                IdUsuarioCreacion = idUsuario,
                IdUsuarioModificacion = idUsuario
            });
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<MapeoPendienteAplicar>> PreviewAplicarMapeoAsync(
        CancellationToken cancellationToken = default,
        int? idTipoGerencia = null)
    {
        // CROSS-DB: el join hospital_extension (Lefarma) con genContactosCat
        // (Asokam) solo es posible en SQL; EF no cruza DbContexts.
        // El mapeo ahora es por gerencia: ze.id_tipo_gerencia = he.id_tipo_gerencia.
        const string sql = """
            SELECT ze.codigo_estado AS CodigoEstado, ze.id_region AS IdRegion, COUNT(*) AS Hospitales
            FROM educacion_medica.hospital_extension he
            JOIN Asokam.dbo.genContactosCat g ON g.codigoContacto = he.id_hospital
            JOIN educacion_medica.regiones_estados ze
                ON ze.codigo_estado = TRY_CAST(g.codigoEstado AS INT)
               AND ze.id_tipo_gerencia = he.id_tipo_gerencia
            WHERE he.id_tipo_gerencia IS NOT NULL
              AND (he.id_region IS NULL OR he.id_region <> ze.id_region)
              AND ({0} IS NULL OR he.id_tipo_gerencia = {0})
            GROUP BY ze.codigo_estado, ze.id_region
            ORDER BY ze.codigo_estado
            """;

        return await _context.Database
            .SqlQuery<MapeoPendienteAplicar>(FormattableStringFactory.Create(sql, idTipoGerencia))
            .ToListAsync(cancellationToken);
    }

    public async Task<int> AplicarMapeoAsync(int idUsuario, CancellationToken cancellationToken = default, int? idTipoGerencia = null)
    {
        const string sql = """
            UPDATE he
            SET id_region = ze.id_region,
                fecha_modificacion = SYSUTCDATETIME(),
                id_usuario_modificacion = {0}
            FROM educacion_medica.hospital_extension he
            JOIN Asokam.dbo.genContactosCat g ON g.codigoContacto = he.id_hospital
            JOIN educacion_medica.regiones_estados ze
                ON ze.codigo_estado = TRY_CAST(g.codigoEstado AS INT)
               AND ze.id_tipo_gerencia = he.id_tipo_gerencia
            WHERE he.id_tipo_gerencia IS NOT NULL
              AND (he.id_region IS NULL OR he.id_region <> ze.id_region)
              AND ({1} IS NULL OR he.id_tipo_gerencia = {1})
            """;

        return await _context.Database.ExecuteSqlAsync(
            FormattableStringFactory.Create(sql, idUsuario, idTipoGerencia),
            cancellationToken);
    }

    // Candidatos del pase GPS: sin región, sin mapeo de estado EN SU GERENCIA y con
    // coordenadas válidas (se descarta NULL y 0 como en el resto del módulo).
    // La gerencia se compara contra el mismo placeholder {N} del FormattableString
    // (null = ambas gerencias). Solo compiten regiones de la MISMA gerencia.
    private static string CteCandidatosGps(int indiceGerencia)
    {
        var ph = "{" + indiceGerencia + "}";

        return $"""
            WITH candidatos AS (
                SELECT he.id_hospital_extension,
                       he.id_tipo_gerencia,
                       TRY_CAST(g.latitud AS FLOAT) AS lat,
                       TRY_CAST(g.longitud AS FLOAT) AS lon
                FROM educacion_medica.hospital_extension he
                JOIN Asokam.dbo.genContactosCat g ON g.codigoContacto = he.id_hospital
                WHERE he.id_region IS NULL
                  AND he.id_tipo_gerencia IS NOT NULL
                  AND NULLIF(TRY_CAST(g.latitud AS FLOAT), 0) IS NOT NULL
                  AND NULLIF(TRY_CAST(g.longitud AS FLOAT), 0) IS NOT NULL
                  AND ({ph} IS NULL OR he.id_tipo_gerencia = {ph})
                  AND NOT EXISTS (SELECT 1 FROM educacion_medica.regiones_estados ze
                                  WHERE ze.codigo_estado = TRY_CAST(g.codigoEstado AS INT)
                                    AND ze.id_tipo_gerencia = he.id_tipo_gerencia)
            ),
            mejores AS (
                SELECT c.id_hospital_extension,
                       z.id_region,
                       ROW_NUMBER() OVER (
                           PARTITION BY c.id_hospital_extension
                           ORDER BY geography::Point(c.lat, c.lon, 4326).STDistance(
                               geography::Point(CAST(z.centro_latitud AS FLOAT), CAST(z.centro_longitud AS FLOAT), 4326))
                       ) AS rn
                FROM candidatos c
                CROSS JOIN educacion_medica.regiones_cat z
                WHERE z.activo = 1
                  AND z.id_tipo_gerencia = c.id_tipo_gerencia
                  AND z.centro_latitud IS NOT NULL
                  AND z.centro_longitud IS NOT NULL
            )
            """;
    }

    public async Task<List<MapeoGpsPendienteAplicar>> PreviewAplicarMapeoGpsAsync(
        CancellationToken cancellationToken = default,
        int? idTipoGerencia = null)
    {
        var sql = CteCandidatosGps(0) + """

            SELECT m.id_region AS IdRegion, COUNT(*) AS Hospitales
            FROM mejores m
            WHERE m.rn = 1
            GROUP BY m.id_region
            ORDER BY m.id_region
            """;

        return await _context.Database
            .SqlQuery<MapeoGpsPendienteAplicar>(FormattableStringFactory.Create(sql, idTipoGerencia))
            .ToListAsync(cancellationToken);
    }

    public async Task<int> AplicarMapeoGpsAsync(int idUsuario, CancellationToken cancellationToken = default, int? idTipoGerencia = null)
    {
        var sql = CteCandidatosGps(1) + """

            UPDATE he
            SET id_region = m.id_region,
                fecha_modificacion = SYSUTCDATETIME(),
                id_usuario_modificacion = {0}
            FROM educacion_medica.hospital_extension he
            JOIN mejores m ON m.id_hospital_extension = he.id_hospital_extension AND m.rn = 1
            """;

        return await _context.Database.ExecuteSqlAsync(
            FormattableStringFactory.Create(sql, idUsuario, idTipoGerencia),
            cancellationToken);
    }

    public async Task<int> ContarSinRegionSinCoordenadasAsync(CancellationToken cancellationToken = default, int? idTipoGerencia = null)
    {
        // SqlQuery<int> (tipo primitivo) mapea por la columna "Value".
        const string sql = """
            SELECT COUNT(*) AS Value
            FROM educacion_medica.hospital_extension he
            JOIN Asokam.dbo.genContactosCat g ON g.codigoContacto = he.id_hospital
            WHERE he.id_region IS NULL
              AND he.id_tipo_gerencia IS NOT NULL
              AND ({0} IS NULL OR he.id_tipo_gerencia = {0})
              AND NOT EXISTS (SELECT 1 FROM educacion_medica.regiones_estados ze
                              WHERE ze.codigo_estado = TRY_CAST(g.codigoEstado AS INT)
                                AND ze.id_tipo_gerencia = he.id_tipo_gerencia)
              AND (NULLIF(TRY_CAST(g.latitud AS FLOAT), 0) IS NULL
                   OR NULLIF(TRY_CAST(g.longitud AS FLOAT), 0) IS NULL)
            """;

        return await _context.Database
            .SqlQuery<int>(FormattableStringFactory.Create(sql, idTipoGerencia))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
