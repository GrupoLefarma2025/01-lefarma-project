using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Config.Workflows.Notification;

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
        string tipoEntidad,
        int idEntidad,
        string folio,
        int idUsuarioCreador,
        Dictionary<string, string>? variablesExtra,
        int? idPasoDestino,
        int idUsuarioActual,
        string? comentario,
        string? contenidoAdicional = null,
        CancellationToken ct = default)
    {
        if (notificacion is null || !notificacion.Activo)
            return;

        try
        {
            // Cargar participantes del paso destino una sola vez (evita doble query)
            List<WorkflowParticipante> participantesDestino = [];
            if (idPasoDestino.HasValue)
            {
                participantesDestino = await _context.WorkflowParticipantes
                    .Where(p => p.IdPaso == idPasoDestino.Value && p.Activo)
                    .ToListAsync(ct);
            }

            // Resolver idWorkflow desde la notificación → acción → paso
            var idWorkflow = await _context.WorkflowAcciones
                .Where(a => a.IdAccion == notificacion.IdAccion)
                .Join(_context.WorkflowPasos, a => a.IdPasoOrigen, p => p.IdPaso, (a, p) => p.IdWorkflow)
                .FirstOrDefaultAsync(ct);

            // Cargar tipo de notificación para colores de template
            WorkflowTipoNotificacion? tipoNotif = null;
            if (notificacion.IdTipoNotificacion.HasValue)
            {
                tipoNotif = await _context.WorkflowTiposNotificacion
                    .FirstOrDefaultAsync(t => t.IdTipo == notificacion.IdTipoNotificacion.Value, ct);
            }

            var templatesPorCanal = new Dictionary<string, WorkflowCanalTemplate?>();

            // Lazy lookup
            // Cargar el template del canal + proceso solo si se va a usar ese canal y cachearlo para evitar queries repetidos si hay varios destinatarios
            async Task<WorkflowCanalTemplate?> GetTemplateAsync(string codigoCanal)
            {
                if (templatesPorCanal.TryGetValue(codigoCanal, out var cached))
                    return cached;

                var template = await _context.WorkflowCanalTemplates
                    .FirstOrDefaultAsync(
                        t => t.CodigoCanal == codigoCanal
                          && t.CodigoProceso == tipoEntidad
                          && t.Activo,
                        ct);

                templatesPorCanal[codigoCanal] = template;  // cachea incluso null
                return template;
            }

            //Resolver destinatarios
            var userIds = await ResolveRecipientsAsync(notificacion, tipoEntidad, idEntidad, idUsuarioCreador, idUsuarioActual, participantesDestino, ct);
            if (userIds.Count == 0)
            {
                _logger.LogWarning("WorkflowNotificationDispatcher: no se encontraron destinatarios para notificación {IdNotificacion}", notificacion.IdNotificacion);
                return;
            }

            // Obtener nombres para el template
            var (nombreCreador, nombreSiguiente) = await ResolveNamesAsync(idUsuarioCreador, participantesDestino, ct);

            // NombreAnterior = actor actual que firmo (proposito informativo para el destinatario)
            var nombreActual = await _asokamContext.Usuarios
                .Where(u => u.IdUsuario == idUsuarioActual)
                .Select(u => u.NombreCompleto)
                .FirstOrDefaultAsync(ct) ?? "el usuario";

            var nombreAccion = await _context.WorkflowAcciones
                .Where(a => a.IdAccion == notificacion.IdAccion)
                .Select(a => a.TipoAccion != null ? a.TipoAccion.Nombre : null)
                .FirstOrDefaultAsync(ct) ?? "";

            //Interpolar templates
            //var urlOrden = string.IsNullOrEmpty(_frontendBaseUrl)
            //    ? $"/autorizaciones?idOrden={orden.IdOrden}"
            //   : $"{_frontendBaseUrl}/autorizaciones?idOrden={orden.IdOrden}";

            // Resolver el template de email una sola vez
            var templateEmail = await GetTemplateAsync("email");

            // Construir URL del botón  desde la UrlButton del template
            var urlPath = (templateEmail?.UrlButton ?? "")
                .Replace("{IdEntidad}", idEntidad.ToString());
            var urlEntidad = string.IsNullOrEmpty(_frontendBaseUrl)
                ? urlPath
                : $"{_frontendBaseUrl}{urlPath}";

            // Construir contexto base (variables del sistema)
            var contextoTemplate = variablesExtra != null
                ? new Dictionary<string, string>(variablesExtra)
                : new Dictionary<string, string>();


            contextoTemplate["Folio"] = folio;
            contextoTemplate["UrlEntidad"] = urlEntidad ?? ""; // {{UrlEntidad}} en template
            contextoTemplate["Solicitante"] = nombreCreador;
            contextoTemplate["NombreCreador"] = nombreCreador;
            contextoTemplate["NombreSiguiente"] = nombreSiguiente;
            contextoTemplate["NombreAnterior"] = nombreActual;
            contextoTemplate["Usuario"] = nombreActual;
            contextoTemplate["Accion"] = nombreAccion;
            contextoTemplate["Comentario"] = comentario ?? "";
            contextoTemplate["ColorTema"] = tipoNotif?.ColorTema ?? "#0f2744";
            contextoTemplate["ColorClaro"] = tipoNotif?.ColorClaro ?? "#e8f0fe";
            contextoTemplate["Icono"] = tipoNotif?.Icono ?? "🔔";

            if (!string.IsNullOrEmpty(contenidoAdicional))
                contextoTemplate["ContenidoAdicional"] = contenidoAdicional;

            // 5. Resolver canales configurados
            var canalInApp    = notificacion.Canales.FirstOrDefault(c => c.CodigoCanal == "in_app"    && c.Activo);
            var canalEmail    = notificacion.Canales.FirstOrDefault(c => c.CodigoCanal == "email"     && c.Activo);
            var canalTelegram = notificacion.Canales.FirstOrDefault(c => c.CodigoCanal == "telegram"  && c.Activo);

            // Usar in_app canal; si no existe, usar email como fallback de contenido
            var canalInAppEfectivo = canalInApp ?? canalEmail;

            //  Asunto por defecto (si no se configura en canal específico)
            var AsuntoDefault = BuildAsuntoPorDefecto(tipoEntidad, folio);

            // 6. Enviar in-app (siempre que haya contenido disponible)
            if (canalInAppEfectivo != null)
            {
                var asuntoInApp = Interpolate(
                    !string.IsNullOrWhiteSpace(canalInAppEfectivo.AsuntoTemplate) ? canalInAppEfectivo.AsuntoTemplate : AsuntoDefault,
                    contextoTemplate);
                var cuerpoInApp = Interpolate(canalInAppEfectivo.CuerpoTemplate, contextoTemplate);
                contextoTemplate["Asunto"] = asuntoInApp;
                await _notificationService.SendAsync(new SendNotificationRequest
                {
                    Title = asuntoInApp,
                    Message = cuerpoInApp,
                    Type = "info",
                    Priority = "normal",
                    Category = tipoEntidad,
                    Channels = [new NotificationChannelRequest { ChannelType = "in-app", UserIds = userIds }]
                }, ct);
            }

            // 7. Enviar email con wrapper HTML estilizado
            if (notificacion.EnviarEmail && canalEmail != null)
            {
                var asuntoEmail = Interpolate(
                    !string.IsNullOrWhiteSpace(canalEmail.AsuntoTemplate) ? canalEmail.AsuntoTemplate : AsuntoDefault,
                    contextoTemplate);
                var cuerpoEmail = Interpolate(canalEmail.CuerpoTemplate, contextoTemplate);
                contextoTemplate["Asunto"] = asuntoEmail;
                var emailHtml = await ApplyCanalTemplateAsync("email", cuerpoEmail, contextoTemplate, GetTemplateAsync, ct);
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
                var asuntoTelegram = Interpolate(
                    !string.IsNullOrWhiteSpace(canalTelegram.AsuntoTemplate) ? canalTelegram.AsuntoTemplate : AsuntoDefault,
                    contextoTemplate);
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
            _logger.LogError(ex, "WorkflowNotificationDispatcher: error al enviar notificación {IdNotificacion} para orden {Folio}", notificacion.IdNotificacion, folio);
        }
    }

    private async Task<List<int>> ResolveRecipientsAsync(
        WorkflowNotificacion notif,
        string tipoEntidad,
        int idEntidad,
        int idUsuarioCreador,
        int idUsuarioActual,
        List<WorkflowParticipante> participantesDestino,
        CancellationToken ct)
    {
        var ids = new HashSet<int>();

        if (notif.AvisarAlCreador)
            ids.Add(idUsuarioCreador);

        // Anterior = el actor actual que acaba de ejecutar la accion (firmante)
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
                .Where(b => b.TipoEntidad == tipoEntidad && b.IdEntidad == idEntidad)
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
        List<WorkflowParticipante> participantesDestino,
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

    private async Task<string> ApplyCanalTemplateAsync(string codigoCanal, string contenido,Dictionary<string, string> ctx, 
        Func<string, Task<WorkflowCanalTemplate?>> getTemplate, CancellationToken ct)
    {
        var template = await getTemplate(codigoCanal);  // usa el caché local
        var layoutHtml = template?.LayoutHtml;

        if (string.IsNullOrEmpty(layoutHtml))
        {
            return BuildEmailHtmlFallback(
                contenido,
                ctx.GetValueOrDefault("Asunto", ""),
                ctx.GetValueOrDefault("Folio", ""),
                ctx.GetValueOrDefault("UrlEntidad", "")
            );
        }

        var withContent = layoutHtml.Replace("{{Contenido}}", contenido, StringComparison.OrdinalIgnoreCase);
        return Interpolate(withContent, ctx);
    }

    
    private static string BuildEmailHtmlFallback(string cuerpo, string asunto, string folio, string urlEntidad)
    {
        return $$$$$"""
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
                                  Notificación
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
                          {{{{ContenidoAdicional}}}}
                        </td>
                      </tr>

                      <!-- Button -->
                      <tr>
                        <td style="background-color:#ffffff;padding:0 36px 36px">
                          <a href="{urlEntidad}"
                             style="display:inline-block;background-color:#0f2744;color:#ffffff;text-decoration:none;
                                    padding:13px 28px;border-radius:7px;font-size:14px;font-weight:600;
                                    letter-spacing:0.2px;border:none">
                            Abrir
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
                            © Grupo Lefarma 
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

    private string BuildAsuntoPorDefecto(string tipoEntidad, string folio)
    {
        var tipo = tipoEntidad switch
        {
            CodigoProceso.ORDEN_COMPRA => "Orden de Compra",
            CodigoProceso.SOLICITUD_PERSONAL => "Solicitud de Personal",
            _ => "Notificación"
        };
        return $"{tipo} {folio}";
    }
}

