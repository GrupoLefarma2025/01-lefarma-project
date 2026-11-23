using Lefarma.API.Features.Sigma.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lefarma.API.Features.Sigma.Controllers;

[ApiController]
[Route("api/email/documentos")]
[EndpointGroupName("Sigma")]
public sealed class EmailDocumentosController : ControllerBase
{
    private readonly SigmaDocumentoEmailService _correos;
    private readonly SigmaIdentity _identidad;
    private readonly ILogger<EmailDocumentosController> _log;

    public EmailDocumentosController(
        SigmaDocumentoEmailService correos,
        SigmaIdentity identidad,
        ILogger<EmailDocumentosController> log)
    {
        _correos = correos;
        _identidad = identidad;
        _log = log;
    }

    [HttpPost("autorizacion-pendiente")]
    [Authorize]
    public async Task<IActionResult> AutorizacionPendiente(CancellationToken ct)
    {
        try
        {
            var resultado = await _correos.EnviarNotificacionesAutorizacionPendienteAsync(ct);
            var cuerpo = new AutorizacionPendienteResponse
            {
                Message = resultado.Mensaje,
                DocumentosProcesados = resultado.DocumentosProcesados,
                CorreosEnviados = resultado.CorreosEnviados,
                Errores = resultado.Errores
            };

            return resultado.Success
                ? Ok(cuerpo)
                : StatusCode(StatusCodes.Status500InternalServerError, cuerpo);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error procesando las notificaciones de autorización pendiente");
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new { message = "Error procesando notificaciones", error = ex.Message });
        }
    }

    [HttpPost("notificar/{id:guid}")]
    public async Task<IActionResult> Notificar(Guid id, [FromQuery] bool soloCC = false, CancellationToken ct = default)
    {
        var actor = _identidad.Resolve();
        if (actor is null)
        {
            return Unauthorized(new { message = "Usuario no autenticado" });
        }

        if (actor.EsAnonimo && !await _correos.CorreoAutorizadoAsync(id, actor.Usuario, ct))
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new { message = "No tiene acceso a este documento" });
        }

        try
        {
            var resultado = await _correos.EnviarNotificacionDocumentoAsync(id, soloCC, ct);

            if (resultado.Success)
            {
                var respuesta = new NotificarDocumentoResponse
                {
                    Message = resultado.Mensaje,
                    DocumentoId = id,
                    SoloCC = soloCC
                };
                return Ok(respuesta);
            }

            var estado = resultado.Mensaje.Contains("no encontrado", StringComparison.OrdinalIgnoreCase)
                ? StatusCodes.Status404NotFound
                : StatusCodes.Status400BadRequest;

            return StatusCode(estado, new { message = resultado.Mensaje, errores = resultado.Errores });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error procesando la notificación del documento {IdDocumento}", id);
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new { message = "Error procesando notificación", error = ex.Message });
        }
    }
}
