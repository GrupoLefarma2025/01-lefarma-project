using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Services.Identity;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.EducacionMedica;

/// <summary>
/// Bitácora de ajustes post-cierre (ADR-00010): consulta por entidad con el permiso de
/// ver del módulo correspondiente (rutas.puede_ver / talleres.puede_ver).
/// </summary>
public class AjustePostCierreService : IAjustePostCierreService
{
    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly UserPermissionService _permissionService;

    public AjustePostCierreService(
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        UserPermissionService permissionService)
    {
        _context = context;
        _asokamContext = asokamContext;
        _permissionService = permissionService;
    }

    public async Task<List<AjustePostCierreDto>> ListarAsync(
        string entidadTipo,
        int idEntidad,
        int idUsuario,
        CancellationToken ct = default)
    {
        var tipo = entidadTipo.Trim().ToUpperInvariant();
        if (tipo is not (AjustePostCierre.EntidadRutaVisita or AjustePostCierre.EntidadRutaVersion or AjustePostCierre.EntidadTaller))
        {
            throw new InvalidOperationException(
                $"entidadTipo desconocido: '{entidadTipo}'. Use {AjustePostCierre.EntidadRutaVisita}, {AjustePostCierre.EntidadRutaVersion} o {AjustePostCierre.EntidadTaller}.");
        }

        var permisos = await _permissionService.GetPermissionsAsync(idUsuario);
        var permisoRequerido = tipo == AjustePostCierre.EntidadTaller
            ? Permissions.EducacionMedica.TalleresVer
            : Permissions.EducacionMedica.RutasVer;
        if (!permisos.Contains(permisoRequerido))
        {
            throw new InvalidOperationException(
                $"No tienes permiso para consultar los ajustes de esta entidad ({permisoRequerido}).");
        }

        var ajustes = await _context.AjustesPostCierre.AsNoTracking()
            .Where(a => a.EntidadTipo == tipo && a.IdEntidad == idEntidad)
            .OrderByDescending(a => a.FechaAjuste)
            .ThenByDescending(a => a.IdAjuste)
            .ToListAsync(ct);

        if (ajustes.Count == 0)
        {
            return [];
        }

        var idsUsuarios = ajustes.Select(a => a.IdUsuario).Distinct().ToList();
        var nombres = await _asokamContext.Usuarios.AsNoTracking()
            .Where(u => idsUsuarios.Contains(u.IdUsuario))
            .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? string.Empty, ct);

        return ajustes
            .Select(a => new AjustePostCierreDto
            {
                IdAjuste = a.IdAjuste,
                EntidadTipo = a.EntidadTipo,
                IdEntidad = a.IdEntidad,
                Accion = a.Accion,
                ValoresAntes = a.ValoresAntes,
                ValoresDespues = a.ValoresDespues,
                Motivo = a.Motivo,
                IdUsuario = a.IdUsuario,
                NombreUsuario = nombres.GetValueOrDefault(a.IdUsuario),
                FechaAjuste = a.FechaAjuste,
            })
            .ToList();
    }
}
