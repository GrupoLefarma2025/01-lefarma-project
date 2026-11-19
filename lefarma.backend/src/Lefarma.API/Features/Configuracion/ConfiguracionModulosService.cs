using System.Text.RegularExpressions;
using ErrorOr;
using Lefarma.API.Domain.Entities.Configuracion;
using Lefarma.API.Features.Configuracion.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Configuracion;

/// <summary>
/// Catálogo de módulos de configuración. La clave del módulo es un slug
/// inmutable que sirve de prefijo a las claves de sus variables.
/// </summary>
public sealed partial class ConfiguracionModulosService : IConfiguracionModulosService
{
    /// <summary>Módulo por omisión: no puede desactivarse.</summary>
    private const string ClaveGlobal = "global";

    private readonly ApplicationDbContext _context;

    public ConfiguracionModulosService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ErrorOr<List<ConfigModuloResponse>>> ListarAsync(
        bool? activo,
        CancellationToken ct = default)
    {
        var query = _context.ConfigModulos.AsNoTracking();

        if (activo.HasValue)
        {
            query = query.Where(m => m.Activo == activo.Value);
        }

        var modulos = await query
            .OrderBy(m => m.Nombre)
            .ThenBy(m => m.IdModulo)
            .ToListAsync(ct);

        var conteos = await _context.ConfigVariables
            .AsNoTracking()
            .Where(v => v.IdModulo.HasValue)
            .GroupBy(v => v.IdModulo!.Value)
            .Select(g => new { IdModulo = g.Key, Total = g.Count() })
            .ToDictionaryAsync(x => x.IdModulo, x => x.Total, ct);

        return modulos
            .Select(modulo => Mapear(modulo, conteos.GetValueOrDefault(modulo.IdModulo)))
            .ToList();
    }

    public async Task<ErrorOr<ConfigModuloResponse>> CrearAsync(
        CreateConfigModuloRequest request,
        int? idUsuario,
        CancellationToken ct = default)
    {
        var clave = (request.Clave ?? string.Empty).Trim().ToLowerInvariant();
        var nombre = (request.Nombre ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(clave))
        {
            return CommonErrors.Validation("clave", "La clave del módulo es obligatoria.");
        }

        if (clave.Length > 50)
        {
            return CommonErrors.Validation("clave", "La clave del módulo no puede exceder 50 caracteres.");
        }

        if (!ClaveModuloRegex().IsMatch(clave))
        {
            return CommonErrors.Validation(
                "clave",
                "La clave del módulo solo admite minúsculas, números y guion bajo, y debe iniciar con letra (ej. viaticos).");
        }

        if (string.IsNullOrWhiteSpace(nombre))
        {
            return CommonErrors.Validation("nombre", "El nombre del módulo es obligatorio.");
        }

        if (nombre.Length > 200)
        {
            return CommonErrors.Validation("nombre", "El nombre del módulo no puede exceder 200 caracteres.");
        }

        if (request.Descripcion is { Length: > 1000 })
        {
            return CommonErrors.Validation("descripcion", "La descripción no puede exceder 1000 caracteres.");
        }

        if (await _context.ConfigModulos.AnyAsync(m => m.Clave == clave, ct))
        {
            return CommonErrors.AlreadyExists("ConfigModulo", "clave", clave);
        }

        var ahora = DateTime.UtcNow;
        var entidad = new ConfigModulo
        {
            Clave = clave,
            Nombre = nombre,
            Descripcion = string.IsNullOrWhiteSpace(request.Descripcion) ? null : request.Descripcion.Trim(),
            Activo = true,
            FechaCreacion = ahora,
            FechaModificacion = ahora,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario
        };

        _context.ConfigModulos.Add(entidad);

        try
        {
            await _context.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return CommonErrors.AlreadyExists("ConfigModulo", "clave", clave);
        }

        return Mapear(entidad, 0);
    }

    public async Task<ErrorOr<ConfigModuloResponse>> ActualizarAsync(
        long id,
        UpdateConfigModuloRequest request,
        int? idUsuario,
        CancellationToken ct = default)
    {
        var entidad = await _context.ConfigModulos.FirstOrDefaultAsync(m => m.IdModulo == id, ct);
        if (entidad is null)
        {
            return CommonErrors.NotFound("ConfigModulo", id.ToString());
        }

        var nombre = (request.Nombre ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(nombre))
        {
            return CommonErrors.Validation("nombre", "El nombre del módulo es obligatorio.");
        }

        if (nombre.Length > 200)
        {
            return CommonErrors.Validation("nombre", "El nombre del módulo no puede exceder 200 caracteres.");
        }

        if (request.Descripcion is { Length: > 1000 })
        {
            return CommonErrors.Validation("descripcion", "La descripción no puede exceder 1000 caracteres.");
        }

        entidad.Nombre = nombre;
        entidad.Descripcion = string.IsNullOrWhiteSpace(request.Descripcion)
            ? null
            : request.Descripcion.Trim();
        entidad.FechaModificacion = DateTime.UtcNow;
        entidad.IdUsuarioModificacion = idUsuario;

        await _context.SaveChangesAsync(ct);

        var total = await _context.ConfigVariables
            .AsNoTracking()
            .CountAsync(v => v.IdModulo == entidad.IdModulo, ct);

        return Mapear(entidad, total);
    }

    public Task<ErrorOr<ConfigModuloResponse>> DesactivarAsync(
        long id,
        int? idUsuario,
        CancellationToken ct = default)
        => CambiarEstadoAsync(id, activo: false, idUsuario, ct);

    public Task<ErrorOr<ConfigModuloResponse>> ReactivarAsync(
        long id,
        int? idUsuario,
        CancellationToken ct = default)
        => CambiarEstadoAsync(id, activo: true, idUsuario, ct);

    private async Task<ErrorOr<ConfigModuloResponse>> CambiarEstadoAsync(
        long id,
        bool activo,
        int? idUsuario,
        CancellationToken ct)
    {
        var entidad = await _context.ConfigModulos.FirstOrDefaultAsync(m => m.IdModulo == id, ct);
        if (entidad is null)
        {
            return CommonErrors.NotFound("ConfigModulo", id.ToString());
        }

        if (!activo && string.Equals(entidad.Clave, ClaveGlobal, StringComparison.OrdinalIgnoreCase))
        {
            return CommonErrors.Validation(
                "idModulo",
                "El módulo global no puede desactivarse: es el destino por omisión de las variables.");
        }

        entidad.Activo = activo;
        entidad.FechaModificacion = DateTime.UtcNow;
        entidad.IdUsuarioModificacion = idUsuario;

        await _context.SaveChangesAsync(ct);

        var total = await _context.ConfigVariables
            .AsNoTracking()
            .CountAsync(v => v.IdModulo == entidad.IdModulo, ct);

        return Mapear(entidad, total);
    }

    private static ConfigModuloResponse Mapear(ConfigModulo modulo, int totalVariables)
        => new()
        {
            IdModulo = modulo.IdModulo,
            Clave = modulo.Clave,
            Nombre = modulo.Nombre,
            Descripcion = modulo.Descripcion,
            Activo = modulo.Activo,
            TotalVariables = totalVariables,
            FechaCreacion = modulo.FechaCreacion,
            FechaModificacion = modulo.FechaModificacion
        };

    [GeneratedRegex("^[a-z][a-z0-9_]*$", RegexOptions.CultureInvariant)]
    private static partial Regex ClaveModuloRegex();
}
