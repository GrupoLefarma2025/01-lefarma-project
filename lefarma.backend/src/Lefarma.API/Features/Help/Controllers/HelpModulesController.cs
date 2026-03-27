using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Lefarma.API.Features.Help.DTOs;
using Lefarma.API.Features.Help.Services;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Help.Controllers;

[ApiController]
[Route("api/help/modules")]
[Authorize]
public class HelpModulesController : ControllerBase
{
    private readonly IHelpModuleService _service;

    public HelpModulesController(IHelpModuleService service)
    {
        _service = service ?? throw new ArgumentNullException(nameof(service));
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener todos los módulos de ayuda")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<HelpModuleDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await _service.GetAllAsync(ct);
        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<HelpModuleDto>>
        {
            Success = true,
            Message = "Módulos de ayuda obtenidos exitosamente.",
            Data = data
        }));
    }

    [HttpGet("{id:int}")]
    [SwaggerOperation(Summary = "Obtener módulo por ID")]
    [ProducesResponseType(typeof(ApiResponse<HelpModuleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var result = await _service.GetByIdAsync(id, ct);
        return result.ToActionResult(this, data => Ok(new ApiResponse<HelpModuleDto>
        {
            Success = true,
            Message = "Módulo de ayuda obtenido exitosamente.",
            Data = data
        }));
    }

    [HttpPost]
    [SwaggerOperation(Summary = "Crear módulo de ayuda")]
    [ProducesResponseType(typeof(ApiResponse<HelpModuleDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromBody] CreateHelpModuleRequest request,
        CancellationToken ct)
    {
        var result = await _service.CreateAsync(request, ct);
        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetById),
            new { id = data.Id },
            new ApiResponse<HelpModuleDto>
            {
                Success = true,
                Message = "Módulo de ayuda creado exitosamente.",
                Data = data
            }));
    }

    [HttpPut("{id:int}")]
    [SwaggerOperation(Summary = "Actualizar módulo de ayuda")]
    [ProducesResponseType(typeof(ApiResponse<HelpModuleDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] UpdateHelpModuleRequest request,
        CancellationToken ct)
    {
        if (id != request.Id)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "El ID del módulo no coincide con el ID de la ruta."
            });
        }

        var result = await _service.UpdateAsync(request, ct);
        return result.ToActionResult(this, data => Ok(new ApiResponse<HelpModuleDto>
        {
            Success = true,
            Message = "Módulo de ayuda actualizado exitosamente.",
            Data = data
        }));
    }

    [HttpDelete("{id:int}")]
    [SwaggerOperation(Summary = "Eliminar módulo de ayuda (cascade - elimina artículos asociados)")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var result = await _service.DeleteAsync(id, ct);
        return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Módulo de ayuda eliminado exitosamente junto con sus artículos.",
            Data = null
        }));
    }

    [HttpPost("migrate-articles")]
    [SwaggerOperation(
        Summary = "Migrar artículos para módulos existentes",
        Description = "Crea artículos 'usuario' y 'desarrollador' para módulos que no los tengan")]
    [ProducesResponseType(typeof(ApiResponse<MigrateArticlesResult>), StatusCodes.Status200OK)]
    public async Task<IActionResult> MigrateArticles(CancellationToken ct)
    {
        var result = await _service.MigrateExistingModulesAsync(ct);
        return result.ToActionResult(this, data => Ok(new ApiResponse<MigrateArticlesResult>
        {
            Success = true,
            Message = $"Migración completada. {data.ModulesProcessed} módulos procesados, {data.ArticlesCreated} artículos creados.",
            Data = data
        }));
    }
}
