using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Archivos.Settings;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Archivos.Notifications;

/// <summary>
/// Aviso por correo cuando se elimina un archivo de una orden de compra.
/// Destinatarios: el creador de la OC (el «Solicitante» de la bandeja de
/// autorizaciones) más los correos adicionales configurados. Si el que elimina
/// es el propio creador, no se envía nada.
/// </summary>
public class ArchivoEliminacionNotifier : IArchivoEliminacionNotifier
{
    internal const string EntidadOrdenCompra = "OrdenCompra";

    private const string CarpetaAdjuntosOrden = "ordenes-compra";
    private const string CarpetaComprobantes = "comprobantes";
    private const string CanalEmail = "email";
    private const string Remitente = "Cuentas por Pagar";
    private const string Categoria = "cxp-archivo-eliminado";
    private const string ColorTema = "#0f2744";
    private const int MaximoCorreosAdicionales = 10;

    private readonly ApplicationDbContext _db;
    private readonly AsokamDbContext _asokam;
    private readonly IOptions<ArchivosEliminacionSettings> _settings;
    private readonly INotificationService _notificaciones;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ArchivoEliminacionNotifier> _logger;

    public ArchivoEliminacionNotifier(
        ApplicationDbContext db,
        AsokamDbContext asokam,
        IOptions<ArchivosEliminacionSettings> settings,
        INotificationService notificaciones,
        IConfiguration configuration,
        ILogger<ArchivoEliminacionNotifier> logger)
    {
        _db = db;
        _asokam = asokam;
        _settings = settings;
        _notificaciones = notificaciones;
        _configuration = configuration;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task NotificarAsync(ArchivoEliminadoEvento evento, CancellationToken ct = default)
    {
        try
        {
            var orden = await _db.OrdenesCompra
                .AsNoTracking()
                .Where(o => o.IdOrden == evento.EntidadId)
                .Select(o => new { o.Folio, o.IdUsuarioCreador })
                .FirstOrDefaultAsync(ct);

            if (orden is null)
            {
                _logger.LogInformation(
                    "Aviso de eliminación omitido: la orden {IdOrden} del archivo {IdArchivo} no existe.",
                    evento.EntidadId, evento.IdArchivo);
                return;
            }

            if (!DebeNotificar(evento.EntidadTipo, orden.IdUsuarioCreador, evento.IdUsuarioElimina))
            {
                return;
            }

            var usuarios = await CargarUsuariosAsync(
                [orden.IdUsuarioCreador, evento.IdUsuarioElimina ?? 0, evento.IdUsuarioSubio ?? 0], ct);

            usuarios.TryGetValue(orden.IdUsuarioCreador, out var creador);

            var creadorConCorreo = creador is { EsActivo: true }
                && !string.IsNullOrWhiteSpace(creador.Correo);

            var correosAdicionales = NormalizarCorreosAdicionales(_settings.Value.CorreosAdicionales);

            if (!creadorConCorreo && correosAdicionales.Count == 0)
            {
                _logger.LogInformation(
                    "Aviso de eliminación del archivo {IdArchivo} omitido: no hay destinatarios disponibles.",
                    evento.IdArchivo);
                return;
            }

            usuarios.TryGetValue(evento.IdUsuarioElimina ?? 0, out var usuarioElimina);
            usuarios.TryGetValue(evento.IdUsuarioSubio ?? 0, out var usuarioSubio);

            var nombreElimina = ConstruirNombreVisible(
                usuarioElimina?.NombreCompleto, usuarioElimina?.SamAccountName);
            var nombreSubio = string.IsNullOrWhiteSpace(usuarioSubio?.NombreCompleto)
                ? usuarioSubio?.SamAccountName
                : usuarioSubio.NombreCompleto;

            var asunto = ConstruirAsunto(orden.Folio);
            var contenido = ConstruirContenidoHtml(evento, orden.Folio, nombreElimina, nombreSubio);

            var layout = await _db.WorkflowCanalTemplates
                .AsNoTracking()
                .Where(t => t.CodigoCanal == CanalEmail
                    && t.CodigoProceso == CodigoProceso.ORDEN_COMPRA
                    && t.Activo)
                .Select(t => t.LayoutHtml)
                .FirstOrDefaultAsync(ct);

            var urlOrden = ConstruirUrlOrden(_configuration["AppSettings:FrontendBaseUrl"], evento.EntidadId);
            var html = AplicarLayout(layout, asunto, contenido, urlOrden);

            var canal = new NotificationChannelRequest
            {
                ChannelType = CanalEmail,
                UserIds = creadorConCorreo ? [orden.IdUsuarioCreador] : null,
                Emails = correosAdicionales.Count > 0 ? [.. correosAdicionales] : null,
                ChannelSpecificData = new Dictionary<string, object> { ["fromName"] = Remitente }
            };

            var respuesta = await _notificaciones.SendAsync(new SendNotificationRequest
            {
                Title = asunto,
                Message = html,
                Type = "warning",
                Priority = "normal",
                Category = Categoria,
                Channels = [canal]
            }, ct);

            if (respuesta.ChannelResults.Values.Any(resultado => resultado.Success))
            {
                _logger.LogInformation(
                    "Aviso de eliminación del archivo {IdArchivo} de la orden {Folio} enviado.",
                    evento.IdArchivo, orden.Folio);
            }
            else
            {
                _logger.LogWarning(
                    "El aviso de eliminación del archivo {IdArchivo} de la orden {Folio} no se pudo enviar: {Error}",
                    evento.IdArchivo, orden.Folio,
                    string.Join("; ", respuesta.ChannelResults.Values
                        .Where(resultado => !resultado.Success)
                        .Select(resultado => resultado.Message)));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error al construir o enviar el aviso de eliminación del archivo {IdArchivo}.",
                evento.IdArchivo);
        }
    }

    /// <summary>
    /// Solo se avisa de archivos de orden de compra y nunca cuando el que elimina
    /// es el creador de la OC. Si el creador no se conoce (0), se avisa igual.
    /// </summary>
    internal static bool DebeNotificar(string? entidadTipo, int idUsuarioCreador, int? idUsuarioElimina)
        => string.Equals(entidadTipo, EntidadOrdenCompra, StringComparison.Ordinal)
            && (idUsuarioCreador <= 0
                || !idUsuarioElimina.HasValue
                || idUsuarioElimina.Value != idUsuarioCreador);

    /// <summary>Asunto del correo.</summary>
    internal static string ConstruirAsunto(string? folio)
        => string.IsNullOrWhiteSpace(folio)
            ? "Archivo eliminado"
            : $"Archivo eliminado — OC {folio.Trim()}";

    /// <summary>
    /// Cuerpo del correo: la frase del requisito (quién, archivo, fecha/hora y OC)
    /// más una tabla con el detalle del archivo.
    /// </summary>
    internal static string ConstruirContenidoHtml(
        ArchivoEliminadoEvento evento,
        string? folio,
        string nombreElimina,
        string? nombreSubio)
    {
        var fecha = evento.FechaEliminacion.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
        var hora = evento.FechaEliminacion.ToString("HH:mm", CultureInfo.InvariantCulture);
        var subidoPor = string.IsNullOrWhiteSpace(nombreSubio)
            ? "No registrado"
            : $"{nombreSubio} el {evento.FechaCreacion.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture)} hrs";

        var sb = new StringBuilder();
        sb.Append("<p style=\"margin:0 0 14px;\">El usuario <strong>")
            .Append(Html(nombreElimina))
            .Append("</strong> eliminó el archivo <strong>")
            .Append(Html(evento.NombreOriginal))
            .Append("</strong> el ")
            .Append(Html(fecha))
            .Append(" a las ")
            .Append(Html(hora))
            .Append(" hrs, de la orden de compra <strong>")
            .Append(Html(folio))
            .Append("</strong>.</p>");

        sb.Append("<table cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:collapse;font-size:14px;\">");
        AgregarFila(sb, "Archivo", evento.NombreOriginal);
        AgregarFila(sb, "Tipo", DescribirTipoArchivo(evento.Carpeta, evento.Metadata));
        AgregarFila(sb, "Eliminado por", nombreElimina);
        AgregarFila(sb, "Fecha y hora", $"{fecha} {hora} hrs");
        AgregarFila(sb, "Subido por", subidoPor);
        AgregarFila(sb, "Tamaño", FormatearTamano(evento.TamanoBytes));
        sb.Append("</table>");

        return sb.ToString();
    }

    /// <summary>Describe el archivo según su carpeta y su metadata.</summary>
    internal static string DescribirTipoArchivo(string? carpeta, string? metadata)
    {
        if (string.Equals(carpeta, CarpetaComprobantes, StringComparison.OrdinalIgnoreCase))
        {
            return LeerTipoMetadata(metadata) switch
            {
                "comprobante_pago" => "Comprobante de pago",
                "comprobante_gasto" => "Comprobante de gasto",
                _ => "Comprobante"
            };
        }

        return string.Equals(carpeta, CarpetaAdjuntosOrden, StringComparison.OrdinalIgnoreCase)
            ? "Adjunto de la orden"
            : "Archivo de la orden";
    }

    /// <summary>Lee la propiedad "tipo" de la metadata JSON del archivo; null si no aplica.</summary>
    internal static string? LeerTipoMetadata(string? metadata)
    {
        if (string.IsNullOrWhiteSpace(metadata))
        {
            return null;
        }

        try
        {
            using var documento = JsonDocument.Parse(metadata);
            var raiz = documento.RootElement;
            return raiz.ValueKind == JsonValueKind.Object
                && raiz.TryGetProperty("tipo", out var tipo)
                && tipo.ValueKind == JsonValueKind.String
                    ? tipo.GetString()
                    : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>Nombre visible del usuario; cae al nombre de cuenta o a un genérico.</summary>
    internal static string ConstruirNombreVisible(string? nombreCompleto, string? samAccountName)
    {
        if (!string.IsNullOrWhiteSpace(nombreCompleto))
        {
            return nombreCompleto.Trim();
        }

        return string.IsNullOrWhiteSpace(samAccountName)
            ? "Un usuario del sistema"
            : samAccountName.Trim();
    }

    /// <summary>Correos adicionales normalizados (válidos, sin duplicados y con tope).</summary>
    internal static IReadOnlyList<string> NormalizarCorreosAdicionales(
        IEnumerable<string>? correos,
        int maximo = MaximoCorreosAdicionales)
    {
        if (correos is null)
        {
            return [];
        }

        return correos
            .Where(correo => !string.IsNullOrWhiteSpace(correo))
            .Select(correo => correo.Trim())
            .Where(EsCorreoValido)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(Math.Max(1, maximo))
            .ToList();
    }

    /// <summary>Validación mínima de un correo; el canal vuelve a validar al enviar.</summary>
    internal static bool EsCorreoValido(string? correo)
    {
        if (string.IsNullOrWhiteSpace(correo))
        {
            return false;
        }

        try
        {
            _ = new System.Net.Mail.MailAddress(correo.Trim());
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    /// <summary>Ruta absoluta al detalle de la orden en la bandeja de autorizaciones.</summary>
    internal static string ConstruirUrlOrden(string? frontendBaseUrl, int idOrden)
    {
        var ruta = $"/cxp/ordenes/autorizaciones?idOrden={idOrden}";
        var baseUrl = (frontendBaseUrl ?? string.Empty).Trim().TrimEnd('/');
        return baseUrl.Length == 0 ? ruta : $"{baseUrl}{ruta}";
    }

    /// <summary>Inserta el contenido en el layout de correo del proceso, o usa el de respaldo.</summary>
    internal static string AplicarLayout(
        string? layoutHtml,
        string asunto,
        string contenido,
        string urlOrden)
    {
        var asuntoSeguro = Html(asunto);

        if (string.IsNullOrWhiteSpace(layoutHtml))
        {
            return ConstruirHtmlRespaldo(asuntoSeguro, contenido, urlOrden);
        }

        return layoutHtml
            .Replace("{{Asunto}}", asuntoSeguro, StringComparison.OrdinalIgnoreCase)
            .Replace("{{ColorTema}}", ColorTema, StringComparison.OrdinalIgnoreCase)
            .Replace("{{ColorClaro}}", "#e8f0fe", StringComparison.OrdinalIgnoreCase)
            .Replace("{{Icono}}", "🗑️", StringComparison.OrdinalIgnoreCase)
            .Replace("{{UrlOrden}}", urlOrden, StringComparison.OrdinalIgnoreCase)
            .Replace("{{UrlEntidad}}", urlOrden, StringComparison.OrdinalIgnoreCase)
            .Replace("{{ContenidoAdicional}}", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace("{{Contenido}}", contenido, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Tamaño legible del archivo.</summary>
    internal static string FormatearTamano(long bytes)
    {
        if (bytes <= 0)
        {
            return "No registrado";
        }

        if (bytes < 1024)
        {
            return $"{bytes} B";
        }

        var kilobytes = bytes / 1024d;
        if (kilobytes < 1024)
        {
            return $"{kilobytes.ToString("0.#", CultureInfo.InvariantCulture)} KB";
        }

        var megabytes = kilobytes / 1024d;
        return $"{megabytes.ToString("0.#", CultureInfo.InvariantCulture)} MB";
    }

    private async Task<Dictionary<int, UsuarioAviso>> CargarUsuariosAsync(
        int[] ids,
        CancellationToken ct)
    {
        var filtrados = ids.Where(id => id > 0).Distinct().ToArray();
        if (filtrados.Length == 0)
        {
            return [];
        }

        var filas = await _asokam.Usuarios
            .AsNoTracking()
            .Where(usuario => filtrados.Contains(usuario.IdUsuario))
            .Select(usuario => new
            {
                usuario.IdUsuario,
                usuario.NombreCompleto,
                usuario.SamAccountName,
                usuario.Correo,
                usuario.EsActivo
            })
            .ToListAsync(ct);

        return filas.ToDictionary(
            fila => fila.IdUsuario,
            fila => new UsuarioAviso(fila.NombreCompleto, fila.SamAccountName, fila.Correo, fila.EsActivo));
    }

    private static void AgregarFila(StringBuilder sb, string etiqueta, string? valor)
        => sb.Append("<tr><td style=\"padding:4px 12px 4px 0;color:#5a5a5a;vertical-align:top;\">")
            .Append(Html(etiqueta))
            .Append("</td><td style=\"padding:4px 0;\">")
            .Append(Html(valor))
            .Append("</td></tr>");

    private static string Html(string? texto) => WebUtility.HtmlEncode(texto ?? string.Empty);

    private static string ConstruirHtmlRespaldo(string asuntoSeguro, string contenido, string urlOrden) =>
        $"""
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="utf-8">
          <title>{asuntoSeguro}</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
          <table width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0f2f5;padding:20px 0;">
            <tr>
              <td align="center">
                <table width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border:1px solid #dcdcdc;">
                  <tr>
                    <td style="background-color:{ColorTema};color:#ffffff;padding:20px;text-align:left;">
                      <p style="margin:0;font-size:20px;font-weight:bold;">Grupo Lefarma</p>
                      <p style="margin:5px 0 0;font-size:13px;">Cuentas por Pagar</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px;font-size:15px;color:#000000;border-left:4px solid {ColorTema};">
                      {contenido}
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:20px;">
                      <a href="{urlOrden}" style="display:inline-block;padding:10px 20px;background-color:{ColorTema};color:#ffffff;text-decoration:none;font-size:14px;">
                        Ver bandeja de autorizaciones →
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color:#f8f9fa;padding:10px;text-align:center;font-size:12px;color:#5a5a5a;">
                      <p style="margin:5px 0;">Este mensaje fue generado automáticamente. Por favor no responda a este correo.</p>
                      <p style="margin:0;">© Grupo Lefarma — Cuentas por Pagar</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """;

    private sealed record UsuarioAviso(
        string? NombreCompleto,
        string? SamAccountName,
        string? Correo,
        bool EsActivo);
}
