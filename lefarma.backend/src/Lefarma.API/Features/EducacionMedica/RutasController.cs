using System.Security.Claims;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class RutasController : ControllerBase
{
    private readonly IRutasService _service;

    public RutasController(IRutasService service)
    {
        _service = service;
    }

    [HttpGet("selecciones-mensuales/{idSeleccionMensual:int}/rutas")]
    [SwaggerOperation(
        Summary = "Obtener rutas de la selección",
        Description = "Retorna las rutas de la versión indicada (default: la más reciente) con sus visitas.")]
    [SwaggerResponse(200, "Rutas obtenidas", typeof(ApiResponse<List<RutaDto>>))]
    public async Task<IActionResult> GetBySeleccion(
        int idSeleccionMensual,
        [FromQuery] int? version,
        CancellationToken ct)
    {
        var rutas = await _service.GetBySeleccionAsync(idSeleccionMensual, version, ct);
        return Ok(new ApiResponse<List<RutaDto>>
        {
            Success = true,
            Message = "Rutas obtenidas exitosamente.",
            Data = rutas
        });
    }

    [HttpPost("selecciones-mensuales/{idSeleccionMensual:int}/rutas/generar")]
    [SwaggerOperation(
        Summary = "Generar propuesta de rutas (draft)",
        Description = "Calendariza los hospitales autorizados: parte de las regiones y equipos ya asignados en la selección (sin re-clusterizar ni reasignar) y crea la versión N+1 archivando el draft anterior. Body opcional { estrategia }: 'ciudad' (default, viaja por ciudades sin fragmentarlas entre días) o 'centroide' (compacta los días al máximo ordenando por distancia al centroide regional aunque mezclen ciudades). Requiere selección Autorizada. Distribuye en días Lun–Vie (máx. 3/día, 8/semana) y valida viajes foráneos (≤3/mes por equipo).")]
    [SwaggerResponse(200, "Propuesta generada", typeof(ApiResponse<GenerarRutasResponse>))]
    [SwaggerResponse(409, "Estado inválido, capacidad insuficiente o rutas confirmadas pendientes")]
    public async Task<IActionResult> Generar(
        int idSeleccionMensual,
        [FromBody] GenerarRutasRequest? request,
        CancellationToken ct)
    {
        try
        {
            var resultado = await _service.GenerarAsync(idSeleccionMensual, GetUserId(), request, ct);
            return Ok(new ApiResponse<GenerarRutasResponse>
            {
                Success = true,
                Message = "Propuesta de rutas generada exitosamente.",
                Data = resultado
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("selecciones-mensuales/{idSeleccionMensual:int}/rutas/confirmar")]
    [SwaggerOperation(
        Summary = "Confirmar rutas (draft → confirmada)",
        Description = "Valida cobertura 100% de los hospitales de la selección y confirma todas las rutas del draft actual; publica las asignaciones que alimenta 'mis hospitales del mes'.")]
    [SwaggerResponse(200, "Rutas confirmadas", typeof(ApiResponse<List<RutaDto>>))]
    [SwaggerResponse(409, "Sin draft o cobertura incompleta")]
    public async Task<IActionResult> Confirmar(int idSeleccionMensual, CancellationToken ct)
    {
        try
        {
            var rutas = await _service.ConfirmarAsync(idSeleccionMensual, GetUserId(), ct);
            return Ok(new ApiResponse<List<RutaDto>>
            {
                Success = true,
                Message = "Rutas confirmadas exitosamente.",
                Data = rutas
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("selecciones-mensuales/{idSeleccionMensual:int}/rutas/cancelar")]
    [SwaggerOperation(
        Summary = "Cancelar rutas confirmadas",
        Description = "Confirmada → Cancelada (flujo de cambio post-confirmación); habilita regenerar una nueva propuesta. Requiere motivo.")]
    [SwaggerResponse(200, "Rutas canceladas", typeof(ApiResponse<List<RutaDto>>))]
    [SwaggerResponse(409, "No hay rutas confirmadas")]
    public async Task<IActionResult> Cancelar(
        int idSeleccionMensual,
        [FromBody] CancelarRutasRequest request,
        CancellationToken ct)
    {
        try
        {
            var rutas = await _service.CancelarAsync(idSeleccionMensual, request, GetUserId(), ct);
            return Ok(new ApiResponse<List<RutaDto>>
            {
                Success = true,
                Message = "Rutas canceladas exitosamente.",
                Data = rutas
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("rutas/{idRuta:int}/visitas/{idRutaVisita:int}/mover")]
    [SwaggerOperation(
        Summary = "Mover visita (drag & drop)",
        Description = "Cambia fecha/orden de una visita del draft revalidando: día laboral, 3/día, 8/semana, posición única y no duplicar el hospital en otra ruta de la versión actual.")]
    [SwaggerResponse(200, "Visita movida", typeof(ApiResponse<RutaVisitaDto>))]
    [SwaggerResponse(409, "Validación de capacidad o unicidad fallida")]
    public async Task<IActionResult> MoverVisita(
        int idRuta,
        int idRutaVisita,
        [FromBody] MoverVisitaRequest request,
        CancellationToken ct)
    {
        try
        {
            var visita = await _service.MoverVisitaAsync(idRuta, idRutaVisita, request, GetUserId(), ct);
            return Ok(new ApiResponse<RutaVisitaDto>
            {
                Success = true,
                Message = "Visita movida exitosamente.",
                Data = visita
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("rutas/{idRuta:int}/visitas")]
    [SwaggerOperation(
        Summary = "Agregar visita manual",
        Description = "Agrega un hospital de la selección al draft con fecha y orden, con las mismas validaciones de capacidad.")]
    [SwaggerResponse(200, "Visita agregada", typeof(ApiResponse<RutaVisitaDto>))]
    [SwaggerResponse(409, "Validación fallida")]
    public async Task<IActionResult> AgregarVisita(
        int idRuta,
        [FromBody] AgregarVisitaRequest request,
        CancellationToken ct)
    {
        try
        {
            var visita = await _service.AgregarVisitaAsync(idRuta, request, GetUserId(), ct);
            return Ok(new ApiResponse<RutaVisitaDto>
            {
                Success = true,
                Message = "Visita agregada exitosamente.",
                Data = visita
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpDelete("rutas/{idRuta:int}/visitas/{idRutaVisita:int}")]
    [SwaggerOperation(
        Summary = "Quitar visita del draft",
        Description = "Quita la visita del draft; el hospital vuelve a quedar sin planificar (la cobertura de confirmación lo detectará).")]
    [SwaggerResponse(200, "Visita quitada")]
    [SwaggerResponse(404, "Visita no encontrada")]
    public async Task<IActionResult> QuitarVisita(int idRuta, int idRutaVisita, CancellationToken ct)
    {
        try
        {
            await _service.QuitarVisitaAsync(idRuta, idRutaVisita, GetUserId(), ct);
            return Ok(new ApiResponse<object> { Success = true, Message = "Visita quitada exitosamente." });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("talleres/asignaciones/{idUsuario:int}")]
    [SwaggerOperation(
        Summary = "Asignación del ejecutivo (mis hospitales del mes)",
        Description = "Retorna las visitas confirmadas de los equipos donde el usuario es EV o EP, en selecciones activas.")]
    [SwaggerResponse(200, "Asignaciones obtenidas", typeof(ApiResponse<List<AsignacionDto>>))]
    public async Task<IActionResult> GetAsignaciones(int idUsuario, CancellationToken ct)
    {
        var asignaciones = await _service.GetAsignacionesAsync(idUsuario, ct);
        return Ok(new ApiResponse<List<AsignacionDto>>
        {
            Success = true,
            Message = "Asignaciones obtenidas exitosamente.",
            Data = asignaciones
        });
    }

    private int GetUserId() =>
        int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
}
