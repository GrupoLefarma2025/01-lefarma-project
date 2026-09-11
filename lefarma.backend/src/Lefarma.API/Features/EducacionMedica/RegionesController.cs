using System.Security.Claims;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/regiones")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class RegionesController : ControllerBase
{
    private readonly IRegionService _service;

    public RegionesController(IRegionService service)
    {
        _service = service;
    }

    [HttpGet]
    [SwaggerOperation(
        Summary = "Obtener regiones",
        Description = "Retorna el catálogo de regiones (macro, estable) con la cantidad de hospitales asignados por región.")]
    [SwaggerResponse(200, "Regiones obtenidas", typeof(ApiResponse<List<RegionDto>>))]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var regiones = await _service.GetRegionesAsync(ct);
        return Ok(new ApiResponse<List<RegionDto>>
        {
            Success = true,
            Message = "Regiones obtenidas exitosamente.",
            Data = regiones
        });
    }

    [HttpPost]
    [SwaggerOperation(
        Summary = "Crear región",
        Description = "Crea una región nueva con su centroide y los estados que la componen. Los hospitales no se mueven; se reasignan con 'Aplicar mapeo a hospitales'.")]
    [SwaggerResponse(200, "Región creada", typeof(ApiResponse<RegionDto>))]
    [SwaggerResponse(409, "Nombre duplicado o inválido")]
    public async Task<IActionResult> Create([FromBody] UpsertRegionRequest request, CancellationToken ct)
    {
        try
        {
            var idUsuario = int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
            var region = await _service.CreateRegionAsync(request, idUsuario, ct);
            return Ok(new ApiResponse<RegionDto>
            {
                Success = true,
                Message = MensajeGuardado(region),
                Data = region
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{idRegion:int}")]
    [SwaggerOperation(
        Summary = "Actualizar región",
        Description = "Edita nombre, centroide, estatus y los estados que componen la región. Cambiar los estados NO mueve hospitales; se reasignan con 'Aplicar mapeo a hospitales'.")]
    [SwaggerResponse(200, "Región actualizada", typeof(ApiResponse<RegionDto>))]
    [SwaggerResponse(409, "Nombre duplicado o inválido")]
    public async Task<IActionResult> Update(int idRegion, [FromBody] UpsertRegionRequest request, CancellationToken ct)
    {
        try
        {
            var idUsuario = int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
            var region = await _service.UpdateRegionAsync(idRegion, request, idUsuario, ct);
            return Ok(new ApiResponse<RegionDto>
            {
                Success = true,
                Message = MensajeGuardado(region),
                Data = region
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("estados-catalogo")]
    [SwaggerOperation(
        Summary = "Obtener catálogo de estados",
        Description = "Retorna los 32 estados (Asokam.genEstadosCat) con la región que los tiene asignada, para la edición por checkboxes.")]
    [SwaggerResponse(200, "Catálogo obtenido", typeof(ApiResponse<List<EstadoCatalogoDto>>))]
    public async Task<IActionResult> GetEstadosCatalogo(CancellationToken ct)
    {
        var catalogo = await _service.GetEstadosCatalogoAsync(ct);
        return Ok(new ApiResponse<List<EstadoCatalogoDto>>
        {
            Success = true,
            Message = "Catálogo de estados obtenido exitosamente.",
            Data = catalogo
        });
    }

    [HttpGet("sugerencia/{codigoContacto:int}")]
    [SwaggerOperation(
        Summary = "Sugerir región de un hospital",
        Description = "Devuelve ambas candidatas: la región del mapeo del estado del hospital y la región con centroide más cercano por GPS (con distancia en km).")]
    [SwaggerResponse(200, "Sugerencia obtenida", typeof(ApiResponse<SugerenciaRegionResponseDto>))]
    [SwaggerResponse(409, "Hospital inválido")]
    public async Task<IActionResult> GetSugerencia(int codigoContacto, CancellationToken ct)
    {
        try
        {
            var sugerencia = await _service.GetSugerenciaAsync(codigoContacto, ct);
            return Ok(new ApiResponse<SugerenciaRegionResponseDto>
            {
                Success = true,
                Message = "Sugerencia obtenida exitosamente.",
                Data = sugerencia
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("aplicar-mapeo/preview")]
    [SwaggerOperation(
        Summary = "Preview de aplicar mapeo a hospitales",
        Description = "Cuenta, por estado, cuántos hospitales se moverían a la región de su estado según el mapeo actual, y cuántos hospitales sin región y sin mapeo de estado se asignarían a la región con centroide más cercano (GPS). No cambia datos.")]
    [SwaggerResponse(200, "Preview obtenido", typeof(ApiResponse<AplicarMapeoResponseDto>))]
    public async Task<IActionResult> PreviewAplicarMapeo(CancellationToken ct)
    {
        var preview = await _service.PreviewAplicarMapeoAsync(ct);
        return Ok(new ApiResponse<AplicarMapeoResponseDto>
        {
            Success = true,
            Message = "Preview obtenido exitosamente.",
            Data = preview
        });
    }

    [HttpPost("aplicar-mapeo")]
    [SwaggerOperation(
        Summary = "Aplicar mapeo a hospitales",
        Description = "Pase 1: asigna a cada hospital la región de su estado donde difiere (sobrescribe según el mapeo). Pase 2: los hospitales que siguen sin región se asignan a la región activa con centroide más cercano (GPS); nunca toca los que ya tienen región. Revisa el preview antes.")]
    [SwaggerResponse(200, "Mapeo aplicado", typeof(ApiResponse<object>))]
    public async Task<IActionResult> AplicarMapeo(CancellationToken ct)
    {
        var idUsuario = int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
        var resultado = await _service.AplicarMapeoAsync(idUsuario, ct);
        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = $"Mapeo aplicado: {resultado.PorEstado} por estado, {resultado.PorGps} por cercanía al centroide.",
            Data = new
            {
                hospitalesReasignados = resultado.Total,
                porEstado = resultado.PorEstado,
                porGps = resultado.PorGps
            }
        });
    }

    [HttpGet("estados")]
    [SwaggerOperation(
        Summary = "Obtener mapeo estado -> región",
        Description = "Retorna el mapeo editable de cada estado (Asokam.genEstadosCat) a su región.")]
    [SwaggerResponse(200, "Mapeo obtenido", typeof(ApiResponse<List<RegionEstadoDto>>))]
    public async Task<IActionResult> GetMapeoEstados(CancellationToken ct)
    {
        var mapeo = await _service.GetMapeoEstadosAsync(ct);
        return Ok(new ApiResponse<List<RegionEstadoDto>>
        {
            Success = true,
            Message = "Mapeo de estados obtenido exitosamente.",
            Data = mapeo
        });
    }

    [HttpPut("estados/{codigoEstado:int}")]
    [SwaggerOperation(
        Summary = "Asignar estado a región",
        Description = "Crea o actualiza el mapeo de un estado hacia una región.")]
    [SwaggerResponse(200, "Mapeo guardado", typeof(ApiResponse<RegionEstadoDto>))]
    [SwaggerResponse(409, "Región inválida")]
    public async Task<IActionResult> UpsertMapeoEstado(int codigoEstado, [FromBody] UpsertRegionEstadoRequest request, CancellationToken ct)
    {
        try
        {
            var idUsuario = int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
            var mapeo = await _service.UpsertMapeoEstadoAsync(codigoEstado, request, idUsuario, ct);
            return Ok(new ApiResponse<RegionEstadoDto>
            {
                Success = true,
                Message = "Mapeo de estado guardado exitosamente.",
                Data = mapeo
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPatch("hospitales/{codigoContacto:int}")]
    [SwaggerOperation(
        Summary = "Asignar región a un hospital",
        Description = "Asigna (o quita, con idRegion: null) la región de un hospital en su extensión. La asignación es manual y queda registrada con el usuario que la hizo.")]
    [SwaggerResponse(200, "Región asignada", typeof(ApiResponse<HospitalExtensionDto>))]
    [SwaggerResponse(409, "Hospital o región inválidos")]
    public async Task<IActionResult> AsignarRegionHospital(int codigoContacto, [FromBody] AsignarRegionHospitalRequest request, CancellationToken ct)
    {
        try
        {
            var idUsuario = int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
            var extension = await _service.AsignarRegionHospitalAsync(codigoContacto, request, idUsuario, ct);
            return Ok(new ApiResponse<HospitalExtensionDto>
            {
                Success = true,
                Message = "Región del hospital actualizada exitosamente.",
                Data = extension
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    private static string MensajeGuardado(RegionDto region)
    {
        return region.Estados.Count > 0
            ? "Región guardada exitosamente. Los hospitales conservan su región actual; usa 'Aplicar mapeo a hospitales' para reasignarlas según el mapeo."
            : "Región guardada exitosamente.";
    }
}
