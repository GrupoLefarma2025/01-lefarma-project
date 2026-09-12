using System.Security.Claims;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/hospitales")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class HospitalesController : ControllerBase
{
    private readonly IHospitalService _service;

    public HospitalesController(IHospitalService service)
    {
        _service = service;
    }

    [HttpGet]
    [SwaggerOperation(
        Summary = "Obtener catálogo de hospitales",
        Description = "Retorna hospitales paginados desde Asokam.genContactosCat con su extensión en educacion_medica.hospital_extension. Permite búsqueda y filtros avanzados.")]
    [SwaggerResponse(200, "Hospitales obtenidos", typeof(ApiResponse<PagedResult<HospitalDto>>))]
    public async Task<IActionResult> GetAll([FromQuery] GetHospitalesRequest request, CancellationToken ct)
    {
        var filter = new Lefarma.API.Domain.Interfaces.EducacionMedica.HospitalFilterParams
        {
            Search = request.Search,
            ModoInstitucion = request.ModoInstitucion,
            ConSia = request.ConSia,
            IdTipoGerencia = request.IdTipoGerencia,
            IdRegion = request.IdRegion,
            NumeroQuirofanosMin = request.NumeroQuirofanosMin,
            AnestesiasTotalesMin = request.AnestesiasTotalesMin,
            Activo = request.Activo,
            TieneCoordenadas = request.TieneCoordenadas,
            OrderBy = request.OrderBy,
            OrderDirection = request.OrderDirection,
            Page = request.Page,
            PageSize = request.PageSize,
        };

        var hospitales = await _service.GetHospitalesAsync(filter, ct);
        return Ok(new ApiResponse<PagedResult<HospitalDto>>
        {
            Success = true,
            Message = "Hospitales obtenidos exitosamente.",
            Data = hospitales
        });
    }

    [HttpGet("ubicaciones")]
    [SwaggerOperation(
        Summary = "Obtener ubicaciones de hospitales",
        Description = "Retorna hospitales con coordenadas Latitud/Longitud aplicando los mismos filtros del catálogo, sin paginación.")]
    [SwaggerResponse(200, "Ubicaciones obtenidas", typeof(ApiResponse<List<HospitalUbicacionDto>>))]
    public async Task<IActionResult> GetUbicaciones([FromQuery] GetHospitalesRequest request, CancellationToken ct)
    {
        var filter = new Lefarma.API.Domain.Interfaces.EducacionMedica.HospitalFilterParams
        {
            Search = request.Search,
            ModoInstitucion = request.ModoInstitucion,
            ConSia = request.ConSia,
            IdTipoGerencia = request.IdTipoGerencia,
            IdRegion = request.IdRegion,
            NumeroQuirofanosMin = request.NumeroQuirofanosMin,
            AnestesiasTotalesMin = request.AnestesiasTotalesMin,
            Activo = request.Activo,
        };

        var ubicaciones = await _service.GetUbicacionesAsync(filter, ct);
        return Ok(new ApiResponse<List<HospitalUbicacionDto>>
        {
            Success = true,
            Message = "Ubicaciones obtenidas exitosamente.",
            Data = ubicaciones
        });
    }

    [HttpGet("{idHospital}")]
    [SwaggerOperation(
        Summary = "Obtener hospital por ID",
        Description = "Retorna el hospital de Asokam con su extensión del módulo.")]
    [SwaggerResponse(200, "Hospital obtenido", typeof(ApiResponse<HospitalDto>))]
    [SwaggerResponse(404, "Hospital no encontrado")]
    public async Task<IActionResult> GetById(int idHospital, CancellationToken ct)
    {
        var hospital = await _service.GetHospitalByIdAsync(idHospital, ct);
        if (hospital is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = $"Hospital {idHospital} no encontrado."
            });
        }

        return Ok(new ApiResponse<HospitalDto>
        {
            Success = true,
            Message = "Hospital obtenido exitosamente.",
            Data = hospital
        });
    }

    [HttpPut("{idHospital}/extension")]
    [SwaggerOperation(
        Summary = "Crear o actualizar extensión del hospital",
        Description = "Crea o edita los datos propios del módulo (gerencia, SIA, quirófanos) para un hospital.")]
    [SwaggerResponse(200, "Extensión guardada", typeof(ApiResponse<HospitalExtensionDto>))]
    [SwaggerResponse(409, "Región inválida")]
    public async Task<IActionResult> UpsertExtension(
        int idHospital,
        [FromBody] UpsertHospitalExtensionRequest request,
        CancellationToken ct)
    {
        try
        {
            var idUsuario = GetUserId();
            var extension = await _service.UpsertExtensionAsync(idHospital, request, idUsuario, ct);

            return Ok(new ApiResponse<HospitalExtensionDto>
            {
                Success = true,
                Message = "Extensión guardada exitosamente.",
                Data = extension
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }
}
