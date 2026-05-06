using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.OrdenesCompra.Firmas;

// @lat: [[lat.md\workflow#Workflow de Órdenes de Compra#Notificaciones#Workflow Notification Dispatcher]]
public class WorkflowNotificationDispatcher : IWorkflowNotificationDispatcher
{
    private readonly INotificationService _notificationService;
    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly ILogger<WorkflowNotificationDispatcher> _logger;
    private readonly string _frontendBaseUrl;

    public WorkflowNotificationDispatcher(
        INotificationService notificationService,
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        ILogger<WorkflowNotificationDispatcher> logger,
        IConfiguration configuration)
    {
        _notificationService = notificationService;
        _context = context;
        _asokamContext = asokamContext;
        _logger = logger;
        _frontendBaseUrl = configuration["AppSettings:FrontendBaseUrl"]?.TrimEnd('/') ?? "";
    }

    public async Task DispatchAsync(
        WorkflowNotificacion? notificacion,
        OrdenCompra orden,
        int? idPasoDestino,
        int idUsuarioActual,
        string? comentario,
        CancellationToken ct = default)
    {
        if (notificacion is null || !notificacion.Activo)
            return;

        try
        {
            // 1. Cargar participantes del paso destino una sola vez (evita doble query)
            List<Domain.Entities.Config.WorkflowParticipante> participantesDestino = [];
            if (idPasoDestino.HasValue)
            {
                participantesDestino = await _context.WorkflowParticipantes
                    .Where(p => p.IdPaso == idPasoDestino.Value && p.Activo)
                    .ToListAsync(ct);
            }

            // 1b. Resolver idWorkflow desde la notificación → acción → paso
            var idWorkflow = await _context.WorkflowAcciones
                .Where(a => a.IdAccion == notificacion.IdAccion)
                .Join(_context.WorkflowPasos, a => a.IdPasoOrigen, p => p.IdPaso, (a, p) => p.IdWorkflow)
                .FirstOrDefaultAsync(ct);

            // 1c. Cargar tipo de notificación para colores de template
            WorkflowTipoNotificacion? tipoNotif = null;
            if (notificacion.IdTipoNotificacion.HasValue)
            {
                tipoNotif = await _context.WorkflowTiposNotificacion
                    .FirstOrDefaultAsync(t => t.IdTipo == notificacion.IdTipoNotificacion.Value, ct);
            }

            // 2. Resolver destinatarios
            var userIds = await ResolveRecipientsAsync(notificacion, orden, idUsuarioActual, participantesDestino, ct);
            if (userIds.Count == 0)
            {
                _logger.LogWarning("WorkflowNotificationDispatcher: no se encontraron destinatarios para notificación {IdNotificacion}", notificacion.IdNotificacion);
                return;
            }

            // 3. Obtener nombres para el template
            var (nombreCreador, nombreSiguiente) = await ResolveNamesAsync(orden.IdUsuarioCreador, participantesDestino, ct);

            var nombreActual = await _asokamContext.Usuarios
                .Where(u => u.IdUsuario == idUsuarioActual)
                .Select(u => u.NombreCompleto)
                .FirstOrDefaultAsync(ct) ?? "el usuario";

            var nombreAccion = await _context.WorkflowAcciones
                .Where(a => a.IdAccion == notificacion.IdAccion)
                .Select(a => a.TipoAccion != null ? a.TipoAccion.Nombre : null)
                .FirstOrDefaultAsync(ct) ?? "";

            // 4. Interpolar templates
            var urlOrden = string.IsNullOrEmpty(_frontendBaseUrl)
                ? $"/autorizaciones?idOrden={orden.IdOrden}"
                : $"{_frontendBaseUrl}/autorizaciones?idOrden={orden.IdOrden}";

            var contextoTemplate = new Dictionary<string, string>
            {
                ["Folio"] = orden.Folio,
                ["Total"] = orden.Total.ToString("C2"),
                ["Proveedor"] = orden.Proveedor?.RazonSocial ?? "",
                ["Solicitante"] = nombreCreador,
                ["NombreCreador"] = nombreCreador,
                ["NombreSiguiente"] = nombreSiguiente,
                ["NombreAnterior"] = nombreActual,
                ["Usuario"] = nombreActual,
                ["Accion"] = nombreAccion,
                ["Comentario"] = comentario ?? "",
                ["CentroCosto"] = orden.CentroCosto?.Nombre ?? orden.IdCentroCosto?.ToString() ?? "",
                ["CuentaContable"] = orden.CuentaContable?.Cuenta ?? orden.IdCuentaContable?.ToString() ?? "",
                ["UrlOrden"] = urlOrden,
                ["ImportePagado"] = "",
                ["ColorTema"]  = tipoNotif?.ColorTema ?? "#0f2744",
                ["ColorClaro"] = tipoNotif?.ColorClaro ?? "#e8f0fe",
                ["Icono"]      = tipoNotif?.Icono ?? "🔔",
                ["Partidas"]   = notificacion.IncluirPartidas
                    ? BuildPartidasTable(orden.Partidas,
                        notificacion.Canales.FirstOrDefault(c => c.Activo && !string.IsNullOrWhiteSpace(c.ListadoRowHtml))?.ListadoRowHtml)
                    : "",
            };

            // 5. Resolver canales configurados
            var canalInApp    = notificacion.Canales.FirstOrDefault(c => c.CodigoCanal == "in_app"    && c.Activo);
            var canalEmail    = notificacion.Canales.FirstOrDefault(c => c.CodigoCanal == "email"     && c.Activo);
            var canalTelegram = notificacion.Canales.FirstOrDefault(c => c.CodigoCanal == "telegram"  && c.Activo);

            // Usar in_app canal; si no existe, usar email como fallback de contenido
            var canalInAppEfectivo = canalInApp ?? canalEmail;

            // 6. Enviar in-app (siempre que haya contenido disponible)
            if (canalInAppEfectivo != null)
            {
                var asuntoInApp = Interpolate(canalInAppEfectivo.AsuntoTemplate ?? $"Orden de Compra {orden.Folio}", contextoTemplate);
                var cuerpoInApp = Interpolate(canalInAppEfectivo.CuerpoTemplate, contextoTemplate);
                contextoTemplate["Asunto"] = asuntoInApp;
                await _notificationService.SendAsync(new SendNotificationRequest
                {
                    Title = asuntoInApp,
                    Message = cuerpoInApp,
                    Type = "info",
                    Priority = "normal",
                    Category = "order",
                    Channels = [new NotificationChannelRequest { ChannelType = "in-app", UserIds = userIds }]
                }, ct);
            }

            // 7. Enviar email con wrapper HTML estilizado
            if (notificacion.EnviarEmail && canalEmail != null)
            {
                var asuntoEmail = Interpolate(canalEmail.AsuntoTemplate ?? $"Orden de Compra {orden.Folio}", contextoTemplate);
                var cuerpoEmail = Interpolate(canalEmail.CuerpoTemplate, contextoTemplate);
                contextoTemplate["Asunto"] = asuntoEmail;
                var emailHtml = await ApplyCanalTemplateAsync("email", cuerpoEmail, contextoTemplate, ct);
                await _notificationService.SendAsync(new SendNotificationRequest
                {
                    Title = asuntoEmail,
                    Message = emailHtml,
                    Type = "info",
                    Priority = "normal",
                    Category = "order",
                    Channels = [new NotificationChannelRequest { ChannelType = "email", UserIds = userIds }]
                }, ct);
            }

            // 8. Telegram (si aplica)
            if (notificacion.EnviarTelegram && canalTelegram != null)
            {
                var asuntoTelegram = Interpolate(canalTelegram.AsuntoTemplate ?? $"Orden de Compra {orden.Folio}", contextoTemplate);
                var cuerpoTelegram = Interpolate(canalTelegram.CuerpoTemplate, contextoTemplate);
                await _notificationService.SendAsync(new SendNotificationRequest
                {
                    Title = asuntoTelegram,
                    Message = cuerpoTelegram,
                    Type = "info",
                    Priority = "normal",
                    Category = "order",
                    Channels = [new NotificationChannelRequest { ChannelType = "telegram", UserIds = userIds }]
                }, ct);
            }

            _logger.LogInformation("WorkflowNotificationDispatcher: notificación {IdNotificacion} enviada a {Count} usuarios", notificacion.IdNotificacion, userIds.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WorkflowNotificationDispatcher: error al enviar notificación {IdNotificacion} para orden {Folio}", notificacion.IdNotificacion, orden.Folio);
        }
    }

    private async Task<List<int>> ResolveRecipientsAsync(
        WorkflowNotificacion notif,
        OrdenCompra orden,
        int idUsuarioActual,
        List<Domain.Entities.Config.WorkflowParticipante> participantesDestino,
        CancellationToken ct)
    {
        var ids = new HashSet<int>();

        if (notif.AvisarAlCreador)
            ids.Add(orden.IdUsuarioCreador);

        if (notif.AvisarAlAnterior)
            ids.Add(idUsuarioActual);

        if (notif.AvisarAlSiguiente && participantesDestino.Count > 0)
        {
            foreach (var p in participantesDestino)
            {
                if (p.IdUsuario.HasValue)
                {
                    ids.Add(p.IdUsuario.Value);
                }
                else if (p.IdRol.HasValue)
                {
                    var usersInRole = await _asokamContext.UsuariosRoles
                        .Where(ur => ur.IdRol == p.IdRol.Value)
                        .Select(ur => ur.IdUsuario)
                        .ToListAsync(ct);

                    foreach (var uid in usersInRole)
                        ids.Add(uid);
                }
            }
        }

        if (notif.AvisarAAutorizadoresPrevios)
        {
            var prevApprovers = await _context.WorkflowBitacoras
                .Where(b => b.IdOrden == orden.IdOrden)
                .Join(_context.WorkflowAcciones,
                    b => b.IdAccion,
                    a => a.IdAccion,
                    (b, a) => new { b.IdUsuario, a.IdTipoAccion, TipoAccionCodigo = a.TipoAccion != null ? a.TipoAccion.Codigo : null })
                .Where(x => x.TipoAccionCodigo == "APROBAR")
                .Select(x => x.IdUsuario)
                .Distinct()
                .ToListAsync(ct);

            foreach (var uid in prevApprovers)
                ids.Add(uid);
        }

        return [.. ids];
    }

    private async Task<(string NombreCreador, string NombreSiguiente)> ResolveNamesAsync(
        int idCreador,
        List<Domain.Entities.Config.WorkflowParticipante> participantesDestino,
        CancellationToken ct)
    {
        var creador = await _asokamContext.Usuarios
            .Where(u => u.IdUsuario == idCreador)
            .Select(u => u.NombreCompleto)
            .FirstOrDefaultAsync(ct);

        var nombreCreador = creador ?? "el solicitante";

        var nombreSiguiente = "el responsable";

        // Primero intentar con usuario directo del paso
        var participanteDirecto = participantesDestino.FirstOrDefault(p => p.IdUsuario != null);
        if (participanteDirecto?.IdUsuario != null)
        {
            var sig = await _asokamContext.Usuarios
                .Where(u => u.IdUsuario == participanteDirecto.IdUsuario.Value)
                .Select(u => u.NombreCompleto)
                .FirstOrDefaultAsync(ct);

            if (!string.IsNullOrEmpty(sig))
                nombreSiguiente = sig;
        }
        else
        {
            // Fallback: primer usuario del rol del paso
            var rolParticipante = participantesDestino.FirstOrDefault(p => p.IdRol != null);
            if (rolParticipante?.IdRol != null)
            {
                var firstInRole = await _asokamContext.UsuariosRoles
                    .Where(ur => ur.IdRol == rolParticipante.IdRol.Value)
                    .Select(ur => ur.IdUsuario)
                    .FirstOrDefaultAsync(ct);

                if (firstInRole > 0)
                {
                    var sig = await _asokamContext.Usuarios
                        .Where(u => u.IdUsuario == firstInRole)
                        .Select(u => u.NombreCompleto)
                        .FirstOrDefaultAsync(ct);

                    if (!string.IsNullOrEmpty(sig))
                        nombreSiguiente = sig;
                }
            }
        }

        return (nombreCreador, nombreSiguiente);
    }

    private static string Interpolate(string template, Dictionary<string, string> ctx)
    {
        foreach (var (key, value) in ctx)
            template = template.Replace($"{{{{{key}}}}}", value, StringComparison.OrdinalIgnoreCase);
        return template;
    }

    private async Task<string> ApplyCanalTemplateAsync(string codigoCanal, string contenido, Dictionary<string, string> ctx, CancellationToken ct)
    {
        var layoutHtml = await _context.WorkflowCanalTemplates
            .Where(t => t.CodigoCanal == codigoCanal && t.Activo)
            .Select(t => t.LayoutHtml)
            .FirstOrDefaultAsync(ct);

        if (string.IsNullOrEmpty(layoutHtml))
            return BuildEmailHtmlFallback(contenido, ctx.GetValueOrDefault("Asunto", ""), ctx.GetValueOrDefault("Folio", ""), ctx.GetValueOrDefault("UrlOrden", ""));

        var withContent = layoutHtml.Replace("{{Contenido}}", contenido, StringComparison.OrdinalIgnoreCase);
        return Interpolate(withContent, ctx);
    }

    private static string BuildPartidasTable(ICollection<OrdenCompraPartida> partidas, string? rowTemplate = null)
    {
        if (partidas == null || partidas.Count == 0)
            return "<p style=\"color:#6b7280;font-size:13px\">Sin partidas registradas.</p>";

        string BuildRow(OrdenCompraPartida p)
        {
            if (!string.IsNullOrWhiteSpace(rowTemplate))
            {
                return rowTemplate
                    .Replace("{{NumeroPartida}}", p.NumeroPartida.ToString())
                    .Replace("{{Descripcion}}", p.Descripcion ?? "")
                    .Replace("{{Cantidad}}", p.Cantidad.ToString("G"))
                    .Replace("{{PrecioUnitario}}", p.PrecioUnitario.ToString("C2"))
                    .Replace("{{Total}}", p.Total.ToString("C2"));
            }
            return $"""
                <tr>
                  <td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:13px;color:#374151">{p.NumeroPartida}</td>
                  <td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:13px;color:#374151">{p.Descripcion}</td>
                  <td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:13px;color:#374151;text-align:right">{p.Cantidad:G}</td>
                  <td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:13px;color:#374151;text-align:right">{p.PrecioUnitario:C2}</td>
                  <td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:13px;color:#374151;text-align:right;font-weight:600">{p.Total:C2}</td>
                </tr>
                """;
        }

        var rows = string.Concat(partidas.OrderBy(p => p.NumeroPartida).Select(BuildRow));

        return $"""
            <table style="width:100%;border-collapse:collapse;margin:12px 0;font-family:inherit">
              <thead>
                <tr style="background-color:#f3f4f6">
                  <th style="padding:8px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:left;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">#</th>
                  <th style="padding:8px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:left;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Descripción</th>
                  <th style="padding:8px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:right;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Cant.</th>
                  <th style="padding:8px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:right;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Precio Unit.</th>
                  <th style="padding:8px 10px;border:1px solid #e5e7eb;font-size:11px;text-align:right;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows}
              </tbody>
            </table>
            """;
    }

    private static string BuildEmailHtmlFallback(string cuerpo, string asunto, string folio, string urlOrden)
    {
        return $"""
            <!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>{asunto}</title>
            </head>
            <body style="margin:0;padding:0;background-color:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background-color:#f0f2f5;padding:40px 16px">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" role="presentation"
                           style="max-width:600px;width:100%;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.10)">

                      <!-- Header -->
                      <tr>
                        <td style="background-color:#0f2744;padding:28px 36px">
                          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td>
                                <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px">
                                  Grupo Lefarma
                                </p>
                                <p style="margin:4px 0 0;color:#7bafd4;font-size:13px;font-weight:400">
                                  Sistema de Autorizaciones de Órdenes de Compra
                                </p>
                              </td>
                              <td align="right">
                                <span style="display:inline-block;background-color:#1d3f6e;color:#90c4e8;font-size:12px;font-weight:600;padding:6px 12px;border-radius:20px;letter-spacing:0.3px">
                                  {folio}
                                </span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Body -->
                      <tr>
                        <td style="background-color:#ffffff;padding:36px 36px 28px">
                          <div style="color:#1f2937;font-size:15px;line-height:1.7">
                            {cuerpo}
                          </div>
                        </td>
                      </tr>

                      <!-- CTA Button -->
                      <tr>
                        <td style="background-color:#ffffff;padding:0 36px 36px">
                          <a href="{urlOrden}"
                             style="display:inline-block;background-color:#0f2744;color:#ffffff;text-decoration:none;
                                    padding:13px 28px;border-radius:7px;font-size:14px;font-weight:600;
                                    letter-spacing:0.2px;border:none">
                            Ver Orden en el Sistema →
                          </a>
                        </td>
                      </tr>

                      <!-- Divider -->
                      <tr>
                        <td style="background-color:#ffffff;padding:0 36px">
                          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0">
                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="background-color:#f8f9fa;padding:20px 36px;border-radius:0 0 10px 10px">
                          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;text-align:center">
                            Este mensaje fue generado automáticamente. Por favor no responda a este correo.<br>
                            © Grupo Lefarma — Sistema de Autorizaciones
                          </p>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """;
    }
}

