using System.Globalization;
using System.Text;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;
using Lefarma.API.Features.Rh.SolicitudesPersonal.Settings;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Helpers;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Models;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Rh.IncidenciasChecado;

public class IncidenciasChecadoNotificacionService : BaseService, IIncidenciasChecadoNotificacionService
{
    private readonly IIncidenciasChecadoPlantillaRepository _plantillaRepository;
    private readonly IIncidenciasChecadoRepository _incidenciasRepository;
    private readonly IEmpleadoRepository _empleadoRepository;
    private readonly INotificationService _notificationService;
    private readonly IUsuarioConfiguracionRepository _usuarioConfiguracionRepository;
    private readonly IIncidenciaChecadoConfigService _descuentoService;
    private readonly ApplicationDbContext _applicationDbContext;
    private readonly AsokamDbContext _asokamContext;
    private readonly int _limiteDescuentosJustificadosMes;

    protected override string EntityName => "IncidenciasChecadoNotificacion";

    private const string TardanzaEntrada = "TARDANZA_ENTRADA";
    private const string TardanzaSalida = "TARDANZA_SALIDA";
    private const string SalidaAnticipada = "SALIDA_ANTICIPADA";
    private const string OmisionEntrada = "OMISION_ENTRADA";
    private const string OmisionSalida = "OMISION_SALIDA";

    public IncidenciasChecadoNotificacionService(
        IIncidenciasChecadoPlantillaRepository plantillaRepository,
        IIncidenciasChecadoRepository incidenciasRepository,
        IEmpleadoRepository empleadoRepository,
        INotificationService notificationService,
        IUsuarioConfiguracionRepository usuarioConfiguracionRepository,
        IIncidenciaChecadoConfigService descuentoService,
        ApplicationDbContext applicationDbContext,
        AsokamDbContext asokamContext,
        IOptions<SolicitudesPersonalSettings> solicitudesSettings,
        IWideEventAccessor wideEventAccessor)
        : base(wideEventAccessor)
    {
        _plantillaRepository = plantillaRepository;
        _incidenciasRepository = incidenciasRepository;
        _empleadoRepository = empleadoRepository;
        _notificationService = notificationService;
        _usuarioConfiguracionRepository = usuarioConfiguracionRepository;
        _descuentoService = descuentoService;
        _applicationDbContext = applicationDbContext;
        _asokamContext = asokamContext;
        _limiteDescuentosJustificadosMes = Math.Max(1, solicitudesSettings.Value.LimiteDescuentosJustificadosMes);
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

            var reglasDescuento = await _applicationDbContext.IncidenciasChecadoConfig
                .AsNoTracking()
                .Where(r => r.Activo)
                .OrderByDescending(r => r.Prioridad)
                .ToListAsync(cancellationToken);
            var reglasDescuentoTexto = ReglasDescuentoHelper.FormatearTexto(reglasDescuento);

            foreach (var nomina in request.Nominas.Distinct())
            {
                var items = await ObtenerIncidenciasParaNotificacionAsync(
                    nomina,
                    fechaInicio,
                    fechaFin,
                    request.TieneIncidenciaEntrada,
                    request.TieneIncidenciaSalida,
                    request.TieneIncidenciaOmision,
                    cancellationToken);
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

                var nombreEmpleado = items.First().Nombre ?? string.Empty;
                if (idUsuario.HasValue)
                {
                    var samAccountName = await _asokamContext.Usuarios
                        .AsNoTracking()
                        .Where(u => u.IdUsuario == idUsuario.Value)
                        .Select(u => u.SamAccountName)
                        .FirstOrDefaultAsync(cancellationToken);
                    if (!string.IsNullOrWhiteSpace(samAccountName))
                    {
                        nombreEmpleado = $"{samAccountName} - {nombreEmpleado}";
                    }
                }

                // Determinar destinatarios
                var itemPorEmpleado = request.EmpleadosDestinatarios?.FirstOrDefault(e => e.Nomina == nomina);

                var destinatarios = new List<int>();
                bool copiarAUsuario = false;

                if (itemPorEmpleado != null)
                {
                    // Usar configuración por empleado
                    destinatarios.AddRange(itemPorEmpleado.SelectedUserIds);
                    copiarAUsuario = itemPorEmpleado.CopiarAUsuarioIncidencia;
                }
                else
                {
                    // Usar configuración general
                    if (request.SelectedUserIds != null)
                        destinatarios.AddRange(request.SelectedUserIds);
                    copiarAUsuario = request.CopiarAUsuarioIncidencia;
                }

                if (copiarAUsuario && idUsuario.HasValue)
                {
                    destinatarios.Add(idUsuario.Value);
                }

                destinatarios = destinatarios.Distinct().ToList();

                if (destinatarios.Count == 0)
                {
                    resultados.Add(new NotificacionPersonaResult
                    {
                        Nomina = nomina,
                        Nombre = items.FirstOrDefault()?.Nombre,
                        Exitoso = false,
                        Error = "No se seleccionó ningún destinatario para la notificación."
                    });
                    continue;
                }

                var tablaHtml = BuildTablaIncidenciasHtml(items);
                var variables = ConstruirVariables(
                    items,
                    nombreEmpleado,
                    fechaInicio,
                    fechaFin,
                    request.Periodo,
                    _limiteDescuentosJustificadosMes,
                    reglasDescuentoTexto,
                    tablaHtml);
                var asunto = AplicarVariablesResumen(request.Asunto, variables);
                var mensaje = AplicarVariablesResumen(request.Mensaje, variables);

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
                    TemplateData = ConstruirTemplateData(variables),
                    Channels = new List<NotificationChannelRequest>
                    {
                        new()
                        {
                            ChannelType = "email",
                            UserIds = destinatarios,
                            ChannelSpecificData = new Dictionary<string, object> { ["fromName"] = "Recursos Humanos" }
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

            // Guardar defaults por empleado si se envió configuración individual
            if (idUsuarioEnviador.HasValue && request.EmpleadosDestinatarios != null)
            {
                foreach (var item in request.EmpleadosDestinatarios)
                {
                    try
                    {
                        var idUsuarioEmpleado = await _empleadoRepository.ResolverIdUsuarioPorNominaAsync(
                            item.Nomina, cancellationToken);
                        if (idUsuarioEmpleado.HasValue && item.SelectedUserIds.Count > 0)
                        {
                            await _usuarioConfiguracionRepository.GuardarDestinatariosDefaultAsync(
                                idUsuarioEmpleado.Value,
                                item.SelectedUserIds,
                                cancellationToken);
                        }
                    }
                    catch (Exception ex)
                    {
                        EnrichWideEvent("GuardarDestinatariosDefault", exception: ex);
                    }
                }
            }
            // Si no se envió configuración individual, guardar configuración general   
            else if (idUsuarioEnviador.HasValue && request.SelectedUserIds != null && request.SelectedUserIds.Count > 0)
            {
                try
                {
                    await _usuarioConfiguracionRepository.GuardarDestinatariosDefaultAsync(
                        idUsuarioEnviador.Value,
                        request.SelectedUserIds,
                        cancellationToken);
                }
                catch (Exception ex)
                {
                    EnrichWideEvent("GuardarDestinatariosDefault", exception: ex);
                }
            }

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
        bool tieneIncidenciaEntrada,
        bool tieneIncidenciaSalida,
        bool tieneIncidenciaOmision,
        CancellationToken cancellationToken)
    {
        var query = _incidenciasRepository.GetQueryable()
            .Where(x => x.Nomina == nomina && x.Fecha >= fechaInicio && x.Fecha <= fechaFin)
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
        await _descuentoService.EnriquecerDescuentosAsync(resultado, cancellationToken);

        return resultado
            .Where(i => CumpleFiltroTipos(i, tieneIncidenciaEntrada, tieneIncidenciaSalida, tieneIncidenciaOmision))
            .ToList();
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
            .Include(s => s.Estado)
            .Include(s => s.TipoSolicitud)
            .Where(s =>
                idUsuarios.Contains(s.IdUsuarioSolicitante ?? s.IdUsuarioCreador)
                && s.FechaInicio.HasValue
                && s.Estado != null
                && s.Estado.Codigo != WorkflowEstadoCodigo.CANCELADA
                && s.Estado.Codigo != WorkflowEstadoCodigo.RECHAZADA
                && s.TipoSolicitud != null
                && s.TipoSolicitud.Categoria == CategoriaSolicitud.Incidencia
                && s.FechaInicio.Value.Date <= fechaMax.Date
                && (!s.FechaFin.HasValue || s.FechaFin.Value.Date >= fechaMin.Date))
            .Select(s => new
            {
                s.IdUsuarioCreador,
                s.IdUsuarioSolicitante,
                s.IdSolicitud,
                FechaInicio = s.FechaInicio!.Value,
                FechaFin = s.FechaFin,
                EstadoCodigo = s.Estado!.Codigo,
                TipoSolicitudNombre = s.TipoSolicitud != null ? s.TipoSolicitud.Nombre : null
            })
            .ToListAsync(cancellationToken);

        var fechasDetalle = await JustificacionSolicitudHelper.ObtenerFechasDetalleAsync(
            _applicationDbContext, solicitudes.Select(s => s.IdSolicitud), cancellationToken);

        var usuarioSolicitudes = solicitudes
            .Join(
                nominaUsuario,
                s => s.IdUsuarioSolicitante ?? s.IdUsuarioCreador,
                nu => nu.Value,
                (s, nu) => new { Nomina = nu.Key, Solicitud = s })
            .GroupBy(x => x.Nomina)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Solicitud).ToList());

        foreach (var item in items)
        {
            if (!usuarioSolicitudes.TryGetValue(item.Nomina, out var solicitudesEmpleado))
                continue;

            var itemDate = item.Fecha.Date;
            var coincidencias = solicitudesEmpleado
                .Where(s => JustificacionSolicitudHelper.SolicitudCubreFecha(
                    s.IdSolicitud, s.FechaInicio, s.FechaFin, itemDate, fechasDetalle))
                .ToList();

            if (coincidencias.Count == 0)
                continue;

            var cerrada = coincidencias.FirstOrDefault(s => s.EstadoCodigo == WorkflowEstadoCodigo.CERRADA);
            if (cerrada is not null)
            {
                item.Justificada = true;
                item.IdSolicitud = cerrada.IdSolicitud;
                item.TipoSolicitudNombre = cerrada.TipoSolicitudNombre;
                continue;
            }

            var enTramite = coincidencias[0];
            item.EnTramite = true;
            item.IdSolicitud = enTramite.IdSolicitud;
            item.TipoSolicitudNombre = enTramite.TipoSolicitudNombre;
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

    internal static Dictionary<string, string> ConstruirVariables(
        IReadOnlyList<NotificarIncidenciaItemRequest> items,
        string nombreEmpleado,
        DateTime fechaInicio,
        DateTime fechaFin,
        string? periodo,
        int limiteDescuentosJustificados,
        string reglasDescuento,
        string tablaHtml)
    {
        // Los descuentos se cuentan por día (igual que el tope): un día sin checadas
        // (omisión de entrada y salida) es un solo descuento/justificante.
        var diasConDescuento = items.Count(i => i.IncidenciasCalculadas.Any(c => c.GeneraDescuento));
        var diasJustificados = items.Count(i => i.Justificada && i.IncidenciasCalculadas.Any(c => c.GeneraDescuentoTeorico));
        var diasEnTramite = items.Count(i => !i.Justificada && i.EnTramite && i.IncidenciasCalculadas.Any(c => c.GeneraDescuentoTeorico));

        return new Dictionary<string, string>
        {
            ["Nombre"] = nombreEmpleado,
            ["Nomina"] = items.Count > 0 ? items[0].Nomina.ToString() : string.Empty,
            ["Empresa"] = (items.Count > 0 ? items[0].Empresa : null) ?? string.Empty,
            ["Departamento"] = (items.Count > 0 ? items[0].Departamento : null) ?? string.Empty,
            ["Puesto"] = (items.Count > 0 ? items[0].Puesto : null) ?? string.Empty,
            ["FechaInicio"] = fechaInicio.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
            ["FechaFin"] = fechaFin.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
            ["Periodo"] = periodo ?? string.Empty,
            ["TotalIncidencias"] = items.Sum(i => i.IncidenciasCalculadas.Count).ToString(),
            ["TotalDescuentos"] = diasConDescuento.ToString(),
            ["DescuentosPorJustificar"] = diasConDescuento.ToString(),
            ["DescuentosJustificados"] = diasJustificados.ToString(),
            ["DescuentosEnTramite"] = diasEnTramite.ToString(),
            ["LimiteDescuentosJustificados"] = limiteDescuentosJustificados.ToString(),
            ["DescuentosRestantes"] = Math.Max(0, limiteDescuentosJustificados - diasJustificados - diasEnTramite).ToString(),
            ["DiasConDescuento"] = diasConDescuento.ToString(),
            ["FechasConDescuento"] = BuildFechasConDescuento(items),
            ["Retardos"] = items.Sum(i => i.IncidenciasCalculadas.Count(c => c.TipoIncidencia == TardanzaEntrada || c.TipoIncidencia == TardanzaSalida)).ToString(),
            ["Omisiones"] = items.Sum(i => i.IncidenciasCalculadas.Count(c => c.TipoIncidencia == OmisionEntrada || c.TipoIncidencia == OmisionSalida)).ToString(),
            ["SalidasAnticipadas"] = items.Sum(i => i.IncidenciasCalculadas.Count(c => c.TipoIncidencia == SalidaAnticipada)).ToString(),
            ["ReglasDescuento"] = reglasDescuento,
            ["TablaIncidencias"] = tablaHtml
        };
    }

    internal static string AplicarVariablesResumen(
        string? plantilla,
        IReadOnlyDictionary<string, string> variables)
    {
        if (string.IsNullOrEmpty(plantilla))
        {
            return string.Empty;
        }

        var sb = new StringBuilder(plantilla);
        foreach (var variable in variables)
        {
            sb.Replace($"{{{{{variable.Key}}}}}", variable.Value);
        }

        return sb.ToString();
    }

    private static Dictionary<string, object> ConstruirTemplateData(IReadOnlyDictionary<string, string> variables)
    {
        var data = variables.ToDictionary(v => v.Key, v => (object)v.Value);
        data["Origen"] = "resumen-empleados";
        return data;
    }

    internal static string BuildFechasConDescuento(IReadOnlyList<NotificarIncidenciaItemRequest> items)
    {
        var cultura = new CultureInfo("es-MX");

        var fechas = items
            .Where(i => i.Descuento || i.IncidenciasCalculadas.Any(c => c.GeneraDescuento))
            .Select(i => i.Fecha.Date)
            .Distinct()
            .OrderBy(f => f)
            .ToList();

        if (fechas.Count == 0)
            return "ninguno";

        return string.Join("; ", fechas
            .GroupBy(f => new { f.Year, f.Month })
            .Select(g =>
            {
                var dias = UnirConY(g.Select(f => f.Day.ToString()));
                var mes = new DateTime(g.Key.Year, g.Key.Month, 1).ToString("MMMM 'de' yyyy", cultura);
                return $"{dias} de {mes}";
            }));
    }

    private static string UnirConY(IEnumerable<string> valores)
    {
        var lista = valores.ToList();
        return lista.Count switch
        {
            0 => string.Empty,
            1 => lista[0],
            _ => string.Join(", ", lista.Take(lista.Count - 1)) + " y " + lista[^1]
        };
    }

    internal static string ConstruirMotivoIncidencia(
        NotificarIncidenciaItemRequest item,
        IncidenciaCalculadaDto incidencia)
    {
        var periodo = string.IsNullOrWhiteSpace(incidencia.EtiquetaPeriodo)
            ? string.Empty
            : $" · {incidencia.EtiquetaPeriodo}";
        var cantidad = incidencia.CantidadAcumulada;
        var posicion = incidencia.PosicionAcumulacion;

        if (item.Justificada)
            return "Justificado, no cuenta";
        if (item.EnTramite)
            return "En trámite, no cuenta";

        if (incidencia.GeneraDescuento)
        {
            return cantidad > 1 && posicion.HasValue
                ? $"{posicion}.º acumulado{periodo}"
                : $"Genera descuento{periodo}";
        }

        if (cantidad > 1 && posicion.HasValue)
            return $"{posicion}.º de {cantidad}{periodo}";

        return "-";
    }

    internal static string BuildTablaIncidenciasHtml(IReadOnlyList<NotificarIncidenciaItemRequest> items)
    {
        var cultura = new System.Globalization.CultureInfo("es-ES");
        var sb = new StringBuilder();
        sb.AppendLine("<table style=\"border-collapse: collapse; width: 100%; border: 1px solid #ccc;\">");
        sb.AppendLine("  <thead>");
        sb.AppendLine("    <tr style=\"background-color: #f5f5f5;\">");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">Fecha</th>");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">Día</th>");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">Entrada</th>");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">Entró</th>");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">Salida</th>");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">Salió</th>");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">Incidencia</th>");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">Acumulado</th>");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">Motivo</th>");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">Estatus</th>");
        sb.AppendLine("      <th style=\"padding: 4px 8px; border: 1px solid #ccc; text-align: left;\">¿Genera descuento?</th>");
        sb.AppendLine("    </tr>");
        sb.AppendLine("  </thead>");
        sb.AppendLine("  <tbody>");

        foreach (var item in items.OrderBy(i => i.Fecha))
        {
            if (item.IncidenciasCalculadas.Count == 0)
                continue;

            var fecha = item.Fecha.ToString("dd/MM/yyyy", cultura);
            var dia = item.Fecha.ToString("dddd", cultura);
            var entrada = item.Entrada ?? "-";
            var salida = item.Salida ?? "-";
            var entro = item.Entro ?? "-";
            var salio = item.Salio ?? "-";
            var estatus = item.Justificada ? "Justificada" : item.EnTramite ? "En trámite" : "Pendiente";

            foreach (var incidencia in item.IncidenciasCalculadas)
            {
                var descuento = incidencia.GeneraDescuento ? "Sí" : "No";
                var acumulado = incidencia.CantidadAcumulada > 1 && incidencia.PosicionAcumulacion.HasValue
                    ? $"{incidencia.PosicionAcumulacion}/{incidencia.CantidadAcumulada}"
                    : "-";
                var motivo = ConstruirMotivoIncidencia(item, incidencia);

                sb.AppendLine("    <tr>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{fecha}</td>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{dia}</td>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{entrada}</td>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{entro}</td>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{salida}</td>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{salio}</td>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{incidencia.Nombre}</td>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{acumulado}</td>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{motivo}</td>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{estatus}</td>");
                sb.AppendLine($"      <td style=\"padding: 4px 8px; border: 1px solid #ccc;\">{descuento}</td>");
                sb.AppendLine("    </tr>");
            }
        }

        sb.AppendLine("  </tbody>");
        sb.AppendLine("</table>");
        return sb.ToString();
    }

    public async Task<Result<List<EmpleadoDestinatariosResponse>>> GetDestinatariosPorNominasAsync(
    List<long> nominas, CancellationToken ct = default)
    {
        try
        {
            var resultado = new List<EmpleadoDestinatariosResponse>();

            foreach (var nomina in nominas.Distinct())
            {
                var nombreEmpleado = await _empleadoRepository.ObtenerNombreEmpleadoAsync(nomina, null, ct);
                var idUsuario = await _empleadoRepository.ResolverIdUsuarioPorNominaAsync(nomina, ct);

                var destinatarios = idUsuario.HasValue
                    ? await _usuarioConfiguracionRepository.GetDestinatariosDefaultAsync(idUsuario.Value, ct)
                    : new List<int>();

                resultado.Add(new EmpleadoDestinatariosResponse
                {
                    Nomina = nomina,
                    Nombre = nombreEmpleado ?? string.Empty,
                    DestinatariosDefault = destinatarios
                });
            }

            return Result<List<EmpleadoDestinatariosResponse>>.Success(resultado);
        }
        catch (Exception ex)
        {
            EnrichWideEvent("GetDestinatariosPorNominas", exception: ex);
            return Result<List<EmpleadoDestinatariosResponse>>.Failure(
                "Error al obtener los destinatarios por empleado.");
        }
    }

    private static bool CumpleFiltroTipos(
        NotificarIncidenciaItemRequest item,
        bool entrada,
        bool salida,
        bool omision)
    {
        var tipos = item.IncidenciasCalculadas;

        if (entrada && tipos.Any(i => i.TipoIncidencia == TardanzaEntrada))
            return true;
        if (salida && tipos.Any(i => i.TipoIncidencia == TardanzaSalida || i.TipoIncidencia == SalidaAnticipada))
            return true;
        if (omision && tipos.Any(i => i.TipoIncidencia == OmisionEntrada || i.TipoIncidencia == OmisionSalida))
            return true;

        return false;
    }
}
