using System.Text;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Features.Telemetria.Consulta;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Telemetria.Avisos;

/// <summary>
/// Avisos proactivos: alerta cuando una huella de error nueva se repite dentro
/// de una ventana corta y manda un resumen diario. Es opcional (apagado por
/// omisión) porque depende del correo configurado en el servidor.
/// </summary>
public sealed class TelemetriaAvisos(
    IServiceScopeFactory scopes,
    IOptions<TelemetriaAvisosOpciones> opciones,
    ILogger<TelemetriaAvisos> log) : BackgroundService
{
    private readonly TelemetriaAvisosOpciones _opciones = opciones.Value;
    private readonly HashSet<string> _alertadas = new(StringComparer.Ordinal);
    private DateOnly _diaAlertas = DateOnly.FromDateTime(DateTime.Now);
    private DateOnly? _ultimoResumen;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_opciones.Habilitado || _opciones.Destinatarios.Count == 0)
        {
            log.LogInformation(
                "Telemetría: avisos proactivos apagados (Habilitado={Habilitado}, destinatarios={Destinatarios})",
                _opciones.Habilitado,
                _opciones.Destinatarios.Count);
            return;
        }

        var periodo = TimeSpan.FromMinutes(Math.Clamp(_opciones.PeriodoMinutos, 1, 60));
        using var temporizador = new PeriodicTimer(periodo);

        do
        {
            try
            {
                await ProcesarAsync(DateTime.Now, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (Exception ex)
            {
                log.LogWarning(ex, "Telemetría: falló una revisión de avisos");
            }
        }
        while (await EsperarAsync(temporizador, stoppingToken));
    }

    private static async Task<bool> EsperarAsync(PeriodicTimer temporizador, CancellationToken ct)
    {
        try
        {
            return await temporizador.WaitForNextTickAsync(ct);
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }

    /// <summary>Una pasada completa; separada del bucle para poder probarla.</summary>
    internal async Task ProcesarAsync(DateTime ahoraLocal, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var consulta = scope.ServiceProvider.GetRequiredService<ITelemetriaConsulta>();

        // La consulta ya devuelve colecciones vacías si las tablas no existen.
        await RevisarHuellasAsync(consulta, ahoraLocal.ToUniversalTime(), ct);
        await EnviarResumenAsync(consulta, ahoraLocal, ct);
    }

    private async Task RevisarHuellasAsync(ITelemetriaConsulta consulta, DateTime ahoraUtc, CancellationToken ct)
    {
        var dia = DateOnly.FromDateTime(ahoraUtc);
        if (dia != _diaAlertas)
        {
            _diaAlertas = dia;
            _alertadas.Clear();
        }

        var ventana = Math.Clamp(_opciones.VentanaAlertaMinutos, 1, 120);
        var minimo = Math.Max(2, _opciones.RepeticionesAlerta);
        var nuevas = await consulta.ObtenerHuellasNuevasAsync(
            ahoraUtc.AddMinutes(-ventana),
            minimo,
            20,
            ct);

        foreach (var huella in nuevas)
        {
            if (!_alertadas.Add(huella.Huella))
            {
                continue;
            }

            await EnviarAsync(
                $"Telemetría: error repetido en {huella.Ruta}",
                ConstruirAlerta(huella, ventana),
                ct);
        }
    }

    private async Task EnviarResumenAsync(ITelemetriaConsulta consulta, DateTime ahoraLocal, CancellationToken ct)
    {
        var dia = DateOnly.FromDateTime(ahoraLocal);
        if (ahoraLocal.Hour < _opciones.HoraResumen || _ultimoResumen == dia)
        {
            return;
        }

        var resumen = await consulta.ObtenerResumenAsync(
            ahoraLocal.AddDays(-1),
            ahoraLocal,
            0,
            10,
            ct);

        await EnviarAsync("Telemetría: resumen del día", ConstruirResumen(resumen, ahoraLocal), ct);
        _ultimoResumen = dia;
    }

    private async Task EnviarAsync(string asunto, string cuerpo, CancellationToken ct)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var notificaciones = scope.ServiceProvider.GetRequiredService<INotificationService>();

            await notificaciones.SendAsync(
                new SendNotificationRequest
                {
                    Title = asunto,
                    Message = cuerpo,
                    Type = "alert",
                    Priority = "normal",
                    Category = "telemetry",
                    Channels =
                    [
                        new NotificationChannelRequest
                        {
                            ChannelType = "email",
                            Emails = _opciones.Destinatarios,
                        },
                    ],
                },
                ct);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Telemetría: no se pudo enviar el aviso «{Asunto}»", asunto);
        }
    }

    internal static string ConstruirAlerta(HuellaErrorResumen huella, int ventanaMinutos)
    {
        var texto = new StringBuilder();
        texto.AppendLine($"La falla se repitió {huella.Ocurrencias} veces en los últimos {ventanaMinutos} minutos.");
        texto.AppendLine();
        texto.AppendLine($"Mensaje: {Recortar(huella.Mensaje, 500)}");
        texto.AppendLine($"Pantalla: {huella.Ruta}");
        texto.AppendLine($"Tipo: {huella.TipoError}");
        texto.AppendLine($"Usuarios afectados: {huella.UsuariosAfectados}");
        texto.AppendLine($"Primera vez: {huella.PrimeraVez:yyyy-MM-dd HH:mm:ss} UTC");
        texto.AppendLine($"Última vez: {huella.UltimaVez:yyyy-MM-dd HH:mm:ss} UTC");
        texto.AppendLine();
        texto.AppendLine($"Huella: {huella.Huella}");
        texto.AppendLine("Revísalo en el panel: Telemetría → Errores.");
        return texto.ToString();
    }

    internal static string ConstruirResumen(ResumenTelemetria resumen, DateTime ahoraLocal)
    {
        var texto = new StringBuilder();
        texto.AppendLine($"Resumen del {ahoraLocal.AddDays(-1):yyyy-MM-dd} al {ahoraLocal:yyyy-MM-dd HH:mm}.");
        texto.AppendLine();
        texto.AppendLine($"Errores de navegador en el periodo: {resumen.ErroresPeriodo}");
        texto.AppendLine($"Errores de hoy: {resumen.ErroresHoy}");
        texto.AppendLine($"Clics registrados: {resumen.ClicsPeriodo}");
        texto.AppendLine($"Visitas: {resumen.VisitasPeriodo}");
        texto.AppendLine($"Eventos descartados por saturación: {resumen.EventosDescartados}");
        texto.AppendLine();

        if (resumen.TopErrores.Count > 0)
        {
            texto.AppendLine("Errores más frecuentes:");
            foreach (var error in resumen.TopErrores)
            {
                texto.AppendLine($"- {error.Ocurrencias}× {Recortar(error.Mensaje, 160)} ({error.Ruta})");
            }

            texto.AppendLine();
        }

        if (resumen.TopBotones.Count > 0)
        {
            texto.AppendLine("Botones más usados:");
            foreach (var boton in resumen.TopBotones)
            {
                texto.AppendLine($"- {boton.Clics} clics · {Recortar(boton.Etiqueta ?? boton.Elemento, 80)}");
            }

            texto.AppendLine();
        }

        texto.AppendLine("Panel: Telemetría → Resumen.");
        return texto.ToString();
    }

    private static string Recortar(string? texto, int maximo)
    {
        if (string.IsNullOrWhiteSpace(texto))
        {
            return "—";
        }

        var limpio = texto.Replace('\n', ' ').Replace('\r', ' ').Trim();
        return limpio.Length <= maximo ? limpio : $"{limpio[..(maximo - 1)]}…";
    }
}
