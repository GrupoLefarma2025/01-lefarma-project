using ErrorOr;
using Lefarma.API.Features.Archivos.DTOs;
using Lefarma.API.Features.Archivos.Services;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Archivos.Controllers;

/// <summary>
/// Controlador API para gestión de archivos.
/// </summary>
[ApiController]
[Route("api/archivos")]
[EndpointGroupName("Archivos")]
public class ArchivosController : ControllerBase
{
    private readonly IArchivoService _service;

    public ArchivosController(IArchivoService service)
    {
        _service = service;
    }

    /// <summary>
    /// Sube un nuevo archivo al sistema.
    /// </summary>
    /// <param name="request">Datos del archivo a subir.</param>
    /// <param name="file">Archivo a subir.</param>
    /// <returns>Información del archivo subido.</returns>
    [HttpPost("upload")]
    [RequestSizeLimit(50_000_000)] // 50MB
    [SwaggerOperation(Summary = "Subir archivo", Description = "Sube un nuevo archivo al sistema. Tamaño máximo: 50 MB.")]
    [ProducesResponseType(typeof(ApiResponse<ArchivoResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Upload(
        [FromForm] SubirArchivoRequest request,
        IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "No se proporcionó ningún archivo",
                Data = null
            });

        using var stream = file.OpenReadStream();
        var result = await _service.SubirAsync(stream, file.FileName, file.ContentType, request);

        return result.ToActionResult(this, archivo => Ok(new ApiResponse<ArchivoResponse>
        {
            Success = true,
            Message = "Archivo subido exitosamente",
            Data = archivo
        }));
    }

    /// <summary>
    /// Reemplaza el contenido de un archivo existente.
    /// </summary>
    /// <param name="id">ID del archivo a reemplazar.</param>
    /// <param name="file">Nuevo archivo.</param>
    /// <param name="metadata">Metadatos adicionales opcionales.</param>
    /// <returns>Información del archivo actualizado.</returns>
    [HttpPost("{id:int}/reemplazar")]
    [RequestSizeLimit(50_000_000)]
    [SwaggerOperation(Summary = "Reemplazar archivo", Description = "Reemplaza el contenido de un archivo existente. Tamaño máximo: 50 MB.")]
    [ProducesResponseType(typeof(ApiResponse<ArchivoResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Reemplazar(
        int id,
        IFormFile file,
        [FromForm] string? metadata)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "No se proporcionó ningún archivo",
                Data = null
            });

        using var stream = file.OpenReadStream();
        var result = await _service.ReemplazarAsync(id, stream, file.FileName, file.ContentType, metadata);

        return result.ToActionResult(this, archivo => Ok(new ApiResponse<ArchivoResponse>
        {
            Success = true,
            Message = "Archivo reemplazado exitosamente",
            Data = archivo
        }));
    }

    /// <summary>
    /// Obtiene la información de un archivo específico.
    /// </summary>
    /// <param name="id">ID del archivo.</param>
    /// <returns>Información del archivo.</returns>
    [HttpGet("{id:int}")]
    [SwaggerOperation(Summary = "Obtener archivo por ID", Description = "Retorna la información de un archivo específico")]
    [ProducesResponseType(typeof(ApiResponse<ArchivoResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _service.GetByIdAsync(id);

        return result.ToActionResult(this, archivo => Ok(new ApiResponse<ArchivoResponse>
        {
            Success = true,
            Message = "Archivo obtenido exitosamente",
            Data = archivo
        }));
    }

    /// <summary>
    /// Lista archivos con filtros opcionales.
    /// </summary>
    /// <param name="query">Filtros de búsqueda.</param>
    /// <returns>Lista de archivos.</returns>
    [HttpGet]
    [SwaggerOperation(Summary = "Listar archivos", Description = "Retorna la lista de archivos con filtros opcionales")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<ArchivoListItemResponse>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetAll([FromQuery] ListarArchivosQuery query)
    {
        var result = await _service.GetAllAsync(query);

        return result.ToActionResult(this, archivos => Ok(new ApiResponse<IEnumerable<ArchivoListItemResponse>>
        {
            Success = true,
            Message = "Archivos obtenidos exitosamente",
            Data = archivos
        }));
    }

    /// <summary>
    /// Descarga el contenido de un archivo.
    /// </summary>
    /// <param name="id">ID del archivo a descargar.</param>
    /// <returns>Contenido del archivo.</returns>
    [HttpGet("{id:int}/download")]
    [SwaggerOperation(Summary = "Descargar archivo", Description = "Descarga el contenido de un archivo")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Download(int id)
    {
        var result = await _service.DownloadAsync(id);

        return result.ToActionResult(this, data => File(data.Stream, data.ContentType, data.FileName));
    }

    /// <summary>
    /// Previsualiza un archivo (solo formatos soportados).
    /// </summary>
    /// <param name="id">ID del archivo a previsualizar.</param>
    /// <returns>Contenido del archivo para previsualización.</returns>
    [HttpGet("{id:int}/preview")]
    [SwaggerOperation(Summary = "Previsualizar archivo", Description = "Retorna una previsualización del archivo (solo formatos soportados)")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status415UnsupportedMediaType)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Preview(int id)
    {
        var result = await _service.PreviewAsync(id);

        if (result.IsError)
        {
            return result.FirstError.Type switch
            {
                ErrorType.NotFound => NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = "Archivo no encontrado",
                    Data = null
                }),
                ErrorType.Failure => StatusCode(415, new ApiResponse<object>
                {
                    Success = false,
                    Message = "Formato no soportado para previsualización",
                    Data = null
                }),
                _ => result.ToActionResult(this, _ => Ok())
            };
        }

        var data = result.Value;
        return File(data.Stream, data.ContentType, data.FileName);
    }

    /// <summary>
    /// Elimina un archivo del sistema.
    /// </summary>
    /// <param name="id">ID del archivo a eliminar.</param>
    /// <returns>Confirmación de eliminación.</returns>
    [HttpDelete("{id:int}")]
    [SwaggerOperation(Summary = "Eliminar archivo", Description = "Elimina un archivo del sistema")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _service.DeleteAsync(id);

        return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Archivo eliminado exitosamente",
            Data = null
        }));
    }
}
