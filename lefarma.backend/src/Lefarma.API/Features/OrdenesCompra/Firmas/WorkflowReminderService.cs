using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text;

namespace Lefarma.API.Features.OrdenesCompra.Firmas
{
    public class WorkflowReminderService
    {
        private readonly ApplicationDbContext _db;
        private readonly AsokamDbContext _asokamDb;
        private readonly INotificationService _notifService;
        private readonly ILogger<WorkflowReminderService> _logger;
        private readonly string _frontendBaseUrl;

        public WorkflowReminderService(
            ApplicationDbContext db,
            AsokamDbContext asokamDb,
            INotificationService notifService,
            ILogger<WorkflowReminderService> logger,
            IConfiguration configuration)
        {
            _db = db;
            _asokamDb = asokamDb;
            _notifService = notifService;
            _logger = logger;
            _frontendBaseUrl = configuration["AppSettings:FrontendBaseUrl"]?.TrimEnd('/') ?? "";
        }

        public async Task<(int Procesados, int Enviados)> ProcessRemindersAsync(CancellationToken ct = default)
        {
            var ahora = DateTime.UtcNow;
            var recordatorios = await _db.WorkflowRecordatorios
                .Where(r => r.Activo)
                .Include(r => r.Logs.OrderByDescending(l => l.FechaEnvio).Take(1))
                .Include(r => r.Canales.Where(c => c.Activo))
                .ToListAsync(ct);

            _logger.LogInformation("WorkflowReminderService: evaluando {Count} recordatorio(s) activos a las {Hora} local",
                recordatorios.Count, ahora.ToLocalTime().ToString("HH:mm:ss"));

            int procesados = 0, enviados = 0;

            foreach (var rec in recordatorios)
            {
                var debeProcesar = ShouldSendNow(rec, ahora);
                _logger.LogInformation("WorkflowReminderService: recordatorio [{Id}] '{Nombre}' — trigger={Trigger}, debeProcesar={Debe}",
                    rec.IdRecordatorio, rec.Nombre, rec.TipoTrigger, debeProcesar);

                if (!debeProcesar) continue;
                procesados++;
                enviados += await ProcessSingleReminderAsync(rec, ahora, ct);
            }

            return (procesados, enviados);
        }

        private bool ShouldSendNow(WorkflowRecordatorio rec, DateTime ahora)
        {
            if (rec.TipoTrigger == "fecha_especifica")
                return rec.FechaEspecifica.HasValue && rec.FechaEspecifica.Value == DateOnly.FromDateTime(ahora.ToLocalTime());

            if (rec.TipoTrigger == "recurrente")
            {
                var ultimoLog = rec.Logs.FirstOrDefault();
                if (ultimoLog == null) return true;
                return (ahora - ultimoLog.FechaEnvio).TotalHours >= (rec.IntervaloHoras ?? 24);
            }

            if (rec.TipoTrigger == "horario")
            {
                if (!rec.HoraEnvio.HasValue) return false;

                var ahoraLocal = ahora.ToLocalTime();
                var diasPermitidos = (rec.DiasSemana ?? "1,2,3,4,5").Split(',')
                    .Select(d => int.TryParse(d.Trim(), out var n) ? n : 0).ToHashSet();
                int diaActual = (int)ahoraLocal.DayOfWeek == 0 ? 7 : (int)ahoraLocal.DayOfWeek;
                if (!diasPermitidos.Contains(diaActual)) return false;

                var horaActual = TimeOnly.FromDateTime(ahoraLocal);
                var ventana = rec.HoraEnvio.Value;
                if (horaActual < ventana || horaActual > ventana.AddMinutes(30)) return false;
                var ultimoLog = rec.Logs.FirstOrDefault();
                if (ultimoLog != null && ultimoLog.FechaEnvio.ToLocalTime().Date == ahoraLocal.Date) return false;
                return true;
            }

            return false;
        }

        private async Task<int> ProcessSingleReminderAsync(
            WorkflowRecordatorio rec,
            DateTime ahora,
            CancellationToken ct)
        {
            int enviados = 0;
            try
            {
                var query = _db.OrdenesCompra.Include(o => o.Proveedor).Where(o => o.IdPasoActual != null);

                if (rec.IdPaso.HasValue)
                {
                    query = query.Where(o => o.IdPasoActual == rec.IdPaso.Value);
                }
                else
                {
                    var pasosIds = await _db.WorkflowPasos
                        .Where(p => p.IdWorkflow == rec.IdWorkflow)
                        .Select(p => p.IdPaso)
                        .ToListAsync(ct);
                    query = query.Where(o => pasosIds.Contains(o.IdPasoActual!.Value));
                }

                if (rec.MontoMinimo.HasValue) query = query.Where(o => o.Total >= rec.MontoMinimo.Value);
                if (rec.MontoMaximo.HasValue) query = query.Where(o => o.Total <= rec.MontoMaximo.Value);

                var ordenes = await query.ToListAsync(ct);

                if (rec.MinDiasEnPaso.HasValue)
                    ordenes = ordenes.Where(o => (ahora - o.FechaSolicitud).TotalDays >= rec.MinDiasEnPaso.Value).ToList();

                if (!ordenes.Any())
                {
                    _logger.LogInformation("WorkflowReminderService: recordatorio [{Id}] — sin órdenes pendientes, omitiendo", rec.IdRecordatorio);
                    return 0;
                }

                var pasosConOrdenes = ordenes.Select(o => o.IdPasoActual!.Value).Distinct().ToList();
                var participantes = await _db.WorkflowParticipantes
                    .Where(p => pasosConOrdenes.Contains(p.IdPaso) && p.Activo)
                    .ToListAsync(ct);

                var usuariosDirectos = participantes
                    .Where(p => p.IdUsuario.HasValue)
                    .Select(p => p.IdUsuario!.Value)
                    .Distinct()
                    .ToList();

                var nombresUsuarios = await _asokamDb.Usuarios
                    .Where(u => usuariosDirectos.Contains(u.IdUsuario))
                    .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? $"Usuario {u.IdUsuario}", ct);

                _logger.LogInformation("WorkflowReminderService: recordatorio [{Id}] — {CantOrdenes} orden(es), {CantUsuarios} usuario(s)",
                    rec.IdRecordatorio, ordenes.Count, usuariosDirectos.Count);

                foreach (var idUsuario in usuariosDirectos)
                {
                    var ordenesDelUsuario = ordenes;

                    if (rec.MinOrdenesPendientes.HasValue && ordenesDelUsuario.Count < rec.MinOrdenesPendientes.Value)
                        continue;

                    var diasEspera = ordenesDelUsuario.Max(o => (int)(ahora - o.FechaSolicitud).TotalDays);

                    var canalEmailTemplate = rec.Canales.FirstOrDefault(c => c.CodigoCanal == "email" && c.Activo);
                    var canalInAppTemplate = rec.Canales.FirstOrDefault(c => c.CodigoCanal == "in_app" && c.Activo);
                    var canalWhatsappTemplate = rec.Canales.FirstOrDefault(c => c.CodigoCanal == "whatsapp" && c.Activo);
                    var canalTelegramTemplate = rec.Canales.FirstOrDefault(c => c.CodigoCanal == "telegram" && c.Activo);

                    if (canalInAppTemplate == null && canalEmailTemplate == null)
                    {
                        _logger.LogWarning("Recordatorio {Id}: sin canal in_app ni email activo, se omite.", rec.IdRecordatorio);
                        continue;
                    }

                    var listadoHtml = BuildListadoHtml(ordenesDelUsuario, canalEmailTemplate?.ListadoRowHtml ?? canalInAppTemplate?.ListadoRowHtml);
                    var folios = string.Join(", ", ordenesDelUsuario.Select(o => o.Folio));

                    var urlOrden = string.IsNullOrEmpty(_frontendBaseUrl)
                        ? "#"
                        : ordenesDelUsuario.Count == 1
                            ? $"{_frontendBaseUrl}/autorizaciones?idOrden={ordenesDelUsuario[0].IdOrden}"
                            : $"{_frontendBaseUrl}/autorizaciones";

                    var ctx = new Dictionary<string, string>
                    {
                        ["NombreResponsable"] = nombresUsuarios.TryGetValue(idUsuario, out var nombre) ? nombre : $"Usuario {idUsuario}",
                        ["CantidadPendientes"] = ordenesDelUsuario.Count.ToString(),
                        ["DiasEspera"] = diasEspera.ToString(),
                        ["ListadoPendientes"] = listadoHtml,
                        ["Folios"] = folios,
                        ["Folio"] = ordenesDelUsuario.Count == 1 ? ordenesDelUsuario[0].Folio : folios,
                        ["Total"] = ordenesDelUsuario.Count == 1 ? ordenesDelUsuario[0].Total.ToString("C2") : "",
                        ["UrlOrden"] = urlOrden,
                        ["ColorTema"] = "#d97706",
                        ["Icono"] = "⏰",
                        ["Asunto"] = canalInAppTemplate?.AsuntoTemplate ?? canalEmailTemplate?.AsuntoTemplate ?? "Recordatorio",
                    };

                    var asuntoInApp = Interpolate(canalInAppTemplate?.AsuntoTemplate ?? canalEmailTemplate!.AsuntoTemplate ?? "Recordatorio", ctx);
                    var cuerpoInApp = Interpolate(canalInAppTemplate?.CuerpoTemplate ?? canalEmailTemplate!.CuerpoTemplate, ctx);

                    string? cuerpoEmail = null;
                    string? asuntoEmail = null;
                    if (rec.EnviarEmail)
                    {
                        if (canalEmailTemplate == null)
                        {
                            _logger.LogWarning("Recordatorio {Id}: EnviarEmail=true pero sin canal email configurado.", rec.IdRecordatorio);
                        }
                        else
                        {
                            asuntoEmail = Interpolate(canalEmailTemplate.AsuntoTemplate ?? "Recordatorio", ctx);
                            cuerpoEmail = Interpolate(canalEmailTemplate.CuerpoTemplate, ctx);
                            ctx["Asunto"] = asuntoEmail;

                            var layoutWrapper = await _db.WorkflowCanalTemplates
                                .FirstOrDefaultAsync(t => t.CodigoCanal == "email" && t.Activo, ct);
                            if (layoutWrapper != null)
                            {
                                cuerpoEmail = layoutWrapper.LayoutHtml.Replace("{{Contenido}}", cuerpoEmail, StringComparison.OrdinalIgnoreCase);
                                cuerpoEmail = Interpolate(cuerpoEmail, ctx);
                            }
                        }
                    }

                    var log = new WorkflowRecordatorioLog
                    {
                        IdRecordatorio = rec.IdRecordatorio,
                        IdUsuario = idUsuario,
                        OrdenesIncluidas = ordenesDelUsuario.Count,
                        FechaEnvio = ahora,
                        Canal = rec.EnviarEmail ? "email" : "inapp",
                        Estado = "enviado"
                    };

                    try
                    {
                        var channels = new List<NotificationChannelRequest>
                        {
                            new NotificationChannelRequest { ChannelType = "in-app", UserIds = new List<int> { idUsuario } }
                        };
                        if (rec.EnviarEmail)
                            channels.Add(new NotificationChannelRequest
                            {
                                ChannelType = "email",
                                UserIds = new List<int> { idUsuario },
                                ChannelSpecificData = new Dictionary<string, object> { ["subject"] = asuntoEmail! }
                            });
                        if (rec.EnviarWhatsapp && canalWhatsappTemplate != null)
                            channels.Add(new NotificationChannelRequest
                            {
                                ChannelType = "whatsapp",
                                UserIds = new List<int> { idUsuario },
                                ChannelSpecificData = new Dictionary<string, object> { ["body"] = Interpolate(canalWhatsappTemplate.CuerpoTemplate, ctx) }
                            });
                        if (rec.EnviarTelegram && canalTelegramTemplate != null)
                            channels.Add(new NotificationChannelRequest
                            {
                                ChannelType = "telegram",
                                UserIds = new List<int> { idUsuario },
                                ChannelSpecificData = new Dictionary<string, object> { ["body"] = Interpolate(canalTelegramTemplate.CuerpoTemplate, ctx) }
                            });

                        await _notifService.SendAsync(new SendNotificationRequest
                        {
                            Title = asuntoInApp,
                            Message = rec.EnviarEmail ? cuerpoEmail! : cuerpoInApp,
                            Type = "recordatorio",
                            Priority = "normal",
                            Category = "order",
                            Channels = channels
                        }, ct);

                        enviados++;
                        _logger.LogInformation("WorkflowReminderService: recordatorio [{Id}] enviado a usuario {IdUsuario} ({CantOrdenes} órdenes)",
                            rec.IdRecordatorio, idUsuario, ordenesDelUsuario.Count);
                    }
                    catch (Exception ex)
                    {
                        log.Estado = "error";
                        log.DetalleError = ex.Message[..Math.Min(ex.Message.Length, 490)];
                        _logger.LogWarning(ex, "WorkflowReminderService: error enviando recordatorio {Id} a usuario {IdUsuario}", rec.IdRecordatorio, idUsuario);
                    }

                    _db.WorkflowRecordatorioLogs.Add(log);
                }

                await _db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WorkflowReminderService: error procesando recordatorio {IdRecordatorio}", rec.IdRecordatorio);
            }

            return enviados;
        }

        private static string BuildListadoHtml(List<OrdenCompra> ordenes, string? rowTemplate = null)
        {
            var sb = new StringBuilder();
            sb.Append("<table style='width:100%;border-collapse:collapse;font-size:13px'>");
            sb.Append("<tr style='background:#f3f4f6'><th style='padding:6px 10px;text-align:left'>Folio</th><th style='padding:6px 10px;text-align:left'>Proveedor</th><th style='padding:6px 10px;text-align:right'>Total</th><th style='padding:6px 10px;text-align:right'>Días</th></tr>");
            foreach (var o in ordenes.Take(10))
            {
                if (!string.IsNullOrWhiteSpace(rowTemplate))
                {
                    var rowCtx = new Dictionary<string, string>
                    {
                        ["Folio"] = o.Folio,
                        ["Proveedor"] = o.Proveedor?.RazonSocial ?? "",
                        ["Total"] = o.Total.ToString("C2"),
                        ["DiasEspera"] = ((int)(DateTime.UtcNow - o.FechaSolicitud).TotalDays).ToString()
                    };
                    sb.Append(Interpolate(rowTemplate, rowCtx));
                }
                else
                {
                    var dias = (int)(DateTime.UtcNow - o.FechaSolicitud).TotalDays;
                    sb.Append($"<tr style='border-top:1px solid #e5e7eb'>" +
                        $"<td style='padding:6px 10px'>{o.Folio}</td>" +
                        $"<td style='padding:6px 10px'>{o.Proveedor?.RazonSocial}</td>" +
                        $"<td style='padding:6px 10px;text-align:right'>{o.Total:C2}</td>" +
                        $"<td style='padding:6px 10px;text-align:right;color:{(dias > 3 ? "#dc2626" : "#374151")}'>{dias}d</td>" +
                        $"</tr>");
                }
            }
            if (ordenes.Count > 10)
                sb.Append($"<tr><td colspan='4' style='padding:6px 10px;color:#6b7280'>... y {ordenes.Count - 10} más</td></tr>");
            sb.Append("</table>");
            return sb.ToString();
        }

        private static string Interpolate(string template, Dictionary<string, string> ctx)
        {
            foreach (var (key, value) in ctx)
                template = template.Replace($"{{{{{key}}}}}", value, StringComparison.OrdinalIgnoreCase);
            return template;
        }
    }
}
