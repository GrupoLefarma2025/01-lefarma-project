using System.Security.Claims;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
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
    private readonly ITallerImparticionService _imparticionService;

    public TalleresController(ITalleresService service, ITallerImparticionService imparticionService)
    {
        _service = service;
        _imparticionService = imparticionService;
    }

    [HttpGet("mis-talleres")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
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
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(
        Summary = "Capturar taller (FOR-005)",
        Description = "Captura un taller sobre un hospital de la selección. Valida que el usuario sea EV/EP del equipo asignado a la región; con talleres.puede_capturar_asistida el CEM captura a nombre de otro equipo (idEquipo explícito; ADR-00011). Modo extraordinario (esExtraordinario + idHospital + idEquipo + motivoExtraordinario): hospital del catálogo fuera de la selección, exige talleres.puede_capturar_extraordinarios y nace Programado. Hace get-or-create de las matrices.")]
    [SwaggerResponse(200, "Taller capturado", typeof(ApiResponse<TallerDto>))]
    [SwaggerResponse(409, "Elegibilidad, permiso o candado de edición fallido")]
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
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(
        Summary = "Editar taller",
        Description = "Edición normal: solo con la matriz general en estado Creada (paso inicial) y la individual sin bloquear, por el EV/EP del equipo. Ajuste post-cierre (ADR-00010): con el taller Autorizado/Programado exige talleres.puede_ajustar + motivo; solo fecha/hora/lugar/participantes, con límite de días y sincronización de la visita de la ruta activa.")]
    [SwaggerResponse(200, "Taller actualizado", typeof(ApiResponse<TallerDto>))]
    [SwaggerResponse(409, "Candado de edición, permiso o límite fallido")]
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
    [HasPermission(Permissions.EducacionMedica.TalleresCapturar)]
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
    [HasPermission(Permissions.EducacionMedica.TalleresCapturar)]
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
    [HasPermission(Permissions.EducacionMedica.TalleresRevisar)]
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

    // ----- Solicitudes de cambio del equipo (ADR-00010, decisiones 13-15) -----

    [HttpPost("{idTaller:int}/solicitudes-cambio")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(
        Summary = "Solicitar cambio del taller (equipo)",
        Description = "Canal del equipo cuando el candado está puesto o la matriz salió de captura: guarda el diff (fecha/hora/lugar/participantes) + motivo en datos_json y notifica al CEM (in-app + correo). El CEM la resuelve desde la Matriz General.")]
    [SwaggerResponse(200, "Solicitud creada", typeof(ApiResponse<TallerSolicitudCambioDto>))]
    [SwaggerResponse(409, "Estado inválido, solicitud duplicada o sin cambios")]
    public async Task<IActionResult> CrearSolicitudCambio(int idTaller, [FromBody] CrearSolicitudCambioRequest request, CancellationToken ct)
    {
        try
        {
            var solicitud = await _service.CrearSolicitudCambioAsync(idTaller, request, GetUserId(), ct);
            return Ok(new ApiResponse<TallerSolicitudCambioDto>
            {
                Success = true,
                Message = "Solicitud de cambio creada exitosamente.",
                Data = solicitud
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("solicitudes-cambio/{idSolicitud:int}/resolver")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(
        Summary = "Resolver solicitud de cambio (CEM)",
        Description = "Aprobar aplica el ajuste con la misma lógica del ADR-00010 (límite, sincronización de ruta, ajustes_post_cierre); rechazar solo registra el motivo. Notifica al solicitante (in-app + correo). Exige talleres.puede_ajustar.")]
    [SwaggerResponse(200, "Solicitud resuelta", typeof(ApiResponse<TallerSolicitudCambioDto>))]
    [SwaggerResponse(409, "Sin permiso, ya resuelta o ajuste rechazado")]
    public async Task<IActionResult> ResolverSolicitudCambio(int idSolicitud, [FromBody] ResolverSolicitudCambioRequest request, CancellationToken ct)
    {
        try
        {
            var solicitud = await _service.ResolverSolicitudCambioAsync(idSolicitud, request, GetUserId(), ct);
            return Ok(new ApiResponse<TallerSolicitudCambioDto>
            {
                Success = true,
                Message = request.Aprobar
                    ? "Solicitud aprobada y ajuste aplicado exitosamente."
                    : "Solicitud rechazada exitosamente.",
                Data = solicitud
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("{idTaller:int}/solicitudes-cambio")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(Summary = "Solicitudes de cambio del taller (historial de estados de la solicitud)")]
    [SwaggerResponse(200, "Solicitudes", typeof(ApiResponse<List<TallerSolicitudCambioDto>>))]
    public async Task<IActionResult> GetSolicitudesCambio(int idTaller, CancellationToken ct)
    {
        try
        {
            var solicitudes = await _service.GetSolicitudesCambioAsync(idTaller, ct);
            return Ok(new ApiResponse<List<TallerSolicitudCambioDto>>
            {
                Success = true,
                Message = "Solicitudes obtenidas exitosamente.",
                Data = solicitudes
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    // ----- Impartición (ADR-00008): material, asistencias, evidencias, estado, historial e imprimibles -----

    [HttpGet("{idTaller:int}/material")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(
        Summary = "Material del taller (FOR-007)",
        Description = "Devuelve la entrega de material registrada por el AEM y la confirmación del EV (firma + fecha + usuario), si existe.")]
    [SwaggerResponse(200, "Material del taller", typeof(ApiResponse<TallerMaterialDto?>))]
    [SwaggerResponse(409, "Taller no encontrado")]
    public async Task<IActionResult> GetMaterial(int idTaller, CancellationToken ct)
    {
        try
        {
            var material = await _imparticionService.GetMaterialAsync(idTaller, ct);
            return Ok(new ApiResponse<TallerMaterialDto?>
            {
                Success = true,
                Message = "Material obtenido exitosamente.",
                Data = material
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{idTaller:int}/material")]
    [HasPermission(Permissions.EducacionMedica.MaterialesGestionar)]
    [SwaggerOperation(
        Summary = "Registrar/editar entrega de material (AEM)",
        Description = "Upsert 1:1 del paquete FOR-007 (producto/cantidad, checklist y fecha de entrega) por el Auxiliar Administrativo de Educación Médica.")]
    [SwaggerResponse(200, "Material guardado", typeof(ApiResponse<TallerMaterialDto>))]
    [SwaggerResponse(409, "Taller no encontrado")]
    public async Task<IActionResult> GuardarMaterial(int idTaller, [FromBody] GuardarTallerMaterialRequest request, CancellationToken ct)
    {
        try
        {
            var material = await _imparticionService.GuardarMaterialAsync(idTaller, request, GetUserId(), ct);
            return Ok(new ApiResponse<TallerMaterialDto>
            {
                Success = true,
                Message = "Material guardado exitosamente.",
                Data = material
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("{idTaller:int}/material/confirmar")]
    [HasPermission(Permissions.EducacionMedica.MaterialesConfirmar)]
    [SwaggerOperation(
        Summary = "Confirmar recepción de material (EV)",
        Description = "El Ejecutivo de Ventas del equipo confirma la recepción del FOR-007: estampa su firma digital de perfil + fecha + usuario (patrón bitácora).")]
    [SwaggerResponse(200, "Recepción confirmada", typeof(ApiResponse<TallerMaterialDto>))]
    [SwaggerResponse(409, "Sin material, sin firma o ya confirmada")]
    public async Task<IActionResult> ConfirmarMaterial(int idTaller, [FromBody] ConfirmarMaterialRequest request, CancellationToken ct)
    {
        try
        {
            var material = await _imparticionService.ConfirmarMaterialAsync(idTaller, request, GetUserId(), ct);
            return Ok(new ApiResponse<TallerMaterialDto>
            {
                Success = true,
                Message = "Recepción del material confirmada exitosamente.",
                Data = material
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("{idTaller:int}/asistencias")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(Summary = "Lista de asistencia del taller (FOR-008)")]
    [SwaggerResponse(200, "Asistencias", typeof(ApiResponse<List<TallerAsistenciaDto>>))]
    public async Task<IActionResult> GetAsistencias(int idTaller, CancellationToken ct)
    {
        try
        {
            var asistencias = await _imparticionService.GetAsistenciasAsync(idTaller, ct);
            return Ok(new ApiResponse<List<TallerAsistenciaDto>>
            {
                Success = true,
                Message = "Asistencias obtenidas exitosamente.",
                Data = asistencias
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("{idTaller:int}/asistencias")]
    [HasPermission(Permissions.EducacionMedica.TalleresCapturar)]
    [SwaggerOperation(
        Summary = "Capturar asistencia (EV/EP)",
        Description = "Transcribe la lista FOR-008 llenada a mano: máximo 20 asistentes, número único por taller, firma_url por asistente (servicio de archivos).")]
    [SwaggerResponse(200, "Asistencia capturada", typeof(ApiResponse<TallerAsistenciaDto>))]
    [SwaggerResponse(409, "Límite, número duplicado o ventana de captura")]
    public async Task<IActionResult> CrearAsistencia(int idTaller, [FromBody] GuardarTallerAsistenciaRequest request, CancellationToken ct)
    {
        try
        {
            var asistencia = await _imparticionService.CrearAsistenciaAsync(idTaller, request, GetUserId(), ct);
            return Ok(new ApiResponse<TallerAsistenciaDto>
            {
                Success = true,
                Message = "Asistencia capturada exitosamente.",
                Data = asistencia
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{idTaller:int}/asistencias/{idAsistencia:int}")]
    [HasPermission(Permissions.EducacionMedica.TalleresCapturar)]
    [SwaggerOperation(Summary = "Editar asistencia (EV/EP)")]
    [SwaggerResponse(200, "Asistencia actualizada", typeof(ApiResponse<TallerAsistenciaDto>))]
    [SwaggerResponse(409, "Número duplicado o ventana de captura")]
    public async Task<IActionResult> ActualizarAsistencia(int idTaller, int idAsistencia, [FromBody] GuardarTallerAsistenciaRequest request, CancellationToken ct)
    {
        try
        {
            var asistencia = await _imparticionService.ActualizarAsistenciaAsync(idTaller, idAsistencia, request, GetUserId(), ct);
            return Ok(new ApiResponse<TallerAsistenciaDto>
            {
                Success = true,
                Message = "Asistencia actualizada exitosamente.",
                Data = asistencia
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpDelete("{idTaller:int}/asistencias/{idAsistencia:int}")]
    [HasPermission(Permissions.EducacionMedica.TalleresCapturar)]
    [SwaggerOperation(Summary = "Eliminar asistencia (borrado físico; EV/EP)")]
    [SwaggerResponse(200, "Asistencia eliminada")]
    [SwaggerResponse(409, "Ventana de captura")]
    public async Task<IActionResult> EliminarAsistencia(int idTaller, int idAsistencia, CancellationToken ct)
    {
        try
        {
            await _imparticionService.EliminarAsistenciaAsync(idTaller, idAsistencia, GetUserId(), ct);
            return Ok(new ApiResponse<object> { Success = true, Message = "Asistencia eliminada exitosamente." });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("{idTaller:int}/evidencias")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(Summary = "Evidencias del taller")]
    [SwaggerResponse(200, "Evidencias", typeof(ApiResponse<List<TallerEvidenciaDto>>))]
    public async Task<IActionResult> GetEvidencias(int idTaller, CancellationToken ct)
    {
        try
        {
            var evidencias = await _imparticionService.GetEvidenciasAsync(idTaller, ct);
            return Ok(new ApiResponse<List<TallerEvidenciaDto>>
            {
                Success = true,
                Message = "Evidencias obtenidas exitosamente.",
                Data = evidencias
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("{idTaller:int}/evidencias")]
    [HasPermission(Permissions.EducacionMedica.EvidenciasGestionar)]
    [SwaggerOperation(
        Summary = "Agregar evidencia (EV/EP, desde En curso)",
        Description = "Fotos/video/documentos del taller; archivo_url proviene del servicio de archivos. Solo con el taller En curso.")]
    [SwaggerResponse(200, "Evidencia agregada", typeof(ApiResponse<TallerEvidenciaDto>))]
    [SwaggerResponse(409, "Candado por estado o tipo inválido")]
    public async Task<IActionResult> AgregarEvidencia(int idTaller, [FromBody] GuardarTallerEvidenciaRequest request, CancellationToken ct)
    {
        try
        {
            var evidencia = await _imparticionService.AgregarEvidenciaAsync(idTaller, request, GetUserId(), ct);
            return Ok(new ApiResponse<TallerEvidenciaDto>
            {
                Success = true,
                Message = "Evidencia agregada exitosamente.",
                Data = evidencia
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpDelete("{idTaller:int}/evidencias/{idEvidencia:int}")]
    [HasPermission(Permissions.EducacionMedica.EvidenciasGestionar)]
    [SwaggerOperation(Summary = "Eliminar evidencia (borrado físico; EV/EP)")]
    [SwaggerResponse(200, "Evidencia eliminada")]
    [SwaggerResponse(409, "Candado por estado")]
    public async Task<IActionResult> EliminarEvidencia(int idTaller, int idEvidencia, CancellationToken ct)
    {
        try
        {
            await _imparticionService.EliminarEvidenciaAsync(idTaller, idEvidencia, GetUserId(), ct);
            return Ok(new ApiResponse<object> { Success = true, Message = "Evidencia eliminada exitosamente." });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("{idTaller:int}/estado")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(
        Summary = "Cambiar estado del taller",
        Description = "Máquina de estados validada en servicio (ADR-00008): Programado→EnCurso/Realizado exige ser EV/EP del equipo; Realizado exige ≥1 evidencia y ≥1 asistencia; Cancelado exige motivo y rol GV/AEM/CEM. Cada transición se registra en taller_estados_historial.")]
    [SwaggerResponse(200, "Estado actualizado", typeof(ApiResponse<TallerDto>))]
    [SwaggerResponse(409, "Transición, rol o requisitos inválidos")]
    public async Task<IActionResult> CambiarEstado(int idTaller, [FromBody] CambiarEstadoTallerRequest request, CancellationToken ct)
    {
        try
        {
            var taller = await _imparticionService.CambiarEstadoAsync(idTaller, request, GetUserId(), ct);
            return Ok(new ApiResponse<TallerDto>
            {
                Success = true,
                Message = "Estado del taller actualizado exitosamente.",
                Data = taller
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("{idTaller:int}/estados")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(Summary = "Historial de estados del taller (origen, motivo, usuario, fecha)")]
    [SwaggerResponse(200, "Historial de estados", typeof(ApiResponse<List<TallerEstadoHistorialDto>>))]
    public async Task<IActionResult> GetHistorialEstados(int idTaller, CancellationToken ct)
    {
        try
        {
            var historial = await _imparticionService.GetHistorialEstadosAsync(idTaller, ct);
            return Ok(new ApiResponse<List<TallerEstadoHistorialDto>>
            {
                Success = true,
                Message = "Historial de estados obtenido exitosamente.",
                Data = historial
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("{idTaller:int}/documento-material")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(Summary = "Documento imprimible FOR-007 (material) pre-llenado")]
    [SwaggerResponse(200, "Documento de material", typeof(ApiResponse<TallerDocumentoMaterialDto>))]
    public async Task<IActionResult> GetDocumentoMaterial(int idTaller, CancellationToken ct)
    {
        try
        {
            var documento = await _imparticionService.GetDocumentoMaterialAsync(idTaller, ct);
            return Ok(new ApiResponse<TallerDocumentoMaterialDto>
            {
                Success = true,
                Message = "Documento de material obtenido exitosamente.",
                Data = documento
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("{idTaller:int}/documento-asistencia")]
    [HasPermission(Permissions.EducacionMedica.TalleresVer)]
    [SwaggerOperation(Summary = "Documento imprimible FOR-008 (asistencia) pre-llenado")]
    [SwaggerResponse(200, "Documento de asistencia", typeof(ApiResponse<TallerDocumentoAsistenciaDto>))]
    public async Task<IActionResult> GetDocumentoAsistencia(int idTaller, CancellationToken ct)
    {
        try
        {
            var documento = await _imparticionService.GetDocumentoAsistenciaAsync(idTaller, ct);
            return Ok(new ApiResponse<TallerDocumentoAsistenciaDto>
            {
                Success = true,
                Message = "Documento de asistencia obtenido exitosamente.",
                Data = documento
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
