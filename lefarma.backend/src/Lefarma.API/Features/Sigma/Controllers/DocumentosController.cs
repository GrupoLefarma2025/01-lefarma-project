using System.Data;
using System.Security.Claims;
using Lefarma.API.Features.Sigma.DTOs;
using Lefarma.API.Shared.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lefarma.API.Features.Sigma.Controllers;

[ApiController]
[Route("api/documentos")]
[Authorize]
[EndpointGroupName("Sigma")]
public sealed class DocumentosController : ControllerBase
{
    private readonly SigmaDb _db;
    private readonly ILogger<DocumentosController> _log;

    public DocumentosController(SigmaDb db, ILogger<DocumentosController> log)
    {
        _db = db;
        _log = log;
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(CancellationToken ct)
    {
        var (samAccountName, dominio, nameIdentifier, displayName) = LeerIdentidad();
        var canViewAll = User.TienePermiso(SigmaPermissions.Aprobar)
            || User.TienePermiso(SigmaPermissions.BandejaVerTodos);

        if (!canViewAll && string.IsNullOrWhiteSpace(samAccountName))
        {
            _log.LogWarning(
                "Usuario sin SamAccountName en el dashboard de documentos; se devuelve la vista global. NameIdentifier={NameIdentifier}",
                nameIdentifier);
            canViewAll = true;
        }

        var samAccountFilter = $"{samAccountName}@{dominio}";

        try
        {
            var estadisticas = await _db.QueryFirstOrDefaultAsync<DocumentosDashboardStatisticsRow>(
                "app.sp_DocumentosDashboardStatistics",
                new { SamAccountName = samAccountFilter, NameIdentifier = nameIdentifier },
                CommandType.StoredProcedure,
                ct);

            var usuarios = await _db.QueryAsync<DocumentosDashboardUserStatRow>(
                "app.sp_DocumentosDashboardUserStats",
                new
                {
                    SamAccountName = samAccountFilter,
                    IncludeAll = canViewAll ? 1 : 0,
                    NameIdentifier = nameIdentifier
                },
                CommandType.StoredProcedure,
                ct);

            var serie = await _db.QueryAsync<DocumentosDashboardSeriesRow>(
                "app.sp_DocumentosDashboardSeries",
                new { SamAccountName = samAccountFilter, DaysBack = 90, NameIdentifier = nameIdentifier },
                CommandType.StoredProcedure,
                ct);

            var data = new DocumentosDashboardDataDto
            {
                User = new DocumentosDashboardUserDto
                {
                    DisplayName = displayName,
                    SamAccountName = samAccountFilter,
                    CanViewAll = canViewAll
                },
                Statistics = new DocumentosDashboardStatisticsDto
                {
                    DocumentsPendingAuthorization = estadisticas?.DocumentsPendingAuthorization ?? 0,
                    DocumentsAuthorized = estadisticas?.DocumentsAuthorized ?? 0,
                    AverageDocumentsPerDay = estadisticas?.AverageDocumentsPerDay ?? 0m
                },
                UserStats = usuarios
                    .Select(u => new DocumentosDashboardUserStatDto
                    {
                        SamAccountName = u.SamAccountName,
                        UserName = u.UserName,
                        AuthorizedThisMonth = u.AuthorizedThisMonth,
                        PendingThisMonth = u.PendingThisMonth,
                        RejectedThisMonth = u.RejectedThisMonth
                    })
                    .ToList(),
                ActivitySeries = serie
                    .Select(s => new DocumentosDashboardSeriesPointDto
                    {
                        Date = s.Fecha.ToString("yyyy-MM-dd"),
                        Uploaded = s.Uploaded,
                        Authorized = s.Authorized,
                        Rejected = s.Rejected
                    })
                    .ToList()
            };

            return Ok(new { success = true, data });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "No fue posible obtener el dashboard de documentos");
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new { success = false, error = "No fue posible obtener el dashboard de documentos." });
        }
    }

    [HttpGet("bandeja/usuarios")]
    public async Task<IActionResult> BandejaUsuarios(CancellationToken ct)
    {
        var (samAccountName, dominio, nameIdentifier, _) = LeerIdentidad();
        var canViewAll = User.TienePermiso(SigmaPermissions.BandejaVerTodos)
            || User.TienePermiso(SigmaPermissions.Aprobar);

        if (!canViewAll && string.IsNullOrWhiteSpace(samAccountName))
        {
            canViewAll = true;
        }

        var samAccountFilter = $"{samAccountName}@{dominio}";

        try
        {
            var filas = await _db.QueryAsync<BandejaUsuariosRow>(
                "app.sp_DocumentosBandejaUsuarios",
                new
                {
                    SamAccountName = samAccountFilter,
                    IncludeAll = canViewAll,
                    NameIdentifier = nameIdentifier
                },
                CommandType.StoredProcedure,
                ct);

            var data = filas
                .Where(f => !string.IsNullOrWhiteSpace(f.SamAccountName))
                .Select(f => new BandejaUsuarioDto
                {
                    Value = $"{f.SamAccountName}@{f.Dominio}",
                    Label = $"{f.Dominio}\\{f.NombreCompleto}"
                })
                .OrderBy(x => x.Label, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return Ok(new { success = true, data });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "No fue posible obtener el catálogo de usuarios de la bandeja");
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new { success = false, error = "No fue posible obtener el catálogo de usuarios." });
        }
    }

    private (string SamAccountName, string Dominio, string? NameIdentifier, string DisplayName) LeerIdentidad()
    {
        var samAccountName = User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name ?? string.Empty;
        var dominio = User.FindFirst("domain")?.Value ?? string.Empty;
        var nameIdentifier = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var displayName = User.Identity?.Name ?? samAccountName;

        return (samAccountName, dominio, nameIdentifier, displayName);
    }
}
