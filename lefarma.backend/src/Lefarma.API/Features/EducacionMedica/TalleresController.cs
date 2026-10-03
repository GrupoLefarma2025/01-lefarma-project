using System.Security.Claims;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/talleres")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class TalleresController : ControllerBase
{
    private readonly ITalleresService _service;

    public TalleresController(ITalleresService service)
    {
        _service = service;
    }

    [HttpGet("mis-talleres")]
    [SwaggerOperation(
        Summary = "Mis talleres del mes (equipo de pareo)",
        Description = "Equipo del usuario (EV+EP), su matriz individual del periodo (YYYY-MM; default mes actual) y los talleres capturados.")]
    [SwaggerResponse(200, "Mis talleres", typeof(ApiResponse<MisTalleresResponse>))]
    public async Task<IActionResult> GetMisTalleres([FromQuery] string? periodo, CancellationToken ct)
    {
        try
        {
            var resultado = await _service.GetMisTalleresAsync(GetUserId(), periodo, ct);
            return Ok(new ApiResponse<MisTalleresResponse>
            {
                Success = true,
                Message = "Talleres obtenidos exitosamente.",
                Data = resultado
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost]
    [SwaggerOperation(
        Summary = "Capturar taller (FOR-005)",
        Description = "Captura un taller sobre un hospital de la selección. Valida que el usuario sea EV/EP del equipo asignado a la región; hace get-or-create de la matriz individual (equipo+mes) y de la general (gerencia+mes, que nace en el paso inicial del workflow). Solo con la general en estado Creada y la individual EnCaptura.")]
    [SwaggerResponse(200, "Taller capturado", typeof(ApiResponse<TallerDto>))]
    [SwaggerResponse(409, "Elegibilidad o candado de edición fallido")]
    public async Task<IActionResult> Crear([FromBody] CrearTallerRequest request, CancellationToken ct)
    {
        try
        {
            var taller = await _service.CrearAsync(request, GetUserId(), ct);
            return Ok(new ApiResponse<TallerDto>
            {
                Success = true,
                Message = "Taller capturado exitosamente.",
                Data = taller
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{idTaller:int}")]
    [SwaggerOperation(
        Summary = "Editar taller",
        Description = "Solo con la matriz general en estado Creada (paso inicial) y la individual EnCaptura.")]
    [SwaggerResponse(200, "Taller actualizado", typeof(ApiResponse<TallerDto>))]
    [SwaggerResponse(409, "Candado de edición")]
    public async Task<IActionResult> Actualizar(int idTaller, [FromBody] ActualizarTallerRequest request, CancellationToken ct)
    {
        try
        {
            var taller = await _service.ActualizarAsync(idTaller, request, GetUserId(), ct);
            return Ok(new ApiResponse<TallerDto>
            {
                Success = true,
                Message = "Taller actualizado exitosamente.",
                Data = taller
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpDelete("{idTaller:int}")]
    [SwaggerOperation(
        Summary = "Eliminar taller",
        Description = "Borrado físico (con sus recursos). Solo con la matriz general en estado Creada y la individual EnCaptura.")]
    [SwaggerResponse(200, "Taller eliminado")]
    [SwaggerResponse(409, "Candado de edición")]
    public async Task<IActionResult> Eliminar(int idTaller, CancellationToken ct)
    {
        try
        {
            await _service.EliminarAsync(idTaller, GetUserId(), ct);
            return Ok(new ApiResponse<object> { Success = true, Message = "Taller eliminado exitosamente." });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("matrices-individuales/{idMatrizIndividual:int}/generar")]
    [SwaggerOperation(
        Summary = "Generar matriz individual",
        Description = "Bloquea la captura del equipo y registra la fecha de generación. La ejecuta el EV o EP del equipo, con la general en estado Creada.")]
    [SwaggerResponse(200, "Matriz generada", typeof(ApiResponse<MatrizIndividualDto>))]
    [SwaggerResponse(409, "Ya generada o la general salió del paso inicial")]
    public async Task<IActionResult> GenerarMatrizIndividual(int idMatrizIndividual, CancellationToken ct)
    {
        try
        {
            var matriz = await _service.GenerarMatrizIndividualAsync(idMatrizIndividual, GetUserId(), ct);
            return Ok(new ApiResponse<MatrizIndividualDto>
            {
                Success = true,
                Message = "Matriz individual generada exitosamente.",
                Data = matriz
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("matrices-individuales/{idMatrizIndividual:int}/reabrir")]
    [SwaggerOperation(
        Summary = "Reabrir captura de la matriz individual",
        Description = "Solo el Gerente de Ventas participante del paso y solo mientras la matriz general siga en estado Creada.")]
    [SwaggerResponse(200, "Captura reabierta", typeof(ApiResponse<MatrizIndividualDto>))]
    [SwaggerResponse(409, "No generada, sin participación o la general salió del paso inicial")]
    public async Task<IActionResult> ReabrirMatrizIndividual(int idMatrizIndividual, CancellationToken ct)
    {
        try
        {
            var matriz = await _service.ReabrirMatrizIndividualAsync(idMatrizIndividual, GetUserId(), ct);
            return Ok(new ApiResponse<MatrizIndividualDto>
            {
                Success = true,
                Message = "Captura reabierta exitosamente.",
                Data = matriz
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    private int GetUserId() =>
        int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
}
