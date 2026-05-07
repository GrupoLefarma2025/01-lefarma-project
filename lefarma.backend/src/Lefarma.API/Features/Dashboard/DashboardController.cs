using Lefarma.API.Features.Dashboard.DTOs;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Dashboard;

[Route("api/[controller]")]
[ApiController]
[Authorize]
[EndpointGroupName("Dashboard")]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("stats")]
    [SwaggerOperation(Summary = "Obtener estadisticas del dashboard", Description = "Retorna KPIs, graficas y actividad reciente para el panel principal de CxP")]
    public async Task<IActionResult> GetStats()
    {
        var result = await _dashboardService.GetStatsAsync();

        return result.ToActionResult(this, data => Ok(new ApiResponse<DashboardStatsResponse>
        {
            Success = true,
            Message = "Estadisticas obtenidas exitosamente.",
            Data = data
        }));
    }
}
