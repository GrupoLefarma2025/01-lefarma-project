using Lefarma.API.Features.Facturas.DTOs;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using System.Security.Claims;

namespace Lefarma.API.Features.Facturas;

[ApiController]
[Route("api/facturas")]
[EndpointGroupName("Facturas")]
public class ComprobanteController : ControllerBase
{
    private readonly IComprobanteService _service;

    public ComprobanteController(IComprobanteService service) => _service = service;

    private int GetUserId() =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

    /// <summary>
    /// Parsea un XML CFDI y devuelve los datos extraídos sin guardar nada.
    /// </summary>
    [HttpPost("parsear-xml")]
    [RequestSizeLimit(5_000_000)]
    [Consumes("multipart/form-data")]
    [SwaggerOperation(Summary = "Parsear XML CFDI", Description = "Extrae y valida los datos del CFDI sin guardarlo.")]
    public async Task<IActionResult> ParsearXml(IFormFile xmlFile)
    {
        if (xmlFile == null || xmlFile.Length == 0)
            return BadRequest(new ApiResponse<object> { Success = false, Message = "No se proporcionó archivo XML" });

        using var sr = new StreamReader(xmlFile.OpenReadStream());
        var xmlContent = await sr.ReadToEndAsync();

        var result = await _service.ParsearXmlAsync(xmlContent);
        return result.ToActionResult(this, data => Ok(new ApiResponse<CfdiPreviewResponse>
        {
            Success = true,
            Message = "XML parseado exitosamente",
            Data = data
        }));
    }

    /// <summary>
    /// Sube un comprobante (CFDI o simple) con sus archivos.
    /// </summary>
    [HttpPost]
    [RequestSizeLimit(50_000_000)]
    [Consumes("multipart/form-data")]
    [SwaggerOperation(Summary = "Subir comprobante", Description = "Sube un comprobante CFDI o simple y opcionalmente sus archivos (XML, PDF, imagen).")]
    public async Task<IActionResult> Subir(
        [FromForm] SubirComprobanteRequest request,
        IFormFile? xmlFile,
        IFormFile? archivo,
        CancellationToken ct)
    {
        // Leer XML a string en el controller para evitar problemas con el stream del request
        string? xmlContent = null;
        if (xmlFile != null && xmlFile.Length > 0)
        {
            using var sr = new StreamReader(xmlFile.OpenReadStream());
            xmlContent = await sr.ReadToEndAsync(ct);
        }

        // Leer archivo adicional a MemoryStream
        MemoryStream? archivoStream = null;
        if (archivo != null && archivo.Length > 0)
        {
            archivoStream = new MemoryStream();
            await archivo.OpenReadStream().CopyToAsync(archivoStream, ct);
            archivoStream.Position = 0;
        }

        var result = await _service.SubirAsync(
            request,
            xmlContent, xmlFile?.FileName,
            archivoStream, archivo?.FileName, archivo?.ContentType,
            GetUserId(),
            ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ComprobanteResponse>
        {
            Success = true,
            Message = "Comprobante subido exitosamente",
            Data = data
        }));
    }

    /// <summary>
    /// Obtiene un comprobante por ID con sus conceptos.
    /// </summary>
    [HttpGet("{id:int}")]
    [SwaggerOperation(Summary = "Obtener comprobante por ID")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var result = await _service.GetByIdAsync(id, ct);
        return result.ToActionResult(this, data => Ok(new ApiResponse<ComprobanteResponse>
        {
            Success = true, Message = "Comprobante obtenido", Data = data
        }));
    }

    /// <summary>
    /// Lista los conceptos de un comprobante CFDI.
    /// </summary>
    [HttpGet("{id:int}/conceptos")]
    [SwaggerOperation(Summary = "Obtener conceptos del comprobante")]
    public async Task<IActionResult> GetConceptos(int id, CancellationToken ct)
    {
        var result = await _service.GetConceptosAsync(id, ct);
        return result.ToActionResult(this, data => Ok(new ApiResponse<List<ComprobanteConceptoResponse>>
        {
            Success = true, Message = "Conceptos obtenidos", Data = data
        }));
    }

    /// <summary>
    /// Lista las partidas de una orden que aún tienen facturación pendiente.
    /// </summary>
    [HttpGet("partidas-pendientes")]
    [SwaggerOperation(Summary = "Partidas pendientes de facturación de una orden")]
    public async Task<IActionResult> GetPartidasPendientes([FromQuery] int idOrden, [FromQuery] string categoria = "gasto", CancellationToken ct = default)
    {
        var result = await _service.GetPartidasPendientesAsync(idOrden, categoria, ct);
        return result.ToActionResult(this, data => Ok(new ApiResponse<List<PartidaPendienteResponse>>
        {
            Success = true, Message = "Partidas pendientes obtenidas", Data = data
        }));
    }

    /// <summary>
    /// Asigna conceptos del comprobante a partidas de órdenes de compra.
    /// </summary>
    [HttpPost("{id:int}/asignar-partidas")]
    [SwaggerOperation(Summary = "Asignar conceptos a partidas de OC",
        Description = "Relaciona conceptos del comprobante con partidas, valida cantidades e importes, y actualiza el estado de facturación.")]
    public async Task<IActionResult> AsignarPartidas(
        int id,
        [FromBody] AsignarPartidasRequest request,
        [FromQuery] int? idPasoWorkflow,
        CancellationToken ct)
    {
        var result = await _service.AsignarPartidasAsync(id, request, GetUserId(), idPasoWorkflow, ct);
        return result.ToActionResult(this, data => Ok(new ApiResponse<ComprobanteResponse>
        {
            Success = true, Message = "Partidas asignadas exitosamente", Data = data
        }));
    }

    /// <summary>
    /// Obtiene el estado de facturación de una partida con sus comprobantes aplicados.
    /// </summary>
    [HttpGet("partidas/{idPartida:int}/facturacion")]
    [SwaggerOperation(Summary = "Detalle de facturación de una partida")]
    public async Task<IActionResult> GetFacturacionPartida(int idPartida, CancellationToken ct)
    {
        var result = await _service.GetFacturacionPartidaAsync(idPartida, ct);
        return result.ToActionResult(this, data => Ok(new ApiResponse<PartidaFacturacionResponse>
        {
            Success = true, Message = "Facturación de partida obtenida", Data = data
        }));
    }
}
