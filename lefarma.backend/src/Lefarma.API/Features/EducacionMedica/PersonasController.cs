using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/personas")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class PersonasController : ControllerBase
{
    private readonly IPersonasService _service;

    public PersonasController(IPersonasService service)
    {
        _service = service;
    }

    [HttpGet("ejecutivos")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(
        Summary = "Listar ejecutivos y sus regiones",
        Description = "Retorna las asignaciones ejecutivo↔región. La gerencia se deriva de la región. Filtros: búsqueda por nombre, gerencia y solo activos.")]
    [SwaggerResponse(200, "Ejecutivos obtenidos", typeof(ApiResponse<List<EjecutivoRegionDto>>))]
    public async Task<IActionResult> GetEjecutivos(
        [FromQuery] string? busqueda,
        [FromQuery] int? idTipoGerencia,
        [FromQuery] bool? soloActivos,
        CancellationToken ct)
    {
        var ejecutivos = await _service.GetEjecutivosAsync(busqueda, idTipoGerencia, soloActivos, ct);
        return Ok(new ApiResponse<List<EjecutivoRegionDto>>
        {
            Success = true,
            Message = "Ejecutivos obtenidos exitosamente.",
            Data = ejecutivos,
        });
    }

    [HttpPost("ejecutivos")]
    [HasPermission(Permissions.EducacionMedica.ConfiguracionGestionar)]
    [SwaggerOperation(
        Summary = "Asignar región a un ejecutivo",
        Description = "Asigna una región a un ejecutivo. Valida que el usuario exista en Asokam y que todas sus regiones sean de la misma gerencia.")]
    [SwaggerResponse(201, "Asignación creada", typeof(ApiResponse<EjecutivoRegionDto>))]
    [SwaggerResponse(409, "Validación fallida")]
    public async Task<IActionResult> CrearEjecutivo([FromBody] CrearEjecutivoRegionRequest request, CancellationToken ct)
    {
        try
        {
            var ejecutivo = await _service.CrearEjecutivoAsync(request, User.GetUserId(), ct);
            return CreatedAtAction(nameof(GetEjecutivos), new ApiResponse<EjecutivoRegionDto>
            {
                Success = true,
                Message = "Región asignada al ejecutivo exitosamente.",
                Data = ejecutivo,
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("ejecutivos/{idEjecutivoRegion:int}")]
    [HasPermission(Permissions.EducacionMedica.ConfiguracionGestionar)]
    [SwaggerOperation(
        Summary = "Actualizar asignación de ejecutivo",
        Description = "Cambia la región o el estado de una asignación ejecutivo↔región.")]
    [SwaggerResponse(200, "Asignación actualizada", typeof(ApiResponse<EjecutivoRegionDto>))]
    [SwaggerResponse(404, "Asignación no encontrada")]
    [SwaggerResponse(409, "Validación fallida")]
    public async Task<IActionResult> ActualizarEjecutivo(
        int idEjecutivoRegion,
        [FromBody] ActualizarEjecutivoRegionRequest request,
        CancellationToken ct)
    {
        try
        {
            var ejecutivo = await _service.ActualizarEjecutivoAsync(idEjecutivoRegion, request, User.GetUserId(), ct);
            if (ejecutivo is null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"Asignación {idEjecutivoRegion} no encontrada.",
                });
            }

            return Ok(new ApiResponse<EjecutivoRegionDto>
            {
                Success = true,
                Message = "Asignación actualizada exitosamente.",
                Data = ejecutivo,
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("ejecutivos-suplentes")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(
        Summary = "Listar ejecutivos suplentes",
        Description = "Retorna los usuarios que pueden cubrir como ejecutivo de ventas. Gerencia/región nulas significan cobertura total; el motor los usa solo cuando no hay ejecutivo primario.")]
    [SwaggerResponse(200, "Suplentes obtenidos", typeof(ApiResponse<List<EjecutivoSuplenteDto>>))]
    public async Task<IActionResult> GetEjecutivosSuplentes(
        [FromQuery] string? busqueda,
        [FromQuery] int? idTipoGerencia,
        [FromQuery] bool? soloActivos,
        CancellationToken ct)
    {
        var suplentes = await _service.GetEjecutivosSuplentesAsync(
            busqueda, idTipoGerencia, soloActivos, ct);
        return Ok(new ApiResponse<List<EjecutivoSuplenteDto>>
        {
            Success = true,
            Message = "Ejecutivos suplentes obtenidos exitosamente.",
            Data = suplentes,
        });
    }

    [HttpPost("ejecutivos-suplentes")]
    [HasPermission(Permissions.EducacionMedica.ConfiguracionGestionar)]
    [SwaggerOperation(
        Summary = "Crear ejecutivo suplente",
        Description = "Agrega un usuario a la lista de suplentes. Si se indica región, la gerencia se deriva de ella; NULL = todas.")]
    [SwaggerResponse(201, "Suplente creado", typeof(ApiResponse<EjecutivoSuplenteDto>))]
    [SwaggerResponse(409, "Validación fallida")]
    public async Task<IActionResult> CrearEjecutivoSuplente(
        [FromBody] CrearEjecutivoSuplenteRequest request,
        CancellationToken ct)
    {
        try
        {
            var suplente = await _service.CrearEjecutivoSuplenteAsync(request, User.GetUserId(), ct);
            return CreatedAtAction(nameof(GetEjecutivosSuplentes), new ApiResponse<EjecutivoSuplenteDto>
            {
                Success = true,
                Message = "Ejecutivo suplente creado exitosamente.",
                Data = suplente,
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("ejecutivos-suplentes/{idEjecutivoSuplente:int}")]
    [HasPermission(Permissions.EducacionMedica.ConfiguracionGestionar)]
    [SwaggerOperation(
        Summary = "Actualizar ejecutivo suplente",
        Description = "Cambia la cobertura (gerencia/región) o el estado del suplente.")]
    [SwaggerResponse(200, "Suplente actualizado", typeof(ApiResponse<EjecutivoSuplenteDto>))]
    [SwaggerResponse(404, "Suplente no encontrado")]
    [SwaggerResponse(409, "Validación fallida")]
    public async Task<IActionResult> ActualizarEjecutivoSuplente(
        int idEjecutivoSuplente,
        [FromBody] ActualizarEjecutivoSuplenteRequest request,
        CancellationToken ct)
    {
        try
        {
            var suplente = await _service.ActualizarEjecutivoSuplenteAsync(
                idEjecutivoSuplente, request, User.GetUserId(), ct);
            if (suplente is null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"Ejecutivo suplente {idEjecutivoSuplente} no encontrado.",
                });
            }

            return Ok(new ApiResponse<EjecutivoSuplenteDto>
            {
                Success = true,
                Message = "Ejecutivo suplente actualizado exitosamente.",
                Data = suplente,
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("especialistas")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(
        Summary = "Listar especialistas y sus gerencias",
        Description = "Retorna los especialistas agrupados por usuario, con sus gerencias permitidas y región preferida opcional.")]
    [SwaggerResponse(200, "Especialistas obtenidos", typeof(ApiResponse<List<EspecialistaDto>>))]
    public async Task<IActionResult> GetEspecialistas(
        [FromQuery] string? busqueda,
        [FromQuery] bool? soloActivos,
        CancellationToken ct)
    {
        var especialistas = await _service.GetEspecialistasAsync(busqueda, soloActivos, ct);
        return Ok(new ApiResponse<List<EspecialistaDto>>
        {
            Success = true,
            Message = "Especialistas obtenidos exitosamente.",
            Data = especialistas,
        });
    }

    [HttpPut("especialistas/{idUsuario:int}")]
    [HasPermission(Permissions.EducacionMedica.ConfiguracionGestionar)]
    [SwaggerOperation(
        Summary = "Guardar especialista",
        Description = "Guarda las gerencias permitidas y la región preferida de un especialista. Desactiva las gerencias/regiones que ya no estén en la solicitud.")]
    [SwaggerResponse(200, "Especialista guardado", typeof(ApiResponse<EspecialistaDto>))]
    [SwaggerResponse(409, "Validación fallida")]
    public async Task<IActionResult> GuardarEspecialista(
        int idUsuario,
        [FromBody] GuardarEspecialistaRequest request,
        CancellationToken ct)
    {
        try
        {
            request.IdUsuario = idUsuario;
            var especialista = await _service.GuardarEspecialistaAsync(request, User.GetUserId(), ct);
            return Ok(new ApiResponse<EspecialistaDto>
            {
                Success = true,
                Message = "Especialista guardado exitosamente.",
                Data = especialista,
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }
}
