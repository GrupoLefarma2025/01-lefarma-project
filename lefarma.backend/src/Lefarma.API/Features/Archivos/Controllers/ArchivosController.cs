using ErrorOr;
using Lefarma.API.Features.Archivos.DTOs;
using Lefarma.API.Features.Archivos.Services;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Swashbuckle.AspNetCore.Annotations;
using System.Security.Claims;

namespace Lefarma.API.Features.Archivos.Controllers;
[ApiController]
[Route("api/archivos")]
[EndpointGroupName("Archivos")]
public class ArchivosController : ControllerBase
{
    private readonly IArchivoService _service;
    private readonly ApplicationDbContext _db;

    public ArchivosController(IArchivoService service, ApplicationDbContext db)
    {
        _service = service;
        _db = db;
    }

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

    [HttpPost("upload")]
    [HasPermission(Permissions.Documentos.Subir)]
    [RequestSizeLimit(50_000_000)] 
    [Consumes("multipart/form-data")]
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
                Message = "No se proporciono ningun archivo",
                Data = null
            });

        using var stream = file.OpenReadStream();

        var fileName = file.FileName;

        if (request.EntidadTipo == "SolicitudPersonal" && request.Carpeta == "solicitudes-personal")
        {
            var folio = await _db.SolicitudesPersonal
                .Where(s => s.IdSolicitud == request.EntidadId)
                .Select(s => s.Folio)
                .FirstOrDefaultAsync();

            if (!string.IsNullOrWhiteSpace(folio))
            {
                var folioLimpio = folio.Replace("-", "");
                var fecha = DateTime.Now.ToString("ddMMyyyy");
                var count = await _service.GetArchivosCountAsync(request.EntidadTipo, request.EntidadId, request.Carpeta, soloActivos: false);
                var ext = Path.GetExtension(file.FileName);
                fileName = $"{folioLimpio}-{fecha}-adjunto_{count + 1}{ext}";
            }
        }

        var result = await _service.SubirAsync(stream, fileName, file.ContentType, request, GetUserId());

        return result.ToActionResult(this, archivo => Ok(new ApiResponse<ArchivoResponse>
        {
            Success = true,
            Message = "Archivo subido exitosamente",
            Data = archivo
        }));
    }

    [HttpPost("{id:int}/reemplazar")]
    [HasPermission(Permissions.Documentos.Subir)]
    [RequestSizeLimit(50_000_000)]
    [Consumes("multipart/form-data")]
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
        var result = await _service.ReemplazarAsync(id, stream, file.FileName, file.ContentType, metadata, GetUserId());

        return result.ToActionResult(this, archivo => Ok(new ApiResponse<ArchivoResponse>
        {
            Success = true,
            Message = "Archivo reemplazado exitosamente",
            Data = archivo
        }));
    }

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

    [HttpDelete("{id:int}")]
    [HasPermission(Permissions.Documentos.Eliminar)]
    [SwaggerOperation(Summary = "Eliminar archivo", Description = "Elimina un archivo del sistema")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _service.DeleteAsync(id, GetUserId());

        return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Archivo eliminado exitosamente",
            Data = null
        }));
    }
}
