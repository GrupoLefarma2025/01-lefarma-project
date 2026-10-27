using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.EducacionMedica;

public class PersonasService : IPersonasService
{
    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;

    public PersonasService(ApplicationDbContext context, AsokamDbContext asokamContext)
    {
        _context = context;
        _asokamContext = asokamContext;
    }

    public async Task<List<EjecutivoRegionDto>> GetEjecutivosAsync(
        string? busqueda,
        int? idTipoGerencia,
        bool? soloActivos,
        CancellationToken ct = default)
    {
        var soloVigentes = soloActivos ?? true;
        var query = _context.EjecutivosRegion
            .AsNoTracking()
            .Include(e => e.Region)
            .AsQueryable();

        if (soloVigentes)
        {
            query = query.Where(e => e.Activo);
        }

        if (idTipoGerencia.HasValue)
        {
            query = query.Where(e => e.Region != null && e.Region.IdTipoGerencia == idTipoGerencia.Value);
        }

        var filas = await query
            .OrderBy(e => e.IdUsuario)
            .ThenBy(e => e.IdRegionCatalogo)
            .ToListAsync(ct);

        var nombresUsuarios = await ResolverNombresUsuariosAsync(filas.Select(e => e.IdUsuario), ct);
        var nombresGerencias = await ResolverNombresGerenciasAsync(ct);

        var dtos = filas.Select(e => new EjecutivoRegionDto
        {
            IdEjecutivoRegion = e.IdEjecutivoRegion,
            IdUsuario = e.IdUsuario,
            NombreUsuario = nombresUsuarios.GetValueOrDefault(e.IdUsuario, $"Usuario {e.IdUsuario}"),
            IdRegionCatalogo = e.IdRegionCatalogo,
            NombreRegion = e.Region?.Nombre ?? $"Región {e.IdRegionCatalogo}",
            IdTipoGerencia = e.Region?.IdTipoGerencia ?? 0,
            NombreGerencia = e.Region is not null
                ? nombresGerencias.GetValueOrDefault(e.Region.IdTipoGerencia, $"Gerencia {e.Region.IdTipoGerencia}")
                : string.Empty,
            Activo = e.Activo,
        }).ToList();

        var termino = busqueda?.Trim();
        if (!string.IsNullOrEmpty(termino))
        {
            dtos = dtos
                .Where(d =>
                    d.NombreUsuario.Contains(termino, StringComparison.OrdinalIgnoreCase) ||
                    d.NombreRegion.Contains(termino, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        return dtos;
    }

    public async Task<EjecutivoRegionDto> CrearEjecutivoAsync(
        CrearEjecutivoRegionRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        await ValidarUsuarioAsync(request.IdUsuario, ct);
        var region = await ObtenerRegionActivaAsync(request.IdRegionCatalogo, ct);

        var duplicado = await _context.EjecutivosRegion
            .AnyAsync(e => e.Activo
                && e.IdUsuario == request.IdUsuario
                && e.IdRegionCatalogo == request.IdRegionCatalogo, ct);
        if (duplicado)
        {
            throw new InvalidOperationException("El ejecutivo ya tiene asignada esa región.");
        }

        await ValidarMismaGerenciaAsync(request.IdUsuario, region.IdTipoGerencia, null, ct);

        var fila = new EjecutivoRegion
        {
            IdUsuario = request.IdUsuario,
            IdRegionCatalogo = request.IdRegionCatalogo,
            Activo = true,
            FechaCreacion = DateTime.UtcNow,
            FechaModificacion = DateTime.UtcNow,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        };

        _context.EjecutivosRegion.Add(fila);
        await _context.SaveChangesAsync(ct);

        var nombres = await ResolverNombresUsuariosAsync([request.IdUsuario], ct);
        var gerencias = await ResolverNombresGerenciasAsync(ct);

        return new EjecutivoRegionDto
        {
            IdEjecutivoRegion = fila.IdEjecutivoRegion,
            IdUsuario = fila.IdUsuario,
            NombreUsuario = nombres.GetValueOrDefault(fila.IdUsuario, $"Usuario {fila.IdUsuario}"),
            IdRegionCatalogo = fila.IdRegionCatalogo,
            NombreRegion = region.Nombre,
            IdTipoGerencia = region.IdTipoGerencia,
            NombreGerencia = gerencias.GetValueOrDefault(region.IdTipoGerencia, $"Gerencia {region.IdTipoGerencia}"),
            Activo = fila.Activo,
        };
    }

    public async Task<EjecutivoRegionDto?> ActualizarEjecutivoAsync(
        int idEjecutivoRegion,
        ActualizarEjecutivoRegionRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var fila = await _context.EjecutivosRegion
            .FirstOrDefaultAsync(e => e.IdEjecutivoRegion == idEjecutivoRegion, ct);
        if (fila is null)
        {
            return null;
        }

        var region = await ObtenerRegionActivaAsync(request.IdRegionCatalogo, ct);

        var activo = request.Activo ?? fila.Activo;
        if (activo)
        {
            var duplicado = await _context.EjecutivosRegion
                .AnyAsync(e => e.Activo
                    && e.IdEjecutivoRegion != idEjecutivoRegion
                    && e.IdUsuario == fila.IdUsuario
                    && e.IdRegionCatalogo == request.IdRegionCatalogo, ct);
            if (duplicado)
            {
                throw new InvalidOperationException("El ejecutivo ya tiene asignada esa región.");
            }

            await ValidarMismaGerenciaAsync(fila.IdUsuario, region.IdTipoGerencia, idEjecutivoRegion, ct);
        }

        fila.IdRegionCatalogo = request.IdRegionCatalogo;
        fila.Activo = activo;
        fila.FechaModificacion = DateTime.UtcNow;
        fila.IdUsuarioModificacion = idUsuario;
        await _context.SaveChangesAsync(ct);

        var nombres = await ResolverNombresUsuariosAsync([fila.IdUsuario], ct);
        var gerencias = await ResolverNombresGerenciasAsync(ct);

        return new EjecutivoRegionDto
        {
            IdEjecutivoRegion = fila.IdEjecutivoRegion,
            IdUsuario = fila.IdUsuario,
            NombreUsuario = nombres.GetValueOrDefault(fila.IdUsuario, $"Usuario {fila.IdUsuario}"),
            IdRegionCatalogo = fila.IdRegionCatalogo,
            NombreRegion = region.Nombre,
            IdTipoGerencia = region.IdTipoGerencia,
            NombreGerencia = gerencias.GetValueOrDefault(region.IdTipoGerencia, $"Gerencia {region.IdTipoGerencia}"),
            Activo = fila.Activo,
        };
    }

    public async Task<bool> DesactivarEjecutivoAsync(
        int idEjecutivoRegion,
        int idUsuario,
        CancellationToken ct = default)
    {
        var fila = await _context.EjecutivosRegion
            .FirstOrDefaultAsync(e => e.IdEjecutivoRegion == idEjecutivoRegion, ct);
        if (fila is null)
        {
            return false;
        }

        fila.Activo = false;
        fila.FechaModificacion = DateTime.UtcNow;
        fila.IdUsuarioModificacion = idUsuario;
        await _context.SaveChangesAsync(ct);
        return true;
    }

    public async Task<List<EjecutivoSuplenteDto>> GetEjecutivosSuplentesAsync(
        string? busqueda,
        int? idTipoGerencia,
        bool? soloActivos,
        CancellationToken ct = default)
    {
        var soloDisponibles = soloActivos ?? true;
        var query = _context.EjecutivosSuplentes
            .AsNoTracking()
            .Include(e => e.TipoGerencia)
            .Include(e => e.Region)
            .AsQueryable();

        if (soloDisponibles)
        {
            query = query.Where(e => e.Activo);
        }

        if (idTipoGerencia.HasValue)
        {
            query = query.Where(e =>
                e.IdTipoGerencia == idTipoGerencia.Value
                || e.IdTipoGerencia == null);
        }

        var filas = await query
            .OrderBy(e => e.IdUsuario)
            .ThenBy(e => e.IdTipoGerencia)
            .ThenBy(e => e.IdRegionCatalogo)
            .ToListAsync(ct);

        var nombres = await ResolverNombresUsuariosAsync(
            filas.Select(e => e.IdUsuario), ct);

        var dtos = filas.Select(e => new EjecutivoSuplenteDto
        {
            IdEjecutivoSuplente = e.IdEjecutivoSuplente,
            IdUsuario = e.IdUsuario,
            NombreUsuario = nombres.GetValueOrDefault(e.IdUsuario, $"Usuario {e.IdUsuario}"),
            IdTipoGerencia = e.IdTipoGerencia,
            NombreGerencia = e.TipoGerencia?.Descripcion ?? "Todas",
            IdRegionCatalogo = e.IdRegionCatalogo,
            NombreRegion = e.Region?.Nombre ?? "Todas",
            Activo = e.Activo,
        }).ToList();

        var termino = busqueda?.Trim();
        if (!string.IsNullOrEmpty(termino))
        {
            dtos = dtos
                .Where(d =>
                    d.NombreUsuario.Contains(termino, StringComparison.OrdinalIgnoreCase)
                    || d.NombreGerencia.Contains(termino, StringComparison.OrdinalIgnoreCase)
                    || d.NombreRegion.Contains(termino, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        return dtos;
    }

    public async Task<EjecutivoSuplenteDto> CrearEjecutivoSuplenteAsync(
        CrearEjecutivoSuplenteRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        await ValidarUsuarioAsync(request.IdUsuario, ct);
        var (idTipoGerencia, idRegionCatalogo) = await NormalizarCoberturaSuplenteAsync(
            request.IdTipoGerencia, request.IdRegionCatalogo, ct);

        await ValidarSuplenteDuplicadoAsync(
            request.IdUsuario, idTipoGerencia, idRegionCatalogo, null, ct);

        var fila = new EjecutivoSuplente
        {
            IdUsuario = request.IdUsuario,
            IdTipoGerencia = idTipoGerencia,
            IdRegionCatalogo = idRegionCatalogo,
            Activo = request.Activo,
            FechaCreacion = DateTime.UtcNow,
            FechaModificacion = DateTime.UtcNow,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        };

        _context.EjecutivosSuplentes.Add(fila);
        await _context.SaveChangesAsync(ct);

        return await ArmarSuplenteDtoAsync(fila.IdEjecutivoSuplente, ct);
    }

    public async Task<EjecutivoSuplenteDto?> ActualizarEjecutivoSuplenteAsync(
        int idEjecutivoSuplente,
        ActualizarEjecutivoSuplenteRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var fila = await _context.EjecutivosSuplentes
            .FirstOrDefaultAsync(e => e.IdEjecutivoSuplente == idEjecutivoSuplente, ct);
        if (fila is null)
        {
            return null;
        }

        var (idTipoGerencia, idRegionCatalogo) = await NormalizarCoberturaSuplenteAsync(
            request.IdTipoGerencia, request.IdRegionCatalogo, ct);
        var activo = request.Activo ?? fila.Activo;

        if (activo)
        {
            await ValidarSuplenteDuplicadoAsync(
                fila.IdUsuario, idTipoGerencia, idRegionCatalogo, idEjecutivoSuplente, ct);
        }

        fila.IdTipoGerencia = idTipoGerencia;
        fila.IdRegionCatalogo = idRegionCatalogo;
        fila.Activo = activo;
        fila.FechaModificacion = DateTime.UtcNow;
        fila.IdUsuarioModificacion = idUsuario;
        await _context.SaveChangesAsync(ct);

        return await ArmarSuplenteDtoAsync(fila.IdEjecutivoSuplente, ct);
    }

    public async Task<bool> DesactivarEjecutivoSuplenteAsync(
        int idEjecutivoSuplente,
        int idUsuario,
        CancellationToken ct = default)
    {
        var fila = await _context.EjecutivosSuplentes
            .FirstOrDefaultAsync(e => e.IdEjecutivoSuplente == idEjecutivoSuplente, ct);
        if (fila is null)
        {
            return false;
        }

        fila.Activo = false;
        fila.FechaModificacion = DateTime.UtcNow;
        fila.IdUsuarioModificacion = idUsuario;
        await _context.SaveChangesAsync(ct);
        return true;
    }

    private async Task<(int? IdTipoGerencia, int? IdRegionCatalogo)> NormalizarCoberturaSuplenteAsync(
        int? idTipoGerencia,
        int? idRegionCatalogo,
        CancellationToken ct)
    {
        RegionCatalogo? region = null;
        if (idRegionCatalogo.HasValue)
        {
            region = await ObtenerRegionActivaAsync(idRegionCatalogo.Value, ct);
        }

        if (idTipoGerencia.HasValue)
        {
            var existe = await _context.TiposGerencia
                .AsNoTracking()
                .AnyAsync(t => t.IdTipoGerencia == idTipoGerencia.Value && t.Activo, ct);
            if (!existe)
            {
                throw new InvalidOperationException(
                    $"La gerencia {idTipoGerencia} no existe o está inactiva.");
            }
        }

        if (region is not null)
        {
            if (idTipoGerencia.HasValue && idTipoGerencia.Value != region.IdTipoGerencia)
            {
                throw new InvalidOperationException(
                    "La región seleccionada no pertenece a la gerencia indicada.");
            }

            idTipoGerencia = region.IdTipoGerencia;
        }

        return (idTipoGerencia, idRegionCatalogo);
    }

    private async Task ValidarSuplenteDuplicadoAsync(
        int idUsuario,
        int? idTipoGerencia,
        int? idRegionCatalogo,
        int? excluirIdEjecutivoSuplente,
        CancellationToken ct)
    {
        var duplicado = await _context.EjecutivosSuplentes
            .AnyAsync(e => e.Activo
                && e.IdUsuario == idUsuario
                && e.IdTipoGerencia == idTipoGerencia
                && e.IdRegionCatalogo == idRegionCatalogo
                && (!excluirIdEjecutivoSuplente.HasValue
                    || e.IdEjecutivoSuplente != excluirIdEjecutivoSuplente.Value), ct);

        if (duplicado)
        {
            throw new InvalidOperationException(
                "El usuario ya tiene esa cobertura activa como ejecutivo suplente.");
        }
    }

    private async Task<EjecutivoSuplenteDto> ArmarSuplenteDtoAsync(
        int idEjecutivoSuplente,
        CancellationToken ct)
    {
        var fila = await _context.EjecutivosSuplentes
            .AsNoTracking()
            .Include(e => e.TipoGerencia)
            .Include(e => e.Region)
            .FirstAsync(e => e.IdEjecutivoSuplente == idEjecutivoSuplente, ct);
        var nombres = await ResolverNombresUsuariosAsync([fila.IdUsuario], ct);

        return new EjecutivoSuplenteDto
        {
            IdEjecutivoSuplente = fila.IdEjecutivoSuplente,
            IdUsuario = fila.IdUsuario,
            NombreUsuario = nombres.GetValueOrDefault(fila.IdUsuario, $"Usuario {fila.IdUsuario}"),
            IdTipoGerencia = fila.IdTipoGerencia,
            NombreGerencia = fila.TipoGerencia?.Descripcion ?? "Todas",
            IdRegionCatalogo = fila.IdRegionCatalogo,
            NombreRegion = fila.Region?.Nombre ?? "Todas",
            Activo = fila.Activo,
        };
    }

    public async Task<List<EspecialistaDto>> GetEspecialistasAsync(
        string? busqueda,
        bool? soloActivos,
        CancellationToken ct = default)
    {
        var soloVigentes = soloActivos ?? true;
        var queryGerencias = _context.EspecialistasGerencia
            .AsNoTracking()
            .Include(e => e.TipoGerencia)
            .AsQueryable();
        var queryRegiones = _context.EspecialistasRegion
            .AsNoTracking()
            .Include(e => e.Region)
            .AsQueryable();

        if (soloVigentes)
        {
            queryGerencias = queryGerencias.Where(e => e.Activo);
            queryRegiones = queryRegiones.Where(e => e.Activo);
        }

        var gerencias = await queryGerencias.ToListAsync(ct);
        var regiones = await queryRegiones.ToListAsync(ct);

        var idsUsuarios = gerencias.Select(e => e.IdUsuario)
            .Union(regiones.Select(e => e.IdUsuario))
            .Distinct()
            .ToList();
        var nombres = await ResolverNombresUsuariosAsync(idsUsuarios, ct);

        var dtos = idsUsuarios
            .Select(idUsuario =>
            {
                var gerenciasUsuario = gerencias
                    .Where(e => e.IdUsuario == idUsuario)
                    .OrderBy(e => e.IdTipoGerencia)
                    .Select(e => new EspecialistaGerenciaDto
                    {
                        IdEspecialistaGerencia = e.IdEspecialistaGerencia,
                        IdTipoGerencia = e.IdTipoGerencia,
                        NombreGerencia = e.TipoGerencia?.Descripcion ?? $"Gerencia {e.IdTipoGerencia}",
                        Activo = e.Activo,
                    })
                    .ToList();

                var region = regiones
                    .Where(e => e.IdUsuario == idUsuario)
                    .OrderByDescending(e => e.Activo)
                    .FirstOrDefault();

                return new EspecialistaDto
                {
                    IdUsuario = idUsuario,
                    NombreUsuario = nombres.GetValueOrDefault(idUsuario, $"Usuario {idUsuario}"),
                    Gerencias = gerenciasUsuario,
                    RegionPreferida = region is null ? null : new EspecialistaRegionDto
                    {
                        IdEspecialistaRegion = region.IdEspecialistaRegion,
                        IdRegionCatalogo = region.IdRegionCatalogo,
                        NombreRegion = region.Region?.Nombre ?? $"Región {region.IdRegionCatalogo}",
                        Activo = region.Activo,
                    },
                    Activo = gerenciasUsuario.Any(g => g.Activo),
                };
            })
            .Where(e => !soloVigentes || e.Activo)
            .OrderBy(e => e.NombreUsuario)
            .ToList();

        var termino = busqueda?.Trim();
        if (!string.IsNullOrEmpty(termino))
        {
            dtos = dtos
                .Where(e => e.NombreUsuario.Contains(termino, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        return dtos;
    }

    public async Task<EspecialistaDto> GuardarEspecialistaAsync(
        GuardarEspecialistaRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        await ValidarUsuarioAsync(request.IdUsuario, ct);

        var idsGerencias = request.IdsTipoGerencia
            .Distinct()
            .ToList();
        if (idsGerencias.Count == 0)
        {
            throw new InvalidOperationException("Selecciona al menos una gerencia para el especialista.");
        }

        var gerenciasValidas = await _context.TiposGerencia
            .AsNoTracking()
            .Where(t => idsGerencias.Contains(t.IdTipoGerencia) && t.Activo)
            .Select(t => t.IdTipoGerencia)
            .ToListAsync(ct);
        var faltantes = idsGerencias.Except(gerenciasValidas).ToList();
        if (faltantes.Count > 0)
        {
            throw new InvalidOperationException(
                $"Gerencia(s) no válida(s) o inactiva(s): {string.Join(", ", faltantes)}.");
        }

        RegionCatalogo? region = null;
        if (request.IdRegionCatalogo.HasValue)
        {
            region = await ObtenerRegionActivaAsync(request.IdRegionCatalogo.Value, ct);
        }

        await using var tx = _context.Database.IsRelational()
            ? await _context.Database.BeginTransactionAsync(ct)
            : null;

        var existentesGerencias = await _context.EspecialistasGerencia
            .Where(e => e.IdUsuario == request.IdUsuario)
            .ToListAsync(ct);

        foreach (var existente in existentesGerencias)
        {
            existente.Activo = idsGerencias.Contains(existente.IdTipoGerencia);
            existente.FechaModificacion = DateTime.UtcNow;
            existente.IdUsuarioModificacion = idUsuario;
        }

        foreach (var idTipoGerencia in idsGerencias)
        {
            if (existentesGerencias.Any(e => e.IdTipoGerencia == idTipoGerencia))
            {
                continue;
            }

            _context.EspecialistasGerencia.Add(new EspecialistaGerencia
            {
                IdUsuario = request.IdUsuario,
                IdTipoGerencia = idTipoGerencia,
                Activo = true,
                FechaCreacion = DateTime.UtcNow,
                FechaModificacion = DateTime.UtcNow,
                IdUsuarioCreacion = idUsuario,
                IdUsuarioModificacion = idUsuario,
            });
        }

        var existentesRegiones = await _context.EspecialistasRegion
            .Where(e => e.IdUsuario == request.IdUsuario)
            .ToListAsync(ct);

        foreach (var existente in existentesRegiones)
        {
            existente.Activo = region is not null && existente.IdRegionCatalogo == region.IdRegion;
            existente.FechaModificacion = DateTime.UtcNow;
            existente.IdUsuarioModificacion = idUsuario;
        }

        if (region is not null && !existentesRegiones.Any(e => e.IdRegionCatalogo == region.IdRegion))
        {
            _context.EspecialistasRegion.Add(new EspecialistaRegion
            {
                IdUsuario = request.IdUsuario,
                IdRegionCatalogo = region.IdRegion,
                Activo = true,
                FechaCreacion = DateTime.UtcNow,
                FechaModificacion = DateTime.UtcNow,
                IdUsuarioCreacion = idUsuario,
                IdUsuarioModificacion = idUsuario,
            });
        }

        await _context.SaveChangesAsync(ct);
        if (tx is not null)
        {
            await tx.CommitAsync(ct);
        }

        var especialistas = await GetEspecialistasAsync(null, false, ct);
        return especialistas.First(e => e.IdUsuario == request.IdUsuario);
    }

    private async Task ValidarUsuarioAsync(int idUsuario, CancellationToken ct)
    {
        var existe = await _asokamContext.Usuarios
            .AsNoTracking()
            .AnyAsync(u => u.IdUsuario == idUsuario, ct);
        if (!existe)
        {
            throw new InvalidOperationException($"El usuario {idUsuario} no existe en Asokam.");
        }
    }

    private async Task<RegionCatalogo> ObtenerRegionActivaAsync(int idRegion, CancellationToken ct)
    {
        var region = await _context.RegionesCat
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.IdRegion == idRegion, ct);
        if (region is null || !region.Activo)
        {
            throw new InvalidOperationException($"La región {idRegion} no existe o está inactiva.");
        }

        return region;
    }

    private async Task ValidarMismaGerenciaAsync(
        int idUsuario,
        int idTipoGerencia,
        int? excluirIdEjecutivoRegion,
        CancellationToken ct)
    {
        var otras = await _context.EjecutivosRegion
            .AsNoTracking()
            .Include(e => e.Region)
            .Where(e => e.Activo
                && e.IdUsuario == idUsuario
                && (!excluirIdEjecutivoRegion.HasValue || e.IdEjecutivoRegion != excluirIdEjecutivoRegion.Value)
                && e.Region != null
                && e.Region.IdTipoGerencia != idTipoGerencia)
            .AnyAsync(ct);

        if (otras)
        {
            throw new InvalidOperationException(
                "Todas las regiones de un ejecutivo deben pertenecer a la misma gerencia.");
        }
    }

    private async Task<Dictionary<int, string>> ResolverNombresUsuariosAsync(
        IEnumerable<int> ids,
        CancellationToken ct)
    {
        var lista = ids.Distinct().ToList();
        if (lista.Count == 0)
        {
            return [];
        }

        return await _asokamContext.Usuarios
            .AsNoTracking()
            .Where(u => lista.Contains(u.IdUsuario))
            .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? string.Empty, ct);
    }

    private async Task<Dictionary<int, string>> ResolverNombresGerenciasAsync(CancellationToken ct)
    {
        return await _context.TiposGerencia
            .AsNoTracking()
            .ToDictionaryAsync(t => t.IdTipoGerencia, t => t.Descripcion, ct);
    }
}
