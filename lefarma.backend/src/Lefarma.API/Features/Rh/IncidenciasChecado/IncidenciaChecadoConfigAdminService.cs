using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Rh.IncidenciasChecado;

public interface IIncidenciaChecadoConfigAdminService
{
    Task<List<IncidenciaChecadoConfigResponse>> GetAllAsync(CancellationToken ct = default);
    Task<IncidenciaChecadoConfigResponse?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<IncidenciaChecadoConfigResponse> CreateAsync(CreateIncidenciaChecadoConfigRequest request, CancellationToken ct = default);
    Task<IncidenciaChecadoConfigResponse?> UpdateAsync(int id, UpdateIncidenciaChecadoConfigRequest request, CancellationToken ct = default);
}

public class IncidenciaChecadoConfigAdminService : IIncidenciaChecadoConfigAdminService
{
    private readonly ApplicationDbContext _context;

    public IncidenciaChecadoConfigAdminService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<IncidenciaChecadoConfigResponse>> GetAllAsync(CancellationToken ct = default)
    {
        return await _context.IncidenciasChecadoConfig
            .AsNoTracking()
            .OrderByDescending(r => r.Activo)
            .ThenByDescending(r => r.Prioridad)
            .Select(r => MapToResponse(r))
            .ToListAsync(ct);
    }

    public async Task<IncidenciaChecadoConfigResponse?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        return await _context.IncidenciasChecadoConfig
            .AsNoTracking()
            .Where(r => r.IdConfig == id)
            .Select(r => MapToResponse(r))
            .FirstOrDefaultAsync(ct);
    }

    public async Task<IncidenciaChecadoConfigResponse> CreateAsync(CreateIncidenciaChecadoConfigRequest request, CancellationToken ct = default)
    {
        var entity = new IncidenciaChecadoConfig
        {
            Nombre = request.Nombre.Trim(),
            NombreNormalizado = request.Nombre.Trim(),
            Descripcion = request.Descripcion.Trim(),
            DescripcionNormalizada = request.Descripcion.Trim(),
            TipoIncidencia = request.TipoIncidencia,
            MinutosMin = request.MinutosMin,
            MinutosMax = request.MinutosMax,
            CantidadAcumulada = request.CantidadAcumulada,
            Periodo = request.Periodo,
            Prioridad = request.Prioridad,
            RegistroEntrada = request.RegistroEntrada,
            RegistroSalida = request.RegistroSalida,
            ExcluirDiasHabilesConsumenSaldo = request.ExcluirDiasHabilesConsumenSaldo,
            Activo = request.Activo,
        };

        _context.IncidenciasChecadoConfig.Add(entity);
        await _context.SaveChangesAsync(ct);
        return MapToResponse(entity);
    }

    public async Task<IncidenciaChecadoConfigResponse?> UpdateAsync(int id, UpdateIncidenciaChecadoConfigRequest request, CancellationToken ct = default)
    {
        var entity = await _context.IncidenciasChecadoConfig.FindAsync(new object[] { id }, ct);
        if (entity is null)
            return null;

        entity.Nombre = request.Nombre.Trim();
        entity.NombreNormalizado = request.Nombre.Trim();
        entity.Descripcion = request.Descripcion.Trim();
        entity.DescripcionNormalizada = request.Descripcion.Trim();
        entity.TipoIncidencia = request.TipoIncidencia;
        entity.MinutosMin = request.MinutosMin;
        entity.MinutosMax = request.MinutosMax;
        entity.CantidadAcumulada = request.CantidadAcumulada;
        entity.Periodo = request.Periodo;
        entity.Prioridad = request.Prioridad;
        entity.RegistroEntrada = request.RegistroEntrada;
        entity.RegistroSalida = request.RegistroSalida;
        entity.ExcluirDiasHabilesConsumenSaldo = request.ExcluirDiasHabilesConsumenSaldo;
        entity.Activo = request.Activo;

        await _context.SaveChangesAsync(ct);
        return MapToResponse(entity);
    }

    private static IncidenciaChecadoConfigResponse MapToResponse(IncidenciaChecadoConfig r)
    {
        return new IncidenciaChecadoConfigResponse
        {
            IdConfig = r.IdConfig,
            Nombre = r.Nombre,
            Descripcion = r.Descripcion,
            TipoIncidencia = r.TipoIncidencia,
            MinutosMin = r.MinutosMin,
            MinutosMax = r.MinutosMax,
            CantidadAcumulada = r.CantidadAcumulada,
            Periodo = r.Periodo,
            Prioridad = r.Prioridad,
            RegistroEntrada = r.RegistroEntrada,
            RegistroSalida = r.RegistroSalida,
            ExcluirDiasHabilesConsumenSaldo = r.ExcluirDiasHabilesConsumenSaldo,
            Activo = r.Activo,
        };
    }
}
