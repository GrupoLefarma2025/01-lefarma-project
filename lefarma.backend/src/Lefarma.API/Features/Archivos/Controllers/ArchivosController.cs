using ErrorOr;
using Lefarma.API.Features.Archivos.DTOs;
using Lefarma.API.Features.Archivos.Services;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Swashbuckle.AspNetCore.Annotations;
using System.Text.Json;

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

    /// <summary>
    /// Sube un nuevo archivo al sistema.
    /// </summary>
    /// <param name="request">Datos del archivo a subir.</param>
    /// <param name="file">Archivo a subir.</param>
    /// <returns>Información del archivo subido.</returns>
    [HttpPost("upload")]
    [RequestSizeLimit(50_000_000)] // 50MB
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

        // Renombrar archivos adjuntos de workflow con formato: {folio}-Paso{id}-{nombrePaso}-adjunto-{N}.ext
        var fileName = file.FileName;
        if (request.EntidadTipo == "OrdenCompra" && request.Carpeta == "ordenes-compra")
        {
            var folio = await _db.OrdenesCompra
                .Where(o => o.IdOrden == request.EntidadId)
                .Select(o => o.Folio)
                .FirstOrDefaultAsync();

            if (!string.IsNullOrWhiteSpace(folio))
            {
                string pasoInfo = "";
                if (!string.IsNullOrWhiteSpace(request.Metadata))
                {
                    try
                    {
                        using var metaDoc = JsonDocument.Parse(request.Metadata);
                        var raiz = metaDoc.RootElement;
                        var idPaso = raiz.TryGetProperty("paso", out var p) ? p.GetString() ?? "" : "";
                        var nombrePaso = raiz.TryGetProperty("nombrePaso", out var np) ? np.GetString() ?? "" : "";
                        if (!string.IsNullOrWhiteSpace(idPaso) && !string.IsNullOrWhiteSpace(nombrePaso))
                            pasoInfo = $"-Paso{idPaso}-{nombrePaso.Replace(' ', '_')}";
                    }
                    catch { /* metadata invalido */ }
                }

                var count = await _service.GetArchivosCountAsync(request.EntidadTipo, request.EntidadId, request.Carpeta);
                var ext = Path.GetExtension(file.FileName);
                fileName = $"{folio}{pasoInfo}-adjunto-{count + 1}{ext}";
            }
        }

        // Renombrar archivos de comprobantes (pago/gasto): {folio}-Gasto-{N}.ext o {folio}-Pago-{N}.ext
        if (request.EntidadTipo == "OrdenCompra" && request.Carpeta == "comprobantes")
        {
            string? prefijo = null;
            if (!string.IsNullOrWhiteSpace(request.Metadata))
            {
                try
                {
                    using var metaDoc = JsonDocument.Parse(request.Metadata);
                    var raiz = metaDoc.RootElement;
                    var tipo = raiz.TryGetProperty("tipo", out var t) ? t.GetString() ?? "" : "";
                    prefijo = tipo == "comprobante_pago" ? "Pago" : tipo == "comprobante_gasto" ? "Gasto" : null;
                }
                catch { /* metadata invalido */ }
            }

            if (prefijo != null)
            {
                var folio = await _db.OrdenesCompra
                    .Where(o => o.IdOrden == request.EntidadId)
                    .Select(o => o.Folio)
                    .FirstOrDefaultAsync();

                if (!string.IsNullOrWhiteSpace(folio))
                {
                    // Contar comprobantes del mismo tipo (pago o gasto) para esta orden
                    var categoria = prefijo == "Pago" ? "pago" : "gasto";
                    var count = await _db.Comprobantes
                        .CountAsync(c => c.Categoria == categoria
                            && _db.ComprobantesPartidas.Any(cp => cp.IdComprobante == c.IdComprobante && cp.Partida!.IdOrden == request.EntidadId));

                    var ext = Path.GetExtension(file.FileName);
                    fileName = $"{folio}-{prefijo}-{count + 1}{ext}";
                }
            }
        }

        var result = await _service.SubirAsync(stream, fileName, file.ContentType, request);

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
