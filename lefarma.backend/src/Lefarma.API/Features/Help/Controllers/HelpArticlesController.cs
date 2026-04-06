using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Lefarma.API.Features.Help.DTOs;
using Lefarma.API.Features.Help.Services;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Help.Controllers;
/// <summary>
/// Controlador API para gestionar artículos de ayuda
/// </summary>
[ApiController]
[Route("api/help/articles")]
[Authorize]
public class HelpArticlesController : ControllerBase
{
    private readonly IHelpArticleService _helpArticleService;

    public HelpArticlesController(IHelpArticleService helpArticleService)
    {
        _helpArticleService = helpArticleService ?? throw new ArgumentNullException(nameof(helpArticleService));
    }

    /// <summary>
    /// Obtiene todos los artículos de ayuda
    /// </summary>
    /// <param name="ct">Token de cancelación</param>
    /// <returns>Lista de artículos de ayuda</returns>
    [HttpGet]
    [SwaggerOperation(Summary = "Obtener todos los artículos de ayuda", Description = "Retorna la lista completa de artículos de ayuda")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<HelpArticleDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await _helpArticleService.GetAllAsync(ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<HelpArticleDto>>
        {
            Success = true,
            Message = "Artículos de ayuda obtenidos exitosamente.",
            Data = data
        }));
    }

    /// <summary>
    /// Obtiene un artículo de ayuda por su ID
    /// </summary>
    /// <param name="id">ID del artículo</param>
    /// <param name="ct">Token de cancelación</param>
    /// <returns>Artículo de ayuda solicitado</returns>
    [HttpGet("{id:int}")]
    [SwaggerOperation(Summary = "Obtener artículo por ID", Description = "Retorna un artículo de ayuda específico por su identificador")]
    [ProducesResponseType(typeof(ApiResponse<HelpArticleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetById(
        [FromRoute][SwaggerParameter(Description = "Identificador único del artículo de ayuda", Required = true)] int id,
        CancellationToken ct)
    {
        var result = await _helpArticleService.GetByIdAsync(id, ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<HelpArticleDto>
        {
            Success = true,
            Message = "Artículo de ayuda obtenido exitosamente.",
            Data = data
        }));
    }

    /// <summary>
    /// Obtiene artículos de ayuda por módulo
    /// </summary>
    /// <param name="modulo">Nombre del módulo</param>
    /// <param name="ct">Token de cancelación</param>
    /// <returns>Lista de artículos del módulo</returns>
    [HttpGet("by-module/{modulo}")]
    [SwaggerOperation(Summary = "Obtener artículos por módulo", Description = "Retorna todos los artículos de ayuda de un módulo específico")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<HelpArticleDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetByModule(
        [FromRoute][SwaggerParameter(Description = "Nombre del módulo (ej: Catalogos, Auth, Notificaciones)", Required = true)] string modulo,
        CancellationToken ct)
    {
        var result = await _helpArticleService.GetByModuleAsync(modulo, ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<HelpArticleDto>>
        {
            Success = true,
            Message = $"Artículos de ayuda del módulo {modulo} obtenidos exitosamente.",
            Data = data
        }));
    }

    /// <summary>
    /// Obtiene artículos de ayuda por tipo
    /// </summary>
    /// <param name="tipo">Tipo de artículo (usuario, desarrollador, ambos)</param>
    /// <param name="ct">Token de cancelación</param>
    /// <returns>Lista de artículos del tipo</returns>
    [HttpGet("by-type/{tipo}")]
    [SwaggerOperation(Summary = "Obtener artículos por tipo", Description = "Retorna todos los artículos de ayuda de un tipo específico")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<HelpArticleDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetByType(
        [FromRoute][SwaggerParameter(Description = "Tipo de artículo (usuario, desarrollador, ambos)", Required = true)] string tipo,
        CancellationToken ct)
    {
        var result = await _helpArticleService.GetByTypeAsync(tipo, ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<HelpArticleDto>>
        {
            Success = true,
            Message = $"Artículos de ayuda tipo {tipo} obtenidos exitosamente.",
            Data = data
        }));
    }

    /// <summary>
    /// Obtiene artículos de ayuda para usuarios (tipo 'usuario' o 'ambos')
    /// </summary>
    /// <param name="modulo">Nombre del módulo (opcional)</param>
    /// <param name="ct">Token de cancelación</param>
    /// <returns>Lista de artículos de ayuda para usuarios</returns>
    [HttpGet("for-user")]
    [SwaggerOperation(Summary = "Obtener artículos para usuario", Description = "Retorna artículos de ayuda con tipo 'usuario' o 'ambos', opcionalmente filtrados por módulo")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<HelpArticleDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetForUser(
        [FromQuery][SwaggerParameter(Description = "Nombre del módulo para filtrar (ej: Catalogos, Auth, Notificaciones)")] string? modulo,
        CancellationToken ct)
    {
        var result = await _helpArticleService.GetForUserAsync(modulo, ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<HelpArticleDto>>
        {
            Success = true,
            Message = modulo != null
                ? $"Artículos de ayuda para usuario del módulo {modulo} obtenidos exitosamente."
                : "Artículos de ayuda para usuario obtenidos exitosamente.",
            Data = data
        }));
    }

    /// <summary>
    /// Crea un nuevo artículo de ayuda
    /// </summary>
    /// <param name="request">Datos del artículo a crear</param>
    /// <param name="ct">Token de cancelación</param>
    /// <returns>Artículo creado</returns>
    [HttpPost]
    [SwaggerOperation(Summary = "Crear artículo de ayuda", Description = "Crea un nuevo artículo de ayuda con los datos proporcionados")]
    [ProducesResponseType(typeof(ApiResponse<HelpArticleDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Create(
        [FromBody][SwaggerRequestBody(Description = "Datos del artículo de ayuda a crear", Required = true)] CreateHelpArticleRequest request,
        CancellationToken ct)
    {
        var username = User.Identity?.Name ?? "unknown";
        var result = await _helpArticleService.CreateAsync(request, username, ct);

        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetById),
            new { id = data.Id },
            new ApiResponse<HelpArticleDto>
            {
                Success = true,
                Message = "Artículo de ayuda creado exitosamente.",
                Data = data
            }));
    }

    /// <summary>
    /// Actualiza un artículo de ayuda existente
    /// </summary>
    /// <param name="id">ID del artículo a actualizar</param>
    /// <param name="request">Datos actualizados del artículo</param>
    /// <param name="ct">Token de cancelación</param>
    /// <returns>Artículo actualizado</returns>
    [HttpPut("{id:int}")]
    [SwaggerOperation(Summary = "Actualizar artículo de ayuda", Description = "Actualiza los datos de un artículo de ayuda existente")]
    [ProducesResponseType(typeof(ApiResponse<HelpArticleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Update(
        [FromRoute][SwaggerParameter(Description = "Identificador del artículo a actualizar", Required = true)] int id,
        [FromBody][SwaggerRequestBody(Description = "Datos actualizados del artículo de ayuda", Required = true)] UpdateHelpArticleRequest request,
        CancellationToken ct)
    {
        if (id != request.Id)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "El ID del artículo no coincide con el ID de la ruta.",
                Data = null
            });
        }

        var username = User.Identity?.Name ?? "unknown";
        var result = await _helpArticleService.UpdateAsync(request, username, ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<HelpArticleDto>
        {
            Success = true,
            Message = "Artículo de ayuda actualizado exitosamente.",
            Data = data
        }));
    }

    /// <summary>
    /// Elimina un artículo de ayuda
    /// </summary>
    /// <param name="id">ID del artículo a eliminar</param>
    /// <param name="ct">Token de cancelación</param>
    /// <returns>Confirmación de eliminación</returns>
    [HttpDelete("{id:int}")]
    [SwaggerOperation(Summary = "Eliminar artículo de ayuda", Description = "Elimina un artículo de ayuda por su identificador")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Delete(
        [FromRoute][SwaggerParameter(Description = "Identificador del artículo a eliminar", Required = true)] int id,
        CancellationToken ct)
    {
        var result = await _helpArticleService.DeleteAsync(id, ct);

        return result.ToActionResult(this, success => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Artículo de ayuda eliminado exitosamente.",
            Data = null
        }));
    }
}
