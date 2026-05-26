using Lefarma.API.Features.Archivos.DTOs;
using Lefarma.API.Features.Archivos.Services;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Swashbuckle.AspNetCore.Annotations;
using System.Text.Json;

namespace Lefarma.API.Features.Archivos.Controllers;

[ApiController]
[Route("api/archivos/externo")]
[EndpointGroupName("Archivos-Externo")]
public class ArchivoExternoController : ControllerBase
{
    private readonly IArchivoService _service;
    private readonly ApplicationDbContext _db;
    private readonly IConfiguration _configuration;

    public ArchivoExternoController(IArchivoService service, ApplicationDbContext db, IConfiguration configuration)
    {
        _service = service;
        _db = db;
        _configuration = configuration;
    }

    private bool ValidateApiKey(out IActionResult? errorResponse)
    {
        errorResponse = null;
        var apiKey = _configuration["Auth:ApiKey"];
        var providedKey = HttpContext.Request.Headers["X-API-Key"].FirstOrDefault();

        if (string.IsNullOrEmpty(providedKey)
            || string.IsNullOrEmpty(apiKey)
            || !string.Equals(providedKey, apiKey, StringComparison.OrdinalIgnoreCase))
        {
            errorResponse = Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "API Key inválida o no proporcionada."
            });
            return false;
        }

        return true;
    }

    private int GetExternalUserId()
    {
        var userIdHeader = HttpContext.Request.Headers["X-User-Id"].FirstOrDefault();
        return int.TryParse(userIdHeader, out var uid) ? uid : 0;
    }

    /// <summary>
    /// Sube un nuevo archivo al sistema desde un cliente externo.
    /// </summary>
    [HttpPost("upload")]
    [AllowAnonymous]
    [RequestSizeLimit(50_000_000)] // 50MB
    [Consumes("multipart/form-data")]
    [SwaggerOperation(Summary = "Subir archivo desde sistema externo", Description = "Requiere X-API-Key y X-User-Id en headers.")]
    public async Task<IActionResult> Upload(
        [FromForm] SubirArchivoRequest request,
        IFormFile file)
    {
        if (!ValidateApiKey(out var errorResponse))
            return errorResponse!;

        if (file == null || file.Length == 0)
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "No se proporcionó ningún archivo",
                Data = null
            });

        var userId = GetExternalUserId();
        if (userId == 0)
            userId = int.TryParse(_configuration["Auth:AnonymousUserId"], out var defaultUid) ? defaultUid : 0;

        using var stream = file.OpenReadStream();

        // Renombrar archivos adjuntos de orden de compra con formato: {folioSinGuiones}-{ddMMyyyy}-adjunto_{N}.ext
        var fileName = file.FileName;
        if (request.EntidadTipo == "OrdenCompra" && request.Carpeta == "ordenes-compra")
        {
            var folio = await _db.OrdenesCompra
                .Where(o => o.IdOrden == request.EntidadId)
                .Select(o => o.Folio)
                .FirstOrDefaultAsync();

            if (!string.IsNullOrWhiteSpace(folio))
            {
                var folioLimpio = folio.Replace("-", "");
                var fecha = DateTime.Now.ToString("ddMMyyyy");
                var count = await _service.GetArchivosCountAsync(request.EntidadTipo, request.EntidadId, request.Carpeta);
                var ext = Path.GetExtension(file.FileName);
                fileName = $"{folioLimpio}-{fecha}-adjunto_{count + 1}{ext}";
            }
        }

        // Renombrar archivos de comprobantes (pago/gasto): {folioSinGuiones}-{ddMMyyyy}-{tipo}_{N}.ext
        if (request.EntidadTipo == "OrdenCompra" && request.Carpeta == "comprobantes")
        {
            string? tipoComprobante = null;
            if (!string.IsNullOrWhiteSpace(request.Metadata))
            {
                try
                {
                    using var metaDoc = JsonDocument.Parse(request.Metadata);
                    var raiz = metaDoc.RootElement;
                    var tipo = raiz.TryGetProperty("tipo", out var t) ? t.GetString() ?? "" : "";
                    tipoComprobante = tipo == "comprobante_pago" ? "pago" : tipo == "comprobante_gasto" ? "gasto" : null;
                }
                catch { /* metadata invalido */ }
            }

            if (tipoComprobante != null)
            {
                var folio = await _db.OrdenesCompra
                    .Where(o => o.IdOrden == request.EntidadId)
                    .Select(o => o.Folio)
                    .FirstOrDefaultAsync();

                if (!string.IsNullOrWhiteSpace(folio))
                {
                    var folioLimpio = folio.Replace("-", "");
                    var fecha = DateTime.Now.ToString("ddMMyyyy");
                    var count = await _db.Comprobantes
                        .CountAsync(c => c.Categoria == tipoComprobante
                            && _db.ComprobantesPartidas.Any(cp => cp.IdComprobante == c.IdComprobante && cp.Partida!.IdOrden == request.EntidadId));

                    var ext = Path.GetExtension(file.FileName);
                    fileName = $"{folioLimpio}-{fecha}-{tipoComprobante}_{count + 1}{ext}";
                }
            }
        }

        var result = await _service.SubirAsync(stream, fileName, file.ContentType, request, userId);

        return result.ToActionResult(this, archivo => Ok(new ApiResponse<ArchivoResponse>
        {
            Success = true,
            Message = "Archivo subido exitosamente",
            Data = archivo
        }));
    }
}
