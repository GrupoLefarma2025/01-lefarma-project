using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lefarma.API.Features.Rh.IncidenciasChecado;

[ApiController]
[Route("api/rh/incidencias-checado-config")]
[Authorize]
public class IncidenciasChecadoConfigController : ControllerBase
{
    private readonly IIncidenciaChecadoConfigAdminService _service;

    public IncidenciasChecadoConfigController(IIncidenciaChecadoConfigAdminService service)
    {
        _service = service;
    }

    [HttpGet]
    [HasPermission("incidencias_checado.crear")]
    public async Task<ActionResult<ApiResponse<List<IncidenciaChecadoConfigResponse>>>> GetAll(CancellationToken ct)
    {
        var items = await _service.GetAllAsync(ct);
        return Ok(new ApiResponse<List<IncidenciaChecadoConfigResponse>>
        {
            Success = true,
            Data = items,
        });
    }

    [HttpGet("{id:int}")]
    [HasPermission("incidencias_checado.crear")]
    public async Task<ActionResult<ApiResponse<IncidenciaChecadoConfigResponse>>> GetById(int id, CancellationToken ct)
    {
        var item = await _service.GetByIdAsync(id, ct);
        if (item is null)
        {
            return NotFound(new ApiResponse<IncidenciaChecadoConfigResponse>
            {
                Success = false,
                Message = "Registro no encontrado.",
            });
        }

        return Ok(new ApiResponse<IncidenciaChecadoConfigResponse>
        {
            Success = true,
            Data = item,
        });
    }

    [HttpPost]
    [HasPermission("incidencias_checado.crear")]
    public async Task<ActionResult<ApiResponse<IncidenciaChecadoConfigResponse>>> Create(
        [FromBody] CreateIncidenciaChecadoConfigRequest request,
        CancellationToken ct)
    {
        var item = await _service.CreateAsync(request, ct);
        return Ok(new ApiResponse<IncidenciaChecadoConfigResponse>
        {
            Success = true,
            Message = "Registro creado correctamente.",
            Data = item,
        });
    }

    [HttpPut("{id:int}")]
    [HasPermission("incidencias_checado.crear")]
    public async Task<ActionResult<ApiResponse<IncidenciaChecadoConfigResponse>>> Update(
        int id,
        [FromBody] UpdateIncidenciaChecadoConfigRequest request,
        CancellationToken ct)
    {
        if (id != request.IdConfig)
        {
            return BadRequest(new ApiResponse<IncidenciaChecadoConfigResponse>
            {
                Success = false,
                Message = "El id no coincide con el cuerpo de la petición.",
            });
        }

        var item = await _service.UpdateAsync(id, request, ct);
        if (item is null)
        {
            return NotFound(new ApiResponse<IncidenciaChecadoConfigResponse>
            {
                Success = false,
                Message = "Registro no encontrado.",
            });
        }

        return Ok(new ApiResponse<IncidenciaChecadoConfigResponse>
        {
            Success = true,
            Message = "Registro actualizado correctamente.",
            Data = item,
        });
    }
}
