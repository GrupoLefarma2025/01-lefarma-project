using Lefarma.API.Domain.Entities.Asistencias;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Rh;

public class EmpleadoRepository : IEmpleadoRepository
{
    private readonly AsokamDbContext _asokamContext;
    private readonly AsistenciasDbContext _asistenciasContext;
    private readonly ApplicationDbContext _appContext;

    public EmpleadoRepository(
        AsokamDbContext asokamContext,
        AsistenciasDbContext asistenciasContext,
        ApplicationDbContext appContext)
    {
        _asokamContext = asokamContext;
        _asistenciasContext = asistenciasContext;
        _appContext = appContext;
    }

    public async Task<long?> ResolverNominaPorUsuarioAsync(
        int idUsuario,
        CancellationToken cancellationToken = default)
    {
        // 1) Resolución directa por numero_empleado (Lefarma)
        var numeroEmpleado = await _appContext.UsuariosDetalle
            .AsNoTracking()
            .Where(d => d.IdUsuario == idUsuario && d.Activo)
            .Select(d => d.NumeroEmpleado)
            .FirstOrDefaultAsync(cancellationToken);

        if (TryParseNomina(numeroEmpleado, out var nomina))
            return nomina;

        // 2) Fallback: resolución por correo (flujo original)
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

    public async Task<Dictionary<int, long>> ResolverNominasPorUsuariosAsync(
        IEnumerable<int> idsUsuarios,
        CancellationToken cancellationToken = default)
    {
        var idList = idsUsuarios.Distinct().ToList();
        if (idList.Count == 0)
            return new Dictionary<int, long>();

        var usuarios = await _asokamContext.Usuarios
            .AsNoTracking()
            .Where(u => idList.Contains(u.IdUsuario) && u.Correo != null)
            .Select(u => new { u.IdUsuario, u.Correo })
            .ToListAsync(cancellationToken);

        var correos = usuarios
            .Select(u => u.Correo)
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct()
            .ToList();

        if (correos.Count == 0)
            return new Dictionary<int, long>();

        var empleados = await _asistenciasContext.VwEmpleados
            .AsNoTracking()
            .Where(e => e.Nomina.HasValue && e.Correo != null && correos.Contains(e.Correo))
            .Select(e => new { e.Nomina, e.Correo })
            .ToListAsync(cancellationToken);

        var nominaPorCorreo = empleados
            .GroupBy(e => e.Correo!)
            .ToDictionary(g => g.Key, g => g.First().Nomina!.Value);

        return usuarios
            .Where(u => !string.IsNullOrWhiteSpace(u.Correo) && nominaPorCorreo.ContainsKey(u.Correo))
            .GroupBy(u => u.IdUsuario)
            .ToDictionary(g => g.Key, g => nominaPorCorreo[g.First().Correo!]);
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

        // 1) Resolución directa por numero_empleado (Lefarma)
        var resultado = await ResolverPorNumeroEmpleadoAsync(nominaList, cancellationToken);

        // 2) Fallback por correo solo para las nóminas no resueltas
        var faltantes = nominaList.Except(resultado.Keys).ToList();
        if (faltantes.Count > 0)
        {
            var porCorreo = await ResolverPorCorreoAsync(faltantes, cancellationToken);
            foreach (var kvp in porCorreo)
                resultado.TryAdd(kvp.Key, kvp.Value);
        }

        return resultado;
    }

    public async Task<List<int>> ResolverIdsUsuarioPorFiltroEmpleadoAsync(
        string? nombre,
        string? empresa,
        string? departamento,
        string? puesto,
        CancellationToken cancellationToken = default)
    {
        var query = _asistenciasContext.VwEmpleados.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(nombre))
        {
            var term = nombre.Trim().ToLowerInvariant();
            query = query.Where(e =>
                (e.Nombre != null && e.Nombre.ToLower().Contains(term)) ||
                (e.Apellidos != null && e.Apellidos.ToLower().Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(empresa))
        {
            var term = empresa.Trim().ToLowerInvariant();
            query = query.Where(e => e.Empresa != null && e.Empresa.ToLower().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(departamento))
        {
            var term = departamento.Trim().ToLowerInvariant();
            query = query.Where(e => e.Departamento != null && e.Departamento.ToLower().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(puesto))
        {
            var term = puesto.Trim().ToLowerInvariant();
            query = query.Where(e => e.Puesto != null && e.Puesto.ToLower().Contains(term));
        }

        var empleados = await query
            .Select(e => new { e.Nomina, e.Correo })
            .ToListAsync(cancellationToken);

        var ids = new HashSet<int>();

        // 1) Los que tienen nómina se resuelven por numero_empleado (con su propio fallback)
        var nominas = empleados
            .Where(e => e.Nomina.HasValue)
            .Select(e => e.Nomina!.Value)
            .Distinct()
            .ToList();

        if (nominas.Count > 0)
        {
            var resueltos = await ResolverIdsUsuarioPorNominasAsync(nominas, cancellationToken);
            ids.UnionWith(resueltos.Values);
        }

        // 2) Empleados sin nómina solo se pueden resolver por correo
        var correosSinNomina = empleados
            .Where(e => !e.Nomina.HasValue && !string.IsNullOrWhiteSpace(e.Correo))
            .Select(e => e.Correo!)
            .Distinct()
            .ToList();

        if (correosSinNomina.Count > 0)
        {
            var idsPorCorreo = await _asokamContext.Usuarios
                .AsNoTracking()
                .Where(u => u.Correo != null && correosSinNomina.Contains(u.Correo))
                .Select(u => u.IdUsuario)
                .ToListAsync(cancellationToken);
            ids.UnionWith(idsPorCorreo);
        }

        return ids.ToList();
    }


    public async Task<VwEmpleado?> ObtenerEmpleadoPorUsuarioAsync(
        int idUsuario,
        CancellationToken cancellationToken = default)
    {
        // 1) Resolución directa por numero_empleado (Lefarma)
        var numeroEmpleado = await _appContext.UsuariosDetalle
            .AsNoTracking()
            .Where(d => d.IdUsuario == idUsuario && d.Activo)
            .Select(d => d.NumeroEmpleado)
            .FirstOrDefaultAsync(cancellationToken);

        if (TryParseNomina(numeroEmpleado, out var nomina))
        {
            var empleado = await _asistenciasContext.VwEmpleados
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.Nomina == nomina, cancellationToken);

            if (empleado != null)
                return empleado;
        }

        // 2) Fallback: resolución por correo (flujo original)
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

    private async Task<Dictionary<long, int>> ResolverPorNumeroEmpleadoAsync(
        List<long> nominas,
        CancellationToken cancellationToken)
    {
        var detalles = await _appContext.UsuariosDetalle
            .AsNoTracking()
            .Where(d => d.Activo && d.NumeroEmpleado != null && d.NumeroEmpleado != "")
            .Select(d => new { d.IdUsuario, d.NumeroEmpleado })
            .ToListAsync(cancellationToken);

        var nominaSet = nominas.ToHashSet();
        var resultado = new Dictionary<long, int>();

        foreach (var d in detalles)
        {
            if (TryParseNomina(d.NumeroEmpleado, out var nomina) && nominaSet.Contains(nomina))
                resultado.TryAdd(nomina, d.IdUsuario);
        }

        return resultado;
    }

    private async Task<Dictionary<long, int>> ResolverPorCorreoAsync(
        List<long> nominas,
        CancellationToken cancellationToken)
    {
        var empleados = await _asistenciasContext.VwEmpleados
            .AsNoTracking()
            .Where(e => e.Nomina.HasValue && nominas.Contains(e.Nomina.Value))
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

    private static bool TryParseNomina(string? numeroEmpleado, out long nomina)
    {
        nomina = 0;
        if (string.IsNullOrWhiteSpace(numeroEmpleado))
            return false;

        return long.TryParse(numeroEmpleado.Trim(), out nomina);
    }
}
