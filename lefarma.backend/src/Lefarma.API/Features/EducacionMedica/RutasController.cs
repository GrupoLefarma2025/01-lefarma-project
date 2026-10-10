using System.Security.Claims;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
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
    [HasPermission(Permissions.EducacionMedica.RutasVer)]
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
    [HasPermission(Permissions.EducacionMedica.RutasGestionar)]
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

    [HttpGet("selecciones-mensuales/{idSeleccionMensual:int}/rutas/version")]
    [HasPermission(Permissions.EducacionMedica.RutasVer)]
    [SwaggerOperation(
        Summary = "Estado de autorización de la versión de rutas",
        Description = "Devuelve la versión activa (o la indicada) con su paso actual, si es editable y las acciones disponibles para el usuario.")]
    [SwaggerResponse(200, "Versión de rutas", typeof(ApiResponse<RutaVersionDto>))]
    public async Task<IActionResult> GetVersion(int idSeleccionMensual, [FromQuery] int? version, CancellationToken ct)
    {
        var dto = await _service.GetVersionInfoAsync(idSeleccionMensual, version, GetUserId(), ct);
        return Ok(new ApiResponse<RutaVersionDto?>
        {
            Success = true,
            Message = "Versión de rutas obtenida.",
            Data = dto
        });
    }

    [HttpPost("rutas/version/{idRutaVersion:int}/firmar")]
    [HasPermission(Permissions.EducacionMedica.RutasVer)]
    [SwaggerOperation(
        Summary = "Ejecutar una acción del workflow sobre la versión de rutas",
        Description = "Enviar a autorización (planificador), firmar GV → CA → DC, devolver a Draft o cancelar, según las acciones disponibles del paso actual.")]
    [SwaggerResponse(200, "Acción registrada", typeof(ApiResponse<RutaVersionDto>))]
    [SwaggerResponse(409, "Acción no disponible para el usuario o estado inválido")]
    public async Task<IActionResult> FirmarVersion(int idRutaVersion, [FromBody] FirmarWorkflowRequest request, CancellationToken ct)
    {
        try
        {
            var dto = await _service.FirmarVersionAsync(idRutaVersion, request, GetUserId(), ct);
            return Ok(new ApiResponse<RutaVersionDto>
            {
                Success = true,
                Message = "Acción registrada exitosamente.",
                Data = dto
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("rutas/version/{idRutaVersion:int}/historial")]
    [HasPermission(Permissions.EducacionMedica.RutasVer)]
    [SwaggerOperation(Summary = "Historial de workflow de la versión de rutas (bitácora)")]
    [SwaggerResponse(200, "Historial", typeof(ApiResponse<IEnumerable<HistorialWorkflowItemResponse>>))]
    public async Task<IActionResult> GetHistorialVersion(int idRutaVersion, CancellationToken ct)
    {
        var resultado = await _service.GetHistorialVersionAsync(idRutaVersion, ct);
        if (resultado.IsError)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = resultado.FirstError.Description });
        }

        return Ok(new ApiResponse<IEnumerable<HistorialWorkflowItemResponse>>
        {
            Success = true,
            Message = "Historial obtenido.",
            Data = resultado.Value
        });
    }

    [HttpPost("selecciones-mensuales/{idSeleccionMensual:int}/rutas/cancelar")]
    [HasPermission(Permissions.EducacionMedica.RutasGestionar)]
    [SwaggerOperation(
        Summary = "Cancelar la versión activa de rutas",
        Description = "Pone la versión activa (draft, en autorización o confirmada) en Cancelada; habilita regenerar una nueva propuesta. Requiere motivo.")]
    [SwaggerResponse(200, "Rutas canceladas", typeof(ApiResponse<List<RutaDto>>))]
    [SwaggerResponse(409, "No hay versiones por cancelar")]
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
    [HasPermission(Permissions.EducacionMedica.RutasGestionar)]
    [SwaggerOperation(
        Summary = "Mover visita (drag & drop)",
        Description = "Cambia fecha/orden de una visita del draft revalidando: día laboral, 3/día, 8/semana, posición única y no duplicar el hospital en otra ruta de la versión actual. Con la versión Cerrada exige permiso rutas.puede_ajustar + motivo: la capacidad avisa (no bloquea) y el cambio queda auditado en ajustes_post_cierre (ADR-00010).")]
    [SwaggerResponse(200, "Visita movida", typeof(ApiResponse<RutaVisitaDto>))]
    [SwaggerResponse(409, "Validación de capacidad, unicidad o permiso fallido")]
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

    [HttpPut("rutas/{idRuta:int}/visitas/{idRutaVisita:int}/horas")]
    [HasPermission(Permissions.EducacionMedica.RutasGestionar)]
    [SwaggerOperation(
        Summary = "Editar horas de la visita",
        Description = "Actualiza hora_salida/hora_llegada. En Creada es edición normal; con la versión Cerrada exige permiso rutas.puede_ajustar + motivo y queda auditado (EDITAR_HORAS; ADR-00010).")]
    [SwaggerResponse(200, "Horas actualizadas", typeof(ApiResponse<RutaVisitaDto>))]
    [SwaggerResponse(409, "Validación o permiso fallido")]
    public async Task<IActionResult> EditarHorasVisita(
        int idRuta,
        int idRutaVisita,
        [FromBody] EditarHorasVisitaRequest request,
        CancellationToken ct)
    {
        try
        {
            var visita = await _service.EditarHorasVisitaAsync(idRuta, idRutaVisita, request, GetUserId(), ct);
            return Ok(new ApiResponse<RutaVisitaDto>
            {
                Success = true,
                Message = "Horas de la visita actualizadas exitosamente.",
                Data = visita
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("rutas/{idRuta:int}/visitas")]
    [HasPermission(Permissions.EducacionMedica.RutasGestionar)]
    [SwaggerOperation(
        Summary = "Agregar visita manual",
        Description = "Agrega un hospital de la selección al draft con fecha y orden, con las mismas validaciones de capacidad. Con la versión Cerrada exige permiso rutas.puede_ajustar + motivo (ALTA_VISITA; ADR-00010).")]
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

    [HttpPost("selecciones-mensuales/{idSeleccionMensual:int}/rutas/visitas-extraordinarias")]
    [HasPermission(Permissions.EducacionMedica.RutasVer)]
    [SwaggerOperation(
        Summary = "Agregar visita extraordinaria",
        Description = "Alta de visita a un hospital del catálogo (FOR-002) fuera de la selección autorizada, en la versión activa Cerrada, con get-or-create de la ruta del equipo. Exige rutas.puede_ajustar y motivo; queda auditada (ALTA_VISITA; ADR-00011).")]
    [SwaggerResponse(200, "Visita extraordinaria agregada", typeof(ApiResponse<RutaVisitaDto>))]
    [SwaggerResponse(409, "Validación o permiso fallido")]
    public async Task<IActionResult> AgregarVisitaExtraordinaria(
        int idSeleccionMensual,
        [FromBody] VisitaExtraordinariaRequest request,
        CancellationToken ct)
    {
        try
        {
            var visita = await _service.AgregarVisitaExtraordinariaAsync(idSeleccionMensual, request, GetUserId(), ct);
            return Ok(new ApiResponse<RutaVisitaDto>
            {
                Success = true,
                Message = "Visita extraordinaria agregada exitosamente.",
                Data = visita
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpDelete("rutas/{idRuta:int}/visitas/{idRutaVisita:int}")]
    [HasPermission(Permissions.EducacionMedica.RutasGestionar)]
    [SwaggerOperation(
        Summary = "Quitar visita del draft",
        Description = "Quita la visita del draft; el hospital vuelve a quedar sin planificar (la cobertura de confirmación lo detectará). Con la versión Cerrada exige permiso rutas.puede_ajustar + motivo (BAJA_VISITA; ADR-00010).")]
    [SwaggerResponse(200, "Visita quitada")]
    [SwaggerResponse(404, "Visita no encontrada")]
    public async Task<IActionResult> QuitarVisita(int idRuta, int idRutaVisita, [FromQuery] string? motivo, CancellationToken ct)
    {
        try
        {
            await _service.QuitarVisitaAsync(idRuta, idRutaVisita, motivo, GetUserId(), ct);
            return Ok(new ApiResponse<object> { Success = true, Message = "Visita quitada exitosamente." });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("talleres/asignaciones")]
    [HasPermission(Permissions.EducacionMedica.TalleresCapturar)]
    [SwaggerOperation(
        Summary = "Asignación del ejecutivo (mis hospitales del mes)",
        Description = "Retorna las visitas confirmadas de los equipos del usuario autenticado (EV o EP), en selecciones vigentes o próximas (excluye las vencidas).")]
    [SwaggerResponse(200, "Asignaciones obtenidas", typeof(ApiResponse<List<AsignacionDto>>))]
    public async Task<IActionResult> GetAsignaciones(CancellationToken ct)
    {
        var asignaciones = await _service.GetAsignacionesAsync(GetUserId(), ct);
        return Ok(new ApiResponse<List<AsignacionDto>>
        {
            Success = true,
            Message = "Asignaciones obtenidas exitosamente.",
            Data = asignaciones
        });
    }

    [HttpGet("talleres/hospitales-elegibles")]
    [HasPermission(Permissions.EducacionMedica.TalleresCapturarAsistida)]
    [SwaggerOperation(
        Summary = "Hospitales elegibles del equipo (captura asistida)",
        Description = "Hospitales de la selección del equipo indicado cuya ruta está Cerrada, con snapshots para el buscador del TallerFormModal (ADR-00011). Exige talleres.puede_capturar_asistida.")]
    [SwaggerResponse(200, "Hospitales elegibles", typeof(ApiResponse<List<HospitalElegibleDto>>))]
    public async Task<IActionResult> GetHospitalesElegibles([FromQuery] int idEquipo, CancellationToken ct)
    {
        var hospitales = await _service.GetHospitalesElegiblesAsync(idEquipo, ct);
        return Ok(new ApiResponse<List<HospitalElegibleDto>>
        {
            Success = true,
            Message = "Hospitales elegibles obtenidos exitosamente.",
            Data = hospitales
        });
    }

    private int GetUserId() =>
        int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
}
