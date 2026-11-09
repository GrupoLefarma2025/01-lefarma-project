using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/selecciones-mensuales")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
[HasAnyPermission(Permissions.EducacionMedica.SeleccionesGestionar, Permissions.EducacionMedica.SeleccionesAutorizar)]
public class SeleccionEjecutivoController : ControllerBase
{
    private readonly ISeleccionEjecutivoService _service;

    public SeleccionEjecutivoController(ISeleccionEjecutivoService service)
    {
        _service = service;
    }

    [HttpPut("{idSeleccionMensual:int}/regiones/{idRegion:int}/ejecutivo")]
    [SwaggerOperation(
        Summary = "Asignar ejecutivo a una región de la selección",
        Description = "Asigna el ejecutivo dueño de la región y, opcionalmente, un especialista sugerido. Valida que el ejecutivo tenga una región activa compatible en Colaboradores y que el especialista sea elegible para la gerencia.")]
    [SwaggerResponse(200, "Región asignada", typeof(ApiResponse<SeleccionRegionDto>))]
    [SwaggerResponse(404, "Selección o región no encontrada")]
    [SwaggerResponse(409, "Selección no editable o validación de persona fallida")]
    public async Task<IActionResult> AsignarEjecutivo(
        int idSeleccionMensual,
        int idRegion,
        [FromBody] AsignarEjecutivoRegionRequest request,
        CancellationToken ct)
    {
        try
        {
            var region = await _service.AsignarEjecutivoAsync(
                idSeleccionMensual, idRegion, request, User.GetUserId(), ct);

            if (region is null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"Selección {idSeleccionMensual} no encontrada.",
                });
            }

            return Ok(new ApiResponse<SeleccionRegionDto>
            {
                Success = true,
                Message = "Ejecutivo asignado a la región exitosamente.",
                Data = region,
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{idSeleccionMensual:int}/hospitales/{idSeleccionHospital:int}/ejecutivo")]
    [SwaggerOperation(
        Summary = "Asignar override de ejecutivo a un hospital",
        Description = "Permite que un hospital use un ejecutivo distinto al default de la región, siempre que esté activo para la misma región y gerencia. NULL = heredar del ejecutivo de la región.")]
    [SwaggerResponse(200, "Override asignado", typeof(ApiResponse<SeleccionHospitalDto>))]
    [SwaggerResponse(404, "Selección o hospital no encontrado")]
    [SwaggerResponse(409, "Selección no editable o ejecutivo no elegible")]
    public async Task<IActionResult> AsignarEjecutivoHospital(
        int idSeleccionMensual,
        int idSeleccionHospital,
        [FromBody] AsignarEjecutivoHospitalRequest request,
        CancellationToken ct)
    {
        try
        {
            var hospital = await _service.AsignarEjecutivoHospitalAsync(
                idSeleccionMensual, idSeleccionHospital, request, User.GetUserId(), ct);

            if (hospital is null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"Selección {idSeleccionMensual} no encontrada.",
                });
            }

            return Ok(new ApiResponse<SeleccionHospitalDto>
            {
                Success = true,
                Message = "Ejecutivo override asignado exitosamente.",
                Data = hospital,
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }
}
