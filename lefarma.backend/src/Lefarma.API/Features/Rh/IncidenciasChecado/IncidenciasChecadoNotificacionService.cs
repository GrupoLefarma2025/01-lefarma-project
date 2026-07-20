using System.Text;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Models;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Rh.IncidenciasChecado;

public class IncidenciasChecadoNotificacionService : BaseService, IIncidenciasChecadoNotificacionService
{
    private readonly IIncidenciasChecadoPlantillaRepository _plantillaRepository;
    private readonly IIncidenciasChecadoRepository _incidenciasRepository;
    private readonly IEmpleadoRepository _empleadoRepository;
    private readonly INotificationService _notificationService;
    private readonly ApplicationDbContext _applicationDbContext;

    protected override string EntityName => "IncidenciasChecadoNotificacion";

    public IncidenciasChecadoNotificacionService(
        IIncidenciasChecadoPlantillaRepository plantillaRepository,
        IIncidenciasChecadoRepository incidenciasRepository,
        IEmpleadoRepository empleadoRepository,
        INotificationService notificationService,
        ApplicationDbContext applicationDbContext,
        IWideEventAccessor wideEventAccessor)
        : base(wideEventAccessor)
    {
        _plantillaRepository = plantillaRepository;
        _incidenciasRepository = incidenciasRepository;
        _empleadoRepository = empleadoRepository;
        _notificationService = notificationService;
        _applicationDbContext = applicationDbContext;
    }

    public async Task<Result<List<PlantillaIncidenciaChecadoResponse>>> GetPlantillasAsync(
        CancellationToken cancellationToken = default)
    {
        try
        {
            var plantillas = await _plantillaRepository.GetActivosAsync(cancellationToken);

            var response = plantillas
                .Select(p => new PlantillaIncidenciaChecadoResponse
                {
                    IdPlantilla = p.IdPlantilla,
                    Codigo = p.Codigo,
                    Nombre = p.Nombre,
                    CodigoCanal = p.CodigoCanal,
                    Asunto = p.Asunto,
                    Cuerpo = p.Cuerpo,
                    EsDefecto = p.EsDefecto,
                    Activo = p.Activo
                })
                .ToList();

            EnrichWideEvent("GetPlantillas", count: response.Count);
            return Result<List<PlantillaIncidenciaChecadoResponse>>.Success(response);
        }
        catch (Exception ex)
        {
            EnrichWideEvent("GetPlantillas", exception: ex);
            return Result<List<PlantillaIncidenciaChecadoResponse>>.Failure(
                "Error al obtener las plantillas de incidencias de checado.");
        }
    }

    public async Task<Result<NotificarIncidenciasResumenResponse>> NotificarResumenAsync(
        NotificarIncidenciasResumenRequest request,
        int? idUsuarioEnviador,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (request.Nominas == null || request.Nominas.Count == 0)
            {
                return Result<NotificarIncidenciasResumenResponse>.Failure("Debe seleccionar al menos un empleado.");
            }

            if (string.IsNullOrWhiteSpace(request.Asunto) || string.IsNullOrWhiteSpace(request.Mensaje))
            {
                return Result<NotificarIncidenciasResumenResponse>.Failure("El asunto y el mensaje son obligatorios.");
            }

            if (!request.FechaInicio.HasValue || !request.FechaFin.HasValue)
            {
                return Result<NotificarIncidenciasResumenResponse>.Failure("Debe especificar el rango de fechas del período.");
            }

            var fechaInicio = request.FechaInicio.Value.Date;
            var fechaFin = request.FechaFin.Value.Date;
            var resultados = new List<NotificacionPersonaResult>();

            foreach (var nomina in request.Nominas.Distinct())
            {
                var items = await ObtenerIncidenciasParaNotificacionAsync(nomina, fechaInicio, fechaFin, cancellationToken);
                if (items.Count == 0)
                {
                    resultados.Add(new NotificacionPersonaResult
                    {
                        Nomina = nomina,
                        Exitoso = false,
                        Error = "No se encontraron incidencias en el período seleccionado."
                    });
                    continue;
                }

                var idUsuario = await _empleadoRepository.ResolverIdUsuarioPorNominaAsync(nomina, cancellationToken);
                if (!idUsuario.HasValue)
                {
                    resultados.Add(new NotificacionPersonaResult
                    {
                        Nomina = nomina,
                        Nombre = items.FirstOrDefault()?.Nombre,
                        Exitoso = false,
                        Error = $"No se encontró usuario del portal para la nómina {nomina}."
                    });
                    continue;
                }

                var tablaHtml = BuildTablaIncidenciasHtml(items);
                var asunto = AplicarVariablesResumen(request.Asunto, items, fechaInicio, fechaFin, tablaHtml);
                var mensaje = AplicarVariablesResumen(request.Mensaje, items, fechaInicio, fechaFin, tablaHtml);

                if (!mensaje.Contains("{{TablaIncidencias}}", StringComparison.OrdinalIgnoreCase) &&
                    !mensaje.Contains("<table", StringComparison.OrdinalIgnoreCase))
                {
                    mensaje += $"\n\n{tablaHtml}";
                }

                var mensajeFinal = await AplicarCanalTemplateAsync("email", asunto, mensaje, cancellationToken);

                var sendRequest = new SendNotificationRequest
                {
                    Title = asunto,
                    Message = mensajeFinal,
                    Type = "warning",
                    Category = "rh-incidencias-checado-resumen",
                    Priority = "normal",
                    TemplateData = new Dictionary<string, object>
                    {
                        ["Nomina"] = nomina,
                        ["Nombre"] = items.FirstOrDefault()?.Nombre ?? string.Empty,
                        ["FechaInicio"] = fechaInicio.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
                        ["FechaFin"] = fechaFin.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
                        ["Periodo"] = request.Periodo ?? string.Empty,
                        ["TotalIncidencias"] = items.Count,
                        ["Origen"] = "resumen-empleados"
                    },
                    Channels = new List<NotificationChannelRequest>
                    {
                        new()
                        {
                            ChannelType = "email",
                            //UserIds = new List<int> { idUsuario.Value }
                            UserIds = new List<int> { 70 }
                        }
                    }
                };

                var response = await _notificationService.SendAsync(sendRequest, cancellationToken);
                var exitoso = response.ChannelResults.Values.All(r => r.Success);

                _applicationDbContext.IncidenciasChecadoNotificacionesHistorial.Add(new IncidenciaChecadoNotificacionHistorial
                {
                    NotificationId = response.NotificationId,
                    Nomina = nomina,
                    Nombre = items.FirstOrDefault()?.Nombre,
                    Periodo = request.Periodo,
                    FechaInicio = fechaInicio,
                    FechaFin = fechaFin,
                    Asunto = asunto,
                    Mensaje = mensajeFinal,
                    Canales = "email",
                    Exitoso = exitoso,
                    Error = exitoso ? null : string.Join("; ", response.ChannelResults.Values.Where(r => !r.Success).Select(r => r.Message)),
                    EnviadoPor = idUsuarioEnviador,
                    FechaEnvio = DateTime.UtcNow
                });

                resultados.Add(new NotificacionPersonaResult
                {
                    Nomina = nomina,
                    Nombre = items.FirstOrDefault()?.Nombre,
                    Exitoso = exitoso,
                    Canales = response.ChannelResults.Select(r => new CanalNotificacionResult
                    {
                        TipoCanal = r.Key,
                        NotificationId = response.NotificationId,
                        Exitoso = r.Value.Success
                    }).ToList()
                });
            }

            await _applicationDbContext.SaveChangesAsync(cancellationToken);

            EnrichWideEvent("NotificarResumen", additionalContext: new Dictionary<string, object>
            {
                ["personas"] = resultados.Count,
                ["exitosas"] = resultados.Count(r => r.Exitoso),
                ["periodo"] = request.Periodo ?? string.Empty
            });

            return Result<NotificarIncidenciasResumenResponse>.Success(new NotificarIncidenciasResumenResponse
            {
                Resultados = resultados
            });
        }
        catch (Exception ex)
        {
            EnrichWideEvent("NotificarResumen", exception: ex);
            return Result<NotificarIncidenciasResumenResponse>.Failure(
                "Error al enviar las notificaciones de resumen de incidencias de checado.");
        }
    }

    private async Task<List<NotificarIncidenciaItemRequest>> ObtenerIncidenciasParaNotificacionAsync(
        long nomina,
        DateTime fechaInicio,
        DateTime fechaFin,
        CancellationToken cancellationToken)
    {
        var query = _incidenciasRepository.GetQueryable()
            .Where(x => x.Nomina == nomina && x.Fecha >= fechaInicio && x.Fecha <= fechaFin)
            .Where(x =>
                !string.IsNullOrWhiteSpace(x.IncidenciaEntrada) ||
                !string.IsNullOrWhiteSpace(x.IncidenciaSalida) ||
                !string.IsNullOrWhiteSpace(x.MsgError))
            .OrderByDescending(x => x.Fecha)
            .ThenBy(x => x.Nombre);

        var raw = await query
            .Select(x => new
            {
                x.Nomina,
                x.Fecha,
                x.Nombre,
                x.Empresa,
                x.Departamento,
                x.Puesto,
                x.Entrada,
                x.Salida,
                x.Entro,
                x.Salio,
                x.IncidenciaEntrada,
                x.IncidenciaSalida,
                x.MsgError
            })
            .ToListAsync(cancellationToken);

        var resultado = raw
            .Select(x => new NotificarIncidenciaItemRequest
            {
                Nomina = x.Nomina!.Value,
                Fecha = x.Fecha,
                Nombre = x.Nombre,
                Empresa = x.Empresa,
                Departamento = x.Departamento,
                Puesto = x.Puesto,
                Entrada = x.Entrada?.ToString(@"hh\:mm"),
                Salida = x.Salida?.ToString(@"hh\:mm"),
                Entro = x.Entro?.ToString(@"hh\:mm"),
                Salio = x.Salio?.ToString(@"hh\:mm"),
                IncidenciaEntrada = x.IncidenciaEntrada,
                IncidenciaSalida = x.IncidenciaSalida,
                MsgError = x.MsgError
            })
            .ToList();

        await EnriquecerJustificacionesAsync(resultado, cancellationToken);
        return resultado;
    }

    private async Task EnriquecerJustificacionesAsync(
        List<NotificarIncidenciaItemRequest> items,
        CancellationToken cancellationToken)
    {
        var nominas = items
            .Select(x => x.Nomina)
            .Distinct()
            .ToList();

        if (nominas.Count == 0)
            return;

        var nominaUsuario = await _empleadoRepository.ResolverIdsUsuarioPorNominasAsync(nominas, cancellationToken);
        var idUsuarios = nominaUsuario.Values.ToList();

        if (idUsuarios.Count == 0)
            return;

        var fechaMin = items.Min(x => x.Fecha);
        var fechaMax = items.Max(x => x.Fecha);

        var solicitudes = await _applicationDbContext.SolicitudesPersonal
            .AsNoTracking()
            .Where(s =>
                idUsuarios.Contains(s.IdUsuarioCreador)
                && s.FechaInicio.HasValue
                && s.FechaFin.HasValue
                && s.Estado != null
                && s.Estado.Codigo == WorkflowEstadoCodigo.CERRADA
                && s.FechaInicio.Value.Date <= fechaMax.Date
                && s.FechaFin.Value.Date >= fechaMin.Date)
            .Select(s => new
            {
                s.IdUsuarioCreador,
                s.IdSolicitud,
                FechaInicio = s.FechaInicio!.Value,
                FechaFin = s.FechaFin!.Value,
                TipoSolicitudNombre = s.TipoSolicitud != null ? s.TipoSolicitud.Nombre : null
            })
            .ToListAsync(cancellationToken);

        var usuarioSolicitudes = solicitudes
            .Join(
                nominaUsuario,
                s => s.IdUsuarioCreador,
                nu => nu.Value,
                (s, nu) => new { Nomina = nu.Key, Solicitud = s })
            .GroupBy(x => x.Nomina)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Solicitud).ToList());

        foreach (var item in items)
        {
            if (!usuarioSolicitudes.TryGetValue(item.Nomina, out var solicitudesEmpleado))
                continue;

            var itemDate = item.Fecha.Date;
            var matching = solicitudesEmpleado
                .FirstOrDefault(s => s.FechaInicio.Date <= itemDate && s.FechaFin.Date >= itemDate);

            if (matching == null)
                continue;

            item.Justificada = true;
            item.IdSolicitud = matching.IdSolicitud;
            item.TipoSolicitudNombre = matching.TipoSolicitudNombre;
        }
    }

    private async Task<string> AplicarCanalTemplateAsync(
        string codigoCanal,
        string asunto,
        string contenido,
        CancellationToken cancellationToken)
    {
        var templates = await _applicationDbContext.WorkflowCanalTemplates
            .AsNoTracking()
            .Where(t => t.CodigoCanal == codigoCanal && t.Activo)
            .ToListAsync(cancellationToken);

        var template = templates
            .FirstOrDefault(t => string.Equals(t.CodigoProceso, CodigoProceso.SOLICITUD_PERSONAL, StringComparison.OrdinalIgnoreCase));

        if (template == null || string.IsNullOrWhiteSpace(template.LayoutHtml))
        {
            return contenido;
        }

        var layout = template.LayoutHtml
            .Replace("{{Contenido}}", contenido, StringComparison.OrdinalIgnoreCase)
            .Replace("{{Asunto}}", asunto, StringComparison.OrdinalIgnoreCase)
            .Replace("{{ColorTema}}", "#0f2744", StringComparison.OrdinalIgnoreCase)
            .Replace("{{ColorClaro}}", "#e8f0fe", StringComparison.OrdinalIgnoreCase)
            .Replace("{{Icono}}", "\ud83d\udd14", StringComparison.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(template.UrlButton))
        {
            var url = template.UrlButton.Replace("{IdEntidad}", "", StringComparison.OrdinalIgnoreCase);
            layout = layout.Replace("{{UrlOrden}}", url, StringComparison.OrdinalIgnoreCase);
        }
        else
        {
            layout = layout.Replace("{{UrlOrden}}", "", StringComparison.OrdinalIgnoreCase);
        }

        return layout;
    }

    private static string AplicarVariablesResumen(
        string? plantilla,
        IReadOnlyList<NotificarIncidenciaItemRequest> items,
        DateTime fechaInicio,
        DateTime fechaFin,
        string? tablaHtml = null)
    {
        if (string.IsNullOrEmpty(plantilla))
        {
            return string.Empty;
        }

        if (items.Count == 0)
        {
            return plantilla;
        }

        var first = items[0];
        var sb = new StringBuilder(plantilla);
        sb.Replace("{{Nombre}}", first.Nombre ?? string.Empty);
        sb.Replace("{{Nomina}}", first.Nomina.ToString());
        sb.Replace("{{Empresa}}", first.Empresa ?? string.Empty);
        sb.Replace("{{Departamento}}", first.Departamento ?? string.Empty);
        sb.Replace("{{Puesto}}", first.Puesto ?? string.Empty);
        sb.Replace("{{FechaInicio}}", fechaInicio.ToString("dd/MM/yyyy", System.Globalization.CultureInfo.InvariantCulture));
        sb.Replace("{{FechaFin}}", fechaFin.ToString("dd/MM/yyyy", System.Globalization.CultureInfo.InvariantCulture));
        sb.Replace("{{TotalIncidencias}}", items.Count.ToString());
        sb.Replace("{{TablaIncidencias}}", tablaHtml ?? BuildTablaIncidenciasHtml(items));
        return sb.ToString();
    }

    private static string BuildTablaIncidenciasHtml(IReadOnlyList<NotificarIncidenciaItemRequest> items)
    {
        var cultura = new System.Globalization.CultureInfo("es-ES");
        var sb = new StringBuilder();
        sb.AppendLine("<table style=\"border-collapse: collapse; width: 100%; border: 1px solid #ccc;\">");
        sb.AppendLine("  <thead>");
        sb.AppendLine("    <tr style=\"background-color: #f5f5f5;\">");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">Fecha</th>");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">Día</th>");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">Entrada</th>");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">Salida</th>");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">Descripción</th>");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">Justificada</th>");
        sb.AppendLine("    </tr>");
        sb.AppendLine("  </thead>");
        sb.AppendLine("  <tbody>");

        foreach (var item in items.OrderBy(i => i.Fecha))
        {
            var fecha = item.Fecha.ToString("dd/MM/yyyy", cultura);
            var dia = item.Fecha.ToString("dddd", cultura);
            var entrada = item.Entrada ?? "-";
            var salida = item.Salida ?? "-";
            var justificada = item.Justificada ? "Sí" : "No";

            AgregarFila(item.IncidenciaEntrada);
            AgregarFila(item.IncidenciaSalida);
            AgregarFila(item.MsgError);

            void AgregarFila(string? descripcion)
            {
                if (string.IsNullOrWhiteSpace(descripcion))
                    return;

                sb.AppendLine("    <tr>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{fecha}</td>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{dia}</td>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{entrada}</td>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{salida}</td>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{descripcion}</td>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{justificada}</td>");
                sb.AppendLine("    </tr>");
            }
        }

        sb.AppendLine("  </tbody>");
        sb.AppendLine("</table>");
        return sb.ToString();
    }
}
