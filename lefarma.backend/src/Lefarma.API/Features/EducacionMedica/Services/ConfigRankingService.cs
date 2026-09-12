using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.EducacionMedica.Services;

public class ConfigRankingService : IConfigRankingService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ConfigRankingService> _logger;

    public ConfigRankingService(ApplicationDbContext context, ILogger<ConfigRankingService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<ConfigRankingConVersionesDto?> GetActivaAsync(CancellationToken cancellationToken = default)
    {
        var activa = await _context.ConfigsRanking
            .AsNoTracking()
            .Include(c => c.Factores)
            .FirstOrDefaultAsync(c => c.Activo, cancellationToken);

        if (activa is null)
        {
            return null;
        }

        var versiones = await _context.ConfigsRanking
            .AsNoTracking()
            .Where(c => c.IdConfiguracion != activa.IdConfiguracion)
            .OrderByDescending(c => c.Version)
            .Select(c => new ConfigRankingVersionDto
            {
                IdConfiguracion = c.IdConfiguracion,
                Nombre = c.Nombre,
                Version = c.Version,
                Activo = c.Activo,
                FechaCreacion = c.FechaCreacion,
            })
            .ToListAsync(cancellationToken);

        var usada = await _context.RankingsEjecuciones
            .AsNoTracking()
            .AnyAsync(e => e.IdConfiguracion == activa.IdConfiguracion, cancellationToken);

        return new ConfigRankingConVersionesDto
        {
            IdConfiguracion = activa.IdConfiguracion,
            Nombre = activa.Nombre,
            Version = activa.Version,
            Activo = activa.Activo,
            Usada = usada,
            FechaVigenciaInicio = activa.FechaVigenciaInicio,
            FechaVigenciaFin = activa.FechaVigenciaFin,
            FechaCreacion = activa.FechaCreacion,
            Factores = activa.Factores.Select(f => new ConfigRankingFactorDto
            {
                IdFactor = f.IdFactor,
                Clave = f.Clave,
                Grupo = f.Grupo,
                Nombre = f.Nombre,
                Descripcion = f.Descripcion,
                Peso = f.Peso,
                Activo = f.Activo,
                TipoNormalizacion = f.TipoNormalizacion,
                ParametrosJson = f.ParametrosJson,
            }).ToList(),
            Versiones = versiones,
        };
    }

    public async Task<List<ConfigRankingResumenDto>> GetListadoAsync(CancellationToken cancellationToken = default)
    {
        var idsUsados = await _context.RankingsEjecuciones
            .AsNoTracking()
            .Select(e => e.IdConfiguracion)
            .Distinct()
            .ToListAsync(cancellationToken);

        var idsUsadosSet = idsUsados.ToHashSet();

        return await _context.ConfigsRanking
            .AsNoTracking()
            .OrderByDescending(c => c.Activo)
            .ThenByDescending(c => c.Version)
            .Select(c => new ConfigRankingResumenDto
            {
                IdConfiguracion = c.IdConfiguracion,
                Nombre = c.Nombre,
                Version = c.Version,
                Activo = c.Activo,
                Usada = idsUsadosSet.Contains(c.IdConfiguracion),
                FechaVigenciaInicio = c.FechaVigenciaInicio,
                FechaVigenciaFin = c.FechaVigenciaFin,
                FechaCreacion = c.FechaCreacion,
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<ConfigRankingDto?> GetByIdAsync(int idConfiguracion, CancellationToken cancellationToken = default)
    {
        var config = await _context.ConfigsRanking
            .AsNoTracking()
            .Include(c => c.Factores)
            .FirstOrDefaultAsync(c => c.IdConfiguracion == idConfiguracion, cancellationToken);

        if (config is null)
        {
            return null;
        }

        var dto = MapearDto(config);
        dto.Usada = await _context.RankingsEjecuciones
            .AsNoTracking()
            .AnyAsync(e => e.IdConfiguracion == idConfiguracion, cancellationToken);

        return dto;
    }

    public async Task<ConfigRankingDto> CrearNuevaVersionAsync(
        int idConfiguracion,
        int idUsuario,
        CancellationToken cancellationToken = default)
    {
        var origen = await _context.ConfigsRanking
            .Include(c => c.Factores)
            .FirstOrDefaultAsync(c => c.IdConfiguracion == idConfiguracion, cancellationToken)
            ?? throw new InvalidOperationException($"La configuración {idConfiguracion} no existe.");

        var maxVersion = await _context.ConfigsRanking
            .Where(c => c.Nombre == origen.Nombre)
            .MaxAsync(c => (int?)c.Version, cancellationToken) ?? 0;

        // V1: solo una configuracion activa. La nueva version reemplaza a la anterior.
        // Vigencia automatica: la nueva inicia HOY y la anterior termina AYER
        // (no es editable desde la UI).
        var fechaInicioNueva = DateOnly.FromDateTime(DateTime.UtcNow);

        var activas = await _context.ConfigsRanking
            .Where(c => c.Activo)
            .ToListAsync(cancellationToken);

        foreach (var anterior in activas)
        {
            anterior.Activo = false;
            if (anterior.FechaVigenciaFin is null || anterior.FechaVigenciaFin >= fechaInicioNueva)
            {
                anterior.FechaVigenciaFin = fechaInicioNueva.AddDays(-1);
            }
            anterior.IdUsuarioModificacion = idUsuario;
            anterior.FechaModificacion = DateTime.UtcNow;
        }

        var nueva = new ConfigRanking
        {
            Nombre = origen.Nombre,
            Version = maxVersion + 1,
            Activo = true,
            FechaVigenciaInicio = fechaInicioNueva,
            FechaVigenciaFin = null,
            FechaCreacion = DateTime.UtcNow,
            FechaModificacion = DateTime.UtcNow,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
            Factores = origen.Factores.Select(f => new ConfigRankingFactor
            {
                Clave = f.Clave,
                Grupo = f.Grupo,
                Nombre = f.Nombre,
                Descripcion = f.Descripcion,
                Peso = f.Peso,
                Activo = f.Activo,
                TipoNormalizacion = f.TipoNormalizacion,
                ParametrosJson = f.ParametrosJson,
            }).ToList(),
        };

        _context.ConfigsRanking.Add(nueva);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Nueva versión de config_ranking {IdConfiguracion} creada desde {IdOrigen} por usuario {IdUsuario}.",
            nueva.IdConfiguracion,
            idConfiguracion,
            idUsuario);

        return MapearDto(nueva);
    }

    public async Task<ConfigRankingDto> UpdateAsync(
        int idConfiguracion,
        UpsertConfigRankingRequest request,
        int idUsuario,
        CancellationToken cancellationToken = default)
    {
        var config = await _context.ConfigsRanking
            .Include(c => c.Factores)
            .FirstOrDefaultAsync(c => c.IdConfiguracion == idConfiguracion, cancellationToken)
            ?? throw new InvalidOperationException($"La configuración {idConfiguracion} no existe.");

        var fueUsada = await _context.RankingsEjecuciones
            .AsNoTracking()
            .AnyAsync(e => e.IdConfiguracion == idConfiguracion, cancellationToken);

        if (fueUsada)
        {
            throw new InvalidOperationException(
                "No se puede editar una configuración que ya fue usada en una ejecución de ranking; cree una nueva versión.");
        }

        ValidarFactores(request);

        config.Nombre = request.Nombre;
        config.IdUsuarioModificacion = idUsuario;
        config.FechaModificacion = DateTime.UtcNow;

        _context.ConfigsRankingFactores.RemoveRange(config.Factores);
        config.Factores = request.Factores.Select(f => new ConfigRankingFactor
        {
            IdConfiguracion = idConfiguracion,
            Clave = f.Clave,
            Grupo = f.Grupo,
            Nombre = f.Nombre,
            Descripcion = f.Descripcion,
            Peso = f.Peso,
            Activo = f.Activo,
            TipoNormalizacion = f.TipoNormalizacion,
            ParametrosJson = f.ParametrosJson,
        }).ToList();

        await _context.SaveChangesAsync(cancellationToken);

        return MapearDto(config);
    }

    private static void ValidarFactores(UpsertConfigRankingRequest request)
    {
        if (request.Factores is null || request.Factores.Count == 0)
        {
            throw new InvalidOperationException("Debe enviar al menos un factor.");
        }

        var activos = request.Factores.Where(f => f.Activo).ToList();
        if (activos.Count == 0)
        {
            throw new InvalidOperationException("Debe haber al menos un factor activo.");
        }

        var suma = activos.Sum(f => f.Peso);
        if (suma != 100m)
        {
            throw new InvalidOperationException($"Los pesos activos deben sumar 100; actualmente suman {suma:F2}.");
        }

        var claves = activos.Select(f => f.Clave).ToList();
        var duplicadas = claves.GroupBy(c => c).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
        if (duplicadas.Count > 0)
        {
            throw new InvalidOperationException($"Factores duplicados: {string.Join(", ", duplicadas)}.");
        }
    }

    private ConfigRankingDto MapearDto(ConfigRanking config)
    {
        return new ConfigRankingDto
        {
            IdConfiguracion = config.IdConfiguracion,
            Nombre = config.Nombre,
            Version = config.Version,
            Activo = config.Activo,
            Usada = false,
            FechaVigenciaInicio = config.FechaVigenciaInicio,
            FechaVigenciaFin = config.FechaVigenciaFin,
            FechaCreacion = config.FechaCreacion,
            Factores = config.Factores.Select(f => new ConfigRankingFactorDto
            {
                IdFactor = f.IdFactor,
                Clave = f.Clave,
                Grupo = f.Grupo,
                Nombre = f.Nombre,
                Descripcion = f.Descripcion,
                Peso = f.Peso,
                Activo = f.Activo,
                TipoNormalizacion = f.TipoNormalizacion,
                ParametrosJson = f.ParametrosJson,
            }).ToList(),
        };
    }
}
