using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text;

namespace Lefarma.API.Features.Config.Workflows.Notification
{
    public class WorkflowReminderService
    {
        private readonly ApplicationDbContext _db;
        private readonly AsokamDbContext _asokamDb;
        private readonly IJefeInmediatoResolver _jefeInmediatoResolver;
        private readonly INotificationService _notifService;
        private readonly ILogger<WorkflowReminderService> _logger;
        private readonly string _frontendBaseUrl;

        public WorkflowReminderService(
            ApplicationDbContext db,
            AsokamDbContext asokamDb,
            IJefeInmediatoResolver jefeInmediatoResolver,
            INotificationService notifService,
            ILogger<WorkflowReminderService> logger,
            IConfiguration configuration)
        {
            _db = db;
            _asokamDb = asokamDb;
            _jefeInmediatoResolver = jefeInmediatoResolver;
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
                var entities = await ResolveEntitiesAsync(rec, ahora, ct);

                if (rec.MinDiasEnPaso.HasValue)
                    entities = entities.Where(e => e.FechaEnPaso.HasValue && (ahora - e.FechaEnPaso.Value).TotalDays >= rec.MinDiasEnPaso.Value).ToList();

                if (!entities.Any())
                {
                    _logger.LogInformation("WorkflowReminderService: recordatorio [{Id}] — sin entidades pendientes, omitiendo", rec.IdRecordatorio);
                    return 0;
                }

                var pasosConEntidades = entities.Select(e => e.IdPasoActual!.Value).Distinct().ToList();
                var participantes = await _db.WorkflowParticipantes
                    .Where(p => pasosConEntidades.Contains(p.IdPaso) && p.Activo)
                    .ToListAsync(ct);

                var usuariosDirectos = participantes
                    .Where(p => p.IdUsuario.HasValue)
                    .Select(p => p.IdUsuario!.Value)
                    .Distinct()
                    .ToList();

                var idsCreadores = entities
                    .Where(e => e.IdUsuarioCreador.HasValue)
                    .Select(e => e.IdUsuarioCreador!.Value)
                    .Distinct()
                    .ToList();

                var creadoresConJefe = new Dictionary<int, int?>();
                foreach (var idCreador in idsCreadores)
                {
                    var idJefe = await _jefeInmediatoResolver.ResolverIdUsuarioJefeAsync(idCreador);
                    creadoresConJefe[idCreador] = idJefe;
                }

                var idsJefesDirectos = new HashSet<int>();
                foreach (var entity in entities)
                {
                    if (entity.IdUsuarioCreador.HasValue &&
                        creadoresConJefe.TryGetValue(entity.IdUsuarioCreador.Value, out var idJefe) &&
                        idJefe.HasValue &&
                        participantes.Any(p => p.RequiereJefeInmediato && p.IdPaso == entity.IdPasoActual))
                    {
                        idsJefesDirectos.Add(idJefe.Value);
                    }
                }

                var todosLosIds = usuariosDirectos.Concat(idsJefesDirectos).Distinct().ToList();

                var nombresUsuarios = await _asokamDb.Usuarios
                    .Where(u => todosLosIds.Contains(u.IdUsuario))
                    .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? $"Usuario {u.IdUsuario}", ct);

                _logger.LogInformation("WorkflowReminderService: recordatorio [{Id}] — {CantEntidades} entidad(es), {CantUsuarios} usuario(s), {CantJefes} jefe(s)",
                    rec.IdRecordatorio, entities.Count, usuariosDirectos.Count, idsJefesDirectos.Count);

                foreach (var idUsuario in todosLosIds)
                {
                    if (rec.MinOrdenesPendientes.HasValue && entities.Count < rec.MinOrdenesPendientes.Value)
                        continue;

                    var diasEspera = entities.Max(e => e.FechaEnPaso.HasValue ? (int)(ahora - e.FechaEnPaso.Value).TotalDays : 1);

                    var canalEmailTemplate = rec.Canales.FirstOrDefault(c => c.CodigoCanal == "email" && c.Activo);
                    var canalInAppTemplate = rec.Canales.FirstOrDefault(c => c.CodigoCanal == "in_app" && c.Activo);
                    var canalWhatsappTemplate = rec.Canales.FirstOrDefault(c => c.CodigoCanal == "whatsapp" && c.Activo);
                    var canalTelegramTemplate = rec.Canales.FirstOrDefault(c => c.CodigoCanal == "telegram" && c.Activo);

                    if (canalInAppTemplate == null && canalEmailTemplate == null)
                    {
                        _logger.LogWarning("Recordatorio {Id}: sin canal in_app ni email activo, se omite.", rec.IdRecordatorio);
                        continue;
                    }

                    var listadoHtml = BuildListadoHtml(entities, canalEmailTemplate?.ListadoRowHtml ?? canalInAppTemplate?.ListadoRowHtml);
                    var folios = string.Join(", ", entities.Select(e => e.Folio));

                    var urlEntidad = BuildEntityUrl(entities);

                    var ctx = new Dictionary<string, string>
                    {
                        ["NombreResponsable"] = nombresUsuarios.TryGetValue(idUsuario, out var nombre) ? nombre : $"Usuario {idUsuario}",
                        ["CantidadPendientes"] = entities.Count.ToString(),
                        ["DiasEspera"] = diasEspera.ToString(),
                        ["ListadoPendientes"] = listadoHtml,
                        ["Folios"] = folios,
                        ["Folio"] = entities.Count == 1 ? entities[0].Folio : folios,
                        ["Total"] = entities.Count == 1 && entities[0].MontoTotal.HasValue ? entities[0].MontoTotal.Value.ToString("C2") : "",
                        ["UrlOrden"] = urlEntidad,
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
                        OrdenesIncluidas = entities.Count,
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
                        _logger.LogInformation("WorkflowReminderService: recordatorio [{Id}] enviado a usuario {IdUsuario} ({CantEntidades} entidades)",
                            rec.IdRecordatorio, idUsuario, entities.Count);
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

        private async Task<List<ReminderEntity>> ResolveEntitiesAsync(
            WorkflowRecordatorio rec, DateTime ahora, CancellationToken ct)
        {
            var workflow = rec.Workflow ?? await _db.Workflows.FindAsync(rec.IdWorkflow);
            if (workflow == null)
            {
                _logger.LogWarning("WorkflowReminderService: recordatorio [{Id}] — workflow {IdWorkflow} no encontrado", rec.IdRecordatorio, rec.IdWorkflow);
                return new();
            }

            var pasosIds = rec.IdPaso.HasValue
                ? new List<int> { rec.IdPaso.Value }
                : await _db.WorkflowPasos
                    .Where(p => p.IdWorkflow == rec.IdWorkflow)
                    .Select(p => p.IdPaso)
                    .ToListAsync(ct);

            return workflow.CodigoProceso switch
            {
                CodigoProceso.ORDEN_COMPRA => await ResolveOrdenesCompraAsync(pasosIds, rec, ahora, ct),
                CodigoProceso.SOLICITUD_PERSONAL => await ResolveSolicitudesPersonalAsync(pasosIds, rec, ahora, ct),
                _ => new()
            };
        }

        private async Task<List<ReminderEntity>> ResolveOrdenesCompraAsync(
            List<int> pasosIds, WorkflowRecordatorio rec, DateTime ahora, CancellationToken ct)
        {
            var query = _db.OrdenesCompra
                .Include(o => o.Proveedor)
                .Where(o => o.IdPasoActual != null && pasosIds.Contains(o.IdPasoActual.Value));

            if (rec.MontoMinimo.HasValue) query = query.Where(o => o.Total >= rec.MontoMinimo.Value);
            if (rec.MontoMaximo.HasValue) query = query.Where(o => o.Total <= rec.MontoMaximo.Value);

            var ordenes = await query.ToListAsync(ct);

            return ordenes.Select(o => new ReminderEntity
            {
                Id = o.IdOrden,
                IdWorkflow = o.IdWorkflow,
                IdPasoActual = o.IdPasoActual,
                Folio = o.Folio,
                MontoTotal = o.Total,
                FechaEnPaso = o.FechaSolicitud,
                EtiquetaExtra = o.Proveedor?.RazonSocial,
                TipoEntidad = CodigoProceso.ORDEN_COMPRA,
                IdUsuarioCreador = o.IdUsuarioCreador
            }).ToList();
        }

        private async Task<List<ReminderEntity>> ResolveSolicitudesPersonalAsync(
            List<int> pasosIds, WorkflowRecordatorio rec, DateTime ahora, CancellationToken ct)
        {
            var query = _db.SolicitudesPersonal
                .Where(s => s.IdPasoActual != null && pasosIds.Contains(s.IdPasoActual.Value));

            var solicitudes = await query.ToListAsync(ct);

            return solicitudes.Select(s => new ReminderEntity
            {
                Id = s.IdSolicitud,
                IdWorkflow = s.IdWorkflow,
                IdPasoActual = s.IdPasoActual,
                Folio = s.Folio,
                MontoTotal = null,
                FechaEnPaso = s.FechaEnvio,
                EtiquetaExtra = s.Area?.Nombre,
                TipoEntidad = CodigoProceso.SOLICITUD_PERSONAL,
                IdUsuarioCreador = s.IdUsuarioCreador
            }).ToList();
        }

        private string BuildEntityUrl(List<ReminderEntity> entities)
        {
            if (string.IsNullOrEmpty(_frontendBaseUrl))
                return "#";

            if (entities.Count == 1)
            {
                var e = entities[0];
                return e.TipoEntidad switch
                {
                    CodigoProceso.ORDEN_COMPRA => $"{_frontendBaseUrl}/autorizaciones?idOrden={e.Id}",
                    CodigoProceso.SOLICITUD_PERSONAL => $"{_frontendBaseUrl}/autorizaciones?idSolicitud={e.Id}",
                    _ => $"{_frontendBaseUrl}/autorizaciones"
                };
            }

            return $"{_frontendBaseUrl}/autorizaciones";
        }

        private static string BuildListadoHtml(List<ReminderEntity> entities, string? rowTemplate = null)
        {
            var sb = new StringBuilder();
            sb.Append("<table style='width:100%;border-collapse:collapse;font-size:13px'>");
            sb.Append("<tr style='background:#f3f4f6'><th style='padding:6px 10px;text-align:left'>Folio</th><th style='padding:6px 10px;text-align:left'>Detalle</th><th style='padding:6px 10px;text-align:right'>Monto</th><th style='padding:6px 10px;text-align:right'>Días</th></tr>");
            foreach (var e in entities.Take(10))
            {
                if (!string.IsNullOrWhiteSpace(rowTemplate))
                {
                    var rowCtx = new Dictionary<string, string>
                    {
                        ["Folio"] = e.Folio,
                        ["Proveedor"] = e.EtiquetaExtra ?? "",
                        ["Detalle"] = e.EtiquetaExtra ?? "",
                        ["Total"] = e.MontoTotal?.ToString("C2") ?? "",
                        ["DiasEspera"] = e.FechaEnPaso.HasValue ? ((int)(DateTime.Now - e.FechaEnPaso).Value.TotalDays).ToString() : "0"
                    };
                    sb.Append(Interpolate(rowTemplate, rowCtx));
                }
                else
                {
                    var dias = e.FechaEnPaso.HasValue ? (int)(DateTime.Now - e.FechaEnPaso).Value.TotalDays : 0;
                    var montoStr = e.MontoTotal?.ToString("C2") ?? "—";
                    sb.Append($"<tr style='border-top:1px solid #e5e7eb'>" +
                        $"<td style='padding:6px 10px'>{e.Folio}</td>" +
                        $"<td style='padding:6px 10px'>{e.EtiquetaExtra ?? ""}</td>" +
                        $"<td style='padding:6px 10px;text-align:right'>{montoStr}</td>" +
                        $"<td style='padding:6px 10px;text-align:right;color:{(dias > 3 ? "#dc2626" : "#374151")}'>{dias}d</td>" +
                        $"</tr>");
                }
            }
            if (entities.Count > 10)
                sb.Append($"<tr><td colspan='4' style='padding:6px 10px;color:#6b7280'>... y {entities.Count - 10} más</td></tr>");
            sb.Append("</table>");
            return sb.ToString();
        }

        private static string Interpolate(string template, Dictionary<string, string> ctx)
        {
            foreach (var (key, value) in ctx)
                template = template.Replace($"{{{{{key}}}}}", value, StringComparison.OrdinalIgnoreCase);
            return template;
        }

        public sealed class ReminderEntity
        {
            public int Id { get; init; }
            public int IdWorkflow { get; init; }
            public int? IdPasoActual { get; init; }
            public string Folio { get; init; } = null!;
            public decimal? MontoTotal { get; init; }
            public DateTime? FechaEnPaso { get; init; }
            public string? EtiquetaExtra { get; init; }
            public string TipoEntidad { get; init; } = null!;
            public int? IdUsuarioCreador { get; init; }
        }
    }
}
