using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/equipos-pareo")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class EquiposPareoController : ControllerBase
{
    private readonly IEquipoPareoService _service;

    public EquiposPareoController(IEquipoPareoService service)
    {
        _service = service;
    }

    [HttpGet]
    [SwaggerOperation(
        Summary = "Obtener equipos de pareo",
        Description = "Retorna los equipos de pareo (1 EV + 1 EP) con nombres desde Asokam y sus regiones actuales en selecciones activas. Filtros: estado (vigentes/inactivos/todos), búsqueda por nombre de integrante, usuario específico y rango de vigencia.")]
    [SwaggerResponse(200, "Equipos obtenidos", typeof(ApiResponse<List<EquipoPareoDto>>))]
    public async Task<IActionResult> GetAll(
        [FromQuery] bool? soloVigentes,
        [FromQuery] string? busqueda,
        [FromQuery] int? idUsuario,
        [FromQuery] DateOnly? fechaInicio,
        [FromQuery] DateOnly? fechaFin,
        CancellationToken ct)
    {
        var filtro = new Domain.Interfaces.EducacionMedica.EquipoPareoFiltro
        {
            SoloVigentes = soloVigentes,
            Busqueda = busqueda,
            IdUsuario = idUsuario,
            FechaInicio = fechaInicio,
            FechaFin = fechaFin,
        };

        var equipos = await _service.GetAllAsync(filtro, ct);
        return Ok(new ApiResponse<List<EquipoPareoDto>>
        {
            Success = true,
            Message = "Equipos de pareo obtenidos exitosamente.",
            Data = equipos
        });
    }

    [HttpGet("{idEquipo:int}/operacion")]
    [SwaggerOperation(
        Summary = "Operación histórica del equipo",
        Description = "Retorna las selecciones, regiones y rutas en las que el equipo ha participado, con conteo de visitas confirmadas.")]
    [SwaggerResponse(200, "Operación obtenida", typeof(ApiResponse<EquipoOperacionDto>))]
    [SwaggerResponse(404, "Equipo no encontrado")]
    public async Task<IActionResult> GetOperacion(int idEquipo, CancellationToken ct)
    {
        var operacion = await _service.ObtenerOperacionAsync(idEquipo, ct);
        if (operacion is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = $"Equipo {idEquipo} no encontrado."
            });
        }

        return Ok(new ApiResponse<EquipoOperacionDto>
        {
            Success = true,
            Message = "Operación del equipo obtenida exitosamente.",
            Data = operacion
        });
    }

    [HttpPost]
    [SwaggerOperation(
        Summary = "Crear equipo de pareo",
        Description = "Empareja 1 Ejecutivo de Ventas + 1 Especialista de Producto. Valida que ambos existan en Asokam y que ninguno pertenezca a otro equipo activo (exclusividad).")]
    [SwaggerResponse(201, "Equipo creado", typeof(ApiResponse<EquipoPareoDto>))]
    [SwaggerResponse(409, "Validación de exclusividad o usuarios fallida")]
    public async Task<IActionResult> Create([FromBody] CrearEquipoPareoRequest request, CancellationToken ct)
    {
        try
        {
            var idUsuario = GetUserId();
            var equipo = await _service.CreateAsync(request, idUsuario, ct);

            return CreatedAtAction(nameof(GetAll), new ApiResponse<EquipoPareoDto>
            {
                Success = true,
                Message = "Equipo de pareo creado exitosamente.",
                Data = equipo
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    [HttpPut("{idEquipo}/region")]
    [SwaggerOperation(
        Summary = "Asignar o cambiar la región del equipo",
        Description = "Asigna la región fija del equipo (1 equipo = 1 región). Valida que la región exista, esté activa y no pertenezca a otro equipo activo.")]
    [SwaggerResponse(200, "Región asignada", typeof(ApiResponse<EquipoPareoDto>))]
    [SwaggerResponse(404, "Equipo no encontrado")]
    [SwaggerResponse(409, "Región inválida o asignada a otro equipo activo")]
    public async Task<IActionResult> AsignarRegion(int idEquipo, [FromBody] AsignarRegionEquipoRequest request, CancellationToken ct)
    {
        try
        {
            var idUsuario = GetUserId();
            var equipo = await _service.AsignarRegionAsync(idEquipo, request, idUsuario, ct);
            if (equipo is null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"Equipo {idEquipo} no encontrado."
                });
            }

            return Ok(new ApiResponse<EquipoPareoDto>
            {
                Success = true,
                Message = "Región del equipo actualizada exitosamente.",
                Data = equipo
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    [HttpPut("{idEquipo}/desactivar")]
    [SwaggerOperation(
        Summary = "Desactivar equipo de pareo",
        Description = "Cierra la vigencia del equipo (fecha_fin = hoy, activo = false). El histórico conserva la pareja que existía en cada planificación.")]
    [SwaggerResponse(200, "Equipo desactivado", typeof(ApiResponse<EquipoPareoDto>))]
    [SwaggerResponse(404, "Equipo no encontrado")]
    public async Task<IActionResult> Desactivar(int idEquipo, CancellationToken ct)
    {
        var idUsuario = GetUserId();
        var equipo = await _service.DesactivarAsync(idEquipo, idUsuario, ct);
        if (equipo is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = $"Equipo {idEquipo} no encontrado."
            });
        }

        return Ok(new ApiResponse<EquipoPareoDto>
        {
            Success = true,
            Message = "Equipo desactivado exitosamente.",
            Data = equipo
        });
    }

    private int GetUserId() =>
        int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
}
