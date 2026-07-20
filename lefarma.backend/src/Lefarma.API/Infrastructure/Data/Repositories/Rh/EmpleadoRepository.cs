using Lefarma.API.Domain.Entities.Asistencias;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Rh;

public class EmpleadoRepository : IEmpleadoRepository
{
    private readonly AsokamDbContext _asokamContext;
    private readonly AsistenciasDbContext _asistenciasContext;

    public EmpleadoRepository(
        AsokamDbContext asokamContext,
        AsistenciasDbContext asistenciasContext)
    {
        _asokamContext = asokamContext;
        _asistenciasContext = asistenciasContext;
    }

    public async Task<long?> ResolverNominaPorUsuarioAsync(
        int idUsuario,
        CancellationToken cancellationToken = default)
    {
        var correo = await _asokamContext.Usuarios
            .Where(u => u.IdUsuario == idUsuario)
            .Select(u => u.Correo)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(correo))
            return null;

        return await _asistenciasContext.VwEmpleados
            .Where(e => e.Correo == correo)
            .Select(e => (long?)e.Nomina)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<int?> ResolverIdUsuarioPorNominaAsync(
        long nomina,
        CancellationToken cancellationToken = default)
    {
        var resultado = await ResolverIdsUsuarioPorNominasAsync(
            new[] { nomina },
            cancellationToken);

        return resultado.TryGetValue(nomina, out var idUsuario)
            ? idUsuario
            : null;
    }

    public async Task<Dictionary<long, int>> ResolverIdsUsuarioPorNominasAsync(
        IEnumerable<long> nominas,
        CancellationToken cancellationToken = default)
    {
        var nominaList = nominas.Distinct().ToList();
        if (nominaList.Count == 0)
            return new Dictionary<long, int>();

        var empleados = await _asistenciasContext.VwEmpleados
            .AsNoTracking()
            .Where(e => e.Nomina.HasValue && nominaList.Contains(e.Nomina.Value))
            .Select(e => new { e.Nomina, e.Correo })
            .ToListAsync(cancellationToken);

        var correos = empleados
            .Select(e => e.Correo)
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct()
            .ToList();

        if (correos.Count == 0)
            return new Dictionary<long, int>();

        var usuarios = await _asokamContext.Usuarios
            .AsNoTracking()
            .Where(u => u.Correo != null && correos.Contains(u.Correo))
            .Select(u => new { u.IdUsuario, u.Correo })
            .ToListAsync(cancellationToken);

        var usuarioPorCorreo = usuarios
            .GroupBy(u => u.Correo)
            .ToDictionary(g => g.Key!, g => g.First().IdUsuario);

        return empleados
            .Where(e => e.Nomina.HasValue
                        && !string.IsNullOrWhiteSpace(e.Correo)
                        && usuarioPorCorreo.ContainsKey(e.Correo))
            .GroupBy(e => e.Nomina!.Value)
            .ToDictionary(
                g => g.Key,
                g => usuarioPorCorreo[g.First().Correo!]);
    }

    public async Task<VwEmpleado?> ObtenerEmpleadoPorUsuarioAsync(
        int idUsuario,
        CancellationToken cancellationToken = default)
    {
        var correo = await _asokamContext.Usuarios
            .Where(u => u.IdUsuario == idUsuario)
            .Select(u => u.Correo)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(correo))
            return null;

        return await _asistenciasContext.VwEmpleados
            .AsNoTracking()
            .Where(e => e.Correo == correo)
            .FirstOrDefaultAsync(cancellationToken);
    }
}
