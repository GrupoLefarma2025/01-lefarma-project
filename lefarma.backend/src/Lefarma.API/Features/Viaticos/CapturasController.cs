using System.Text.Json;
using Lefarma.API.Features.Viaticos.DTOs;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Viaticos;

/// <summary>
/// Endpoint que envuelve <c>captura-viaticos.mjs</c> (T7) y lo expone a la SPA.
/// T8 del plan costos-ruta-demo: el wizard de viaticos necesita una imagen
/// "para ir a comprar de inmediato" por opcion de la tabla.
/// </summary>
[ApiController]
[Route("api/viaticos")]
[EndpointGroupName("Viaticos")]
[Authorize]
public class CapturasController : ControllerBase
{
    private readonly CapturasService _service;
    private readonly string _capturasDir;

    public CapturasController(CapturasService service, IWebHostEnvironment env)
    {
        _service = service;
        // Misma ruta que CapturasService: los PNG viven bajo
        // wwwroot/media/capturas-viaticos.
        _capturasDir = Path.GetFullPath(
            Path.Combine(env.WebRootPath, "media", "capturas-viaticos"));
    }

    /// <summary>
    /// Ruta absoluta de <paramref name="archivo"/> dentro del directorio de
    /// capturas, o <c>null</c> si la ruta escapa del directorio (traversal o
    /// ruta absoluta). Mismo criterio que <see cref="CapturasService"/>:
    /// <c>Path.GetFullPath</c> + comprobacion del prefijo del directorio con
    /// separador final.
    /// </summary>
    public static string? RutaDentroDelDirectorio(string directorioCapturas, string archivo)
    {
        if (string.IsNullOrWhiteSpace(archivo)) return null;

        var baseDir = Path.GetFullPath(directorioCapturas);
        var destino = Path.GetFullPath(Path.Combine(
            baseDir, archivo.Replace('/', Path.DirectorySeparatorChar)));
        var prefijo = baseDir + Path.DirectorySeparatorChar;
        return destino.StartsWith(prefijo, StringComparison.Ordinal) ? destino : null;
    }

    [HttpPost("capturas")]
    [SwaggerOperation(
        Summary = "Capturar pantallas PNG de URLs de compra",
        Description = "Acepta `urls` como array de strings o de objetos { url, nombre }. " +
                      "Valida whitelist (configurable, vacia por defecto), dominio (max 10) y " +
                      "delega al script captura-viaticos.mjs. Los PNG se copian a " +
                      "wwwroot/media/capturas-viaticos y se sirven, ya autenticados, por " +
                      "GET api/viaticos/capturas/{archivo}.")]
    [SwaggerResponse(200, "Capturas procesadas (cada item puede tener ok=false)", typeof(ApiResponse<List<CapturaResultDto>>))]
    [SwaggerResponse(400, "Demasiadas URLs o dominio fuera de la lista blanca")]
    public async Task<IActionResult> Capturar([FromBody] CapturaRequest? request, CancellationToken ct)
    {
        if (request?.Urls == null)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "el campo 'urls' es requerido",
            });
        }

        var items = new List<CapturaItem>(request.Urls.Count);
        foreach (var el in request.Urls)
        {
            switch (el.ValueKind)
            {
                case JsonValueKind.String:
                    var s = el.GetString();
                    if (string.IsNullOrWhiteSpace(s))
                    {
                        return BadRequest(new ApiResponse<object>
                        {
                            Success = false,
                            Message = "URL vacia en 'urls'",
                        });
                    }
                    items.Add(new CapturaItem { Url = s });
                    break;
                case JsonValueKind.Object:
                    var url = el.TryGetProperty("url", out var u) && u.ValueKind == JsonValueKind.String
                        ? u.GetString() ?? "" : "";
                    var nombre = el.TryGetProperty("nombre", out var n) && n.ValueKind == JsonValueKind.String
                        ? n.GetString() : null;
                    if (string.IsNullOrWhiteSpace(url))
                    {
                        return BadRequest(new ApiResponse<object>
                        {
                            Success = false,
                            Message = "objeto en 'urls' sin campo 'url'",
                        });
                    }
                    items.Add(new CapturaItem { Url = url, Nombre = nombre });
                    break;
                default:
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "elemento de 'urls' invalido (debe ser string u objeto {url,nombre})",
                    });
            }
        }

        var result = await _service.CapturarAsync(items, ct);

        if (result.Outcome == CapturaOutcome.TooMany || result.Outcome == CapturaOutcome.DomainBlocked)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = result.Message ?? "solicitud invalida",
            });
        }

        return Ok(new ApiResponse<List<CapturaResultDto>>
        {
            Success = true,
            Message = "Capturas procesadas.",
            Data = result.Results,
        });
    }

    /// <summary>
    /// Unico camino a los PNG bajo wwwroot/media/capturas-viaticos. El estatico
    /// anonimo /api/media/capturas-viaticos quedo cerrado (Program.cs), por eso
    /// el frontend pide la imagen con token y la pinta desde un object URL.
    /// </summary>
    [HttpGet("capturas/{**archivo}")]
    [SwaggerOperation(
        Summary = "Servir un PNG de captura de viaticos",
        Description = "Exige token ([Authorize]) y resuelve `archivo` DENTRO de " +
                      "wwwroot/media/capturas-viaticos: cualquier ruta que escape del " +
                      "directorio (traversal o ruta absoluta) se rechaza con 400.")]
    [SwaggerResponse(200, "PNG de la captura", typeof(FileResult))]
    [SwaggerResponse(400, "Ruta de captura invalida (traversal o ruta absoluta)")]
    [SwaggerResponse(404, "La captura no existe")]
    public IActionResult ObtenerCaptura(string archivo)
    {
        var ruta = RutaDentroDelDirectorio(_capturasDir, archivo);
        if (ruta is null)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "ruta de captura invalida",
            });
        }

        if (!System.IO.File.Exists(ruta))
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "captura no encontrada",
            });
        }

        return PhysicalFile(ruta, "image/png");
    }
}
