using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lefarma.API.Features.OrdenesCompra.Firmas
{
    [Route("api/workflow/recordatorios")]
    [ApiController]
    [EndpointGroupName("Workflow")]
    public class WorkflowReminderController : ControllerBase
    {
        private readonly WorkflowReminderService _service;

        public WorkflowReminderController(WorkflowReminderService service)
        {
            _service = service;
        }

        /// <summary>
        /// Procesa los recordatorios pendientes. Puede ser llamado por un administrador desde la UI
        /// o por SQL Server Agent a través de un stored procedure.
        /// </summary>
        [HttpPost("ejecutar")]
        [AllowAnonymous]
        public async Task<IActionResult> Ejecutar(CancellationToken ct)
        {
            var (procesados, enviados) = await _service.ProcessRemindersAsync(ct);

            return Ok(new
            {
                procesados,
                enviados,
                mensaje = enviados > 0
                    ? $"Se procesaron {procesados} recordatorio(s) y se enviaron {enviados} notificación(es)."
                    : procesados > 0
                        ? $"Se evaluaron {procesados} recordatorio(s) pero ninguno tenía pendientes que notificar."
                        : "No hay recordatorios activos con condiciones cumplidas en este momento.",
                timestamp = DateTime.UtcNow
            });
        }
    }
}
