using System.Data;
using System.Net;
using System.Text.Json;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Features.Notifications.Services.Channels;
using Lefarma.API.Features.Sigma.Config;
using Lefarma.API.Features.Sigma.DTOs;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Lefarma.API.Features.Sigma;

/// <summary>
/// Notificaciones por correo del módulo Documentos. Puerto de DocumentoEmailService de SIGMA
/// sobre el canal de email de Lefarma (<see cref="EmailNotificationChannel"/>).
/// </summary>
public sealed class SigmaDocumentoEmailService
{
    private readonly SigmaDb _db;
    private readonly IOptions<DocumentosNotificacionesOptions> _options;
    private readonly INotificationChannel _canalEmail;
    private readonly ILogger<SigmaDocumentoEmailService> _logger;

    public SigmaDocumentoEmailService(
        SigmaDb db,
        IOptions<DocumentosNotificacionesOptions> options,
        [FromKeyedServices("email")] INotificationChannel canalEmail,
        ILogger<SigmaDocumentoEmailService> logger)
    {
        _db = db;
        _options = options;
        _canalEmail = canalEmail;
        _logger = logger;
    }

    /// <summary>
    /// Envío masivo de autorizaciones pendientes: agrupa los documentos de app.Documentos
    /// (últimos 2 meses, estatus 1) y manda un correo al destinatario configurado.
    /// </summary>
    public async Task<DocumentoEmailResult> EnviarNotificacionesAutorizacionPendienteAsync(CancellationToken ct = default)
    {
        var resultado = new DocumentoEmailResult();

        const string sqlDocumentos = """
            SELECT Id, NombreArchivo, FechaSubida
            FROM app.Documentos
            WHERE Activo = 1
              AND Estatus = 1
              AND FechaSubida >= DATEADD(month, -2, CAST(GETDATE() AS DATE))
              AND FechaSubida < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
            ORDER BY FechaSubida DESC
            """;

        var documentos = await _db.QueryAsync<DocumentoPendienteEmailRow>(sqlDocumentos, null, CommandType.Text, ct);
        if (documentos.Count == 0)
        {
            resultado.Success = true;
            resultado.Mensaje = "No hay documentos pendientes de notificar";
            return resultado;
        }

        var destinatario = _options.Value.CorreoDestinatarioDefault;
        if (string.IsNullOrWhiteSpace(destinatario))
        {
            resultado.Mensaje = "No hay correo destinatario configurado para autorizaciones pendientes";
            resultado.Errores.Add(resultado.Mensaje);
            return resultado;
        }

        var cuerpo = GenerarHtmlAutorizacionPendiente(documentos.Count);
        var asunto = $"Documentos pendientes de autorización ({documentos.Count})";
        var envio = await EnviarAsync(destinatario, cc: null, asunto, cuerpo, adjunto: null, ct);

        if (!envio.Success)
        {
            resultado.Mensaje = "No fue posible enviar la notificación de autorizaciones pendientes";
            resultado.Errores.Add(envio.Message ?? resultado.Mensaje);
            return resultado;
        }

        var ids = documentos.Select(d => d.Id).ToArray();
        await _db.ExecuteAsync(
            "UPDATE app.Documentos SET EnviadoParaAutorizacion = 1, NotificacionEnviada = 1 WHERE Id IN @Ids AND Estatus = 1",
            new { Ids = ids },
            CommandType.Text,
            ct);

        resultado.CorreosEnviados = 1;
        resultado.DocumentosProcesados = documentos.Count;
        resultado.Success = true;
        resultado.Mensaje = MensajeCorreo($"Se enviaron {resultado.CorreosEnviados} correos para {resultado.DocumentosProcesados} documentos");
        return resultado;
    }

    /// <summary>
    /// Notificación individual de un documento de app.Documentos.
    /// <paramref name="soloCC"/> = true: aviso de documento subido a los CC (adjunta el PDF original).
    /// false: aviso de autorizado/rechazado al destinatario principal (sólo enlace de descarga).
    /// </summary>
    public async Task<DocumentoEmailResult> EnviarNotificacionDocumentoAsync(Guid idDocumento, bool soloCC, CancellationToken ct = default)
    {
        var documento = await _db.QueryFirstOrDefaultAsync<DocumentoEmailRow>(
            """
            SELECT Id, NombreArchivo, MimeType, PDFBinario, MetadataJSON, Estatus,
                   TamanoBytes, FechaSubida, FechaAutorizacion, FechaRechazo,
                   ComentariosSubida, ComentariosDecision, SubidoPorUsuario
            FROM app.Documentos
            WHERE Id = @IdDocumento
            """,
            new { IdDocumento = idDocumento },
            CommandType.Text,
            ct);

        if (documento is null)
        {
            return Fallo($"Documento {idDocumento} no encontrado");
        }

        if (string.IsNullOrWhiteSpace(documento.MetadataJSON))
        {
            return Fallo($"Documento {idDocumento} no tiene MetadataJSON");
        }

        DocumentoMetadata? metadata;
        try
        {
            metadata = JsonSerializer.Deserialize<DocumentoMetadata>(documento.MetadataJSON);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "MetadataJSON inválido para el documento {IdDocumento}", idDocumento);
            return Fallo($"MetadataJSON inválido para el documento {idDocumento}");
        }

        if (metadata is null)
        {
            return Fallo($"MetadataJSON inválido para el documento {idDocumento}");
        }

        var ccList = metadata.GetCcList();

        return soloCC
            ? await EnviarNotificacionSoloCcAsync(documento, ccList, ct)
            : await EnviarNotificacionDecisionAsync(documento, metadata, ccList, ct);
    }

    /// <summary>Recordatorio al aprobador actual de un documento del flujo (reenviar-notificación).</summary>
    public async Task<DocumentoEmailResult> EnviarRecordatorioAsync(Guid idDocumento, PasoNotificacionDto paso, CancellationToken ct = default)
    {
        var destinatario = paso.CorreoUsuario;
        var nombre = paso.NombreUsuario;

        if (string.IsNullOrWhiteSpace(destinatario))
        {
            var usuario = await _db.QueryFirstOrDefaultAsync<UsuarioDestinoRow>(
                """
                SELECT TOP 1 Correo, NombreCompleto
                FROM app.Usuarios
                WHERE Correo = @Usuario OR (SamAccountName + '@' + Dominio) = @Usuario
                """,
                new { Usuario = paso.UsuarioAprobador },
                CommandType.Text,
                ct);

            destinatario = usuario?.Correo;
            nombre = usuario?.NombreCompleto ?? nombre;
        }

        if (string.IsNullOrWhiteSpace(destinatario))
        {
            return Fallo($"No se encontró correo electrónico para el aprobador {paso.UsuarioAprobador}");
        }

        var enlace = ConstruirEnlaceValidacion(idDocumento);
        var cuerpo = $"""
            <div style="font-family:Segoe UI,Arial,sans-serif;color:#2d3142;max-width:640px">
              <h2 style="color:#eb6c36">Recordatorio: documento pendiente de firma</h2>
              <p>Hola {Html(nombre)},</p>
              <p>Te recordamos que tienes un documento pendiente de revisión y firma:</p>
              <ul>
                <li><strong>Documento:</strong> {Html(paso.NombreArchivo)}</li>
                <li><strong>Creado por:</strong> {Html(paso.CreadoPor)}</li>
                <li><strong>Motivo:</strong> {Html(paso.ComentarioInicial)}</li>
              </ul>
              <p><a href="{Html(enlace)}" style="background:#eb6c36;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none">Revisar documento</a></p>
              <p>Saludos,<br/>{Html(_options.Value.RemitenteAutorizacion)}</p>
            </div>
            """;

        var envio = await EnviarAsync(destinatario, cc: null, $"Recordatorio: documento pendiente de firma - {paso.NombreArchivo}", cuerpo, adjunto: null, ct);
        if (!envio.Success)
        {
            return Fallo(envio.Message ?? "No fue posible enviar el recordatorio");
        }

        return new DocumentoEmailResult
        {
            Success = true,
            DocumentosProcesados = 1,
            CorreosEnviados = 1,
            Mensaje = MensajeCorreo("Recordatorio enviado exitosamente")
        };
    }

    /// <summary>
    /// true si el correo del visitante aparece en el to/cc del MetadataJSON del documento legacy.
    /// Se usa para que un visitante externo sólo notifique documentos que le corresponden.
    /// </summary>
    public async Task<bool> CorreoAutorizadoAsync(Guid idDocumento, string correo, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(correo))
        {
            return false;
        }

        var metadataJson = await _db.ExecuteScalarAsync<string>(
            "SELECT MetadataJSON FROM app.Documentos WHERE Id = @IdDocumento",
            new { IdDocumento = idDocumento },
            CommandType.Text,
            ct);

        if (string.IsNullOrWhiteSpace(metadataJson))
        {
            return false;
        }

        try
        {
            var metadata = JsonSerializer.Deserialize<DocumentoMetadata>(metadataJson);
            if (metadata is null)
            {
                return false;
            }

            return metadata.GetToList().Concat(metadata.GetCcList())
                .Any(direccion => string.Equals(direccion, correo.Trim(), StringComparison.OrdinalIgnoreCase));
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private async Task<DocumentoEmailResult> EnviarNotificacionSoloCcAsync(
        DocumentoEmailRow documento,
        List<string> ccList,
        CancellationToken ct)
    {
        if (ccList.Count == 0)
        {
            return Fallo($"Documento {documento.Id} no tiene destinatarios en CC para envío solo a CC");
        }

        var destinatario = ccList[0];
        var cc = ccList.Count > 1 ? string.Join(";", ccList.Skip(1)) : null;

        NotificationAttachment? adjunto = null;
        if (documento.PDFBinario is { Length: > 0 })
        {
            adjunto = new NotificationAttachment(
                SigmaDocumentStorage.SanearNombreArchivo(documento.NombreArchivo),
                documento.PDFBinario,
                string.IsNullOrWhiteSpace(documento.MimeType) ? "application/pdf" : documento.MimeType);
        }

        var cuerpo = GenerarHtmlDocumentoSubido(documento);

        var envio = await EnviarAsync(destinatario, cc, $"Nuevo Documento Subido: {documento.NombreArchivo}", cuerpo, adjunto, ct);
        if (!envio.Success)
        {
            return Fallo(envio.Message ?? "No fue posible enviar la notificación");
        }

        return new DocumentoEmailResult
        {
            Success = true,
            DocumentosProcesados = 1,
            CorreosEnviados = 1,
            Mensaje = MensajeCorreo($"Notificación de documento subido enviada exitosamente solo a CC para documento {documento.Id}")
        };
    }

    private async Task<DocumentoEmailResult> EnviarNotificacionDecisionAsync(
        DocumentoEmailRow documento,
        DocumentoMetadata metadata,
        List<string> ccList,
        CancellationToken ct)
    {
        if (documento.Estatus is not (2 or 3))
        {
            return Fallo($"Documento {documento.Id} debe estar autorizado o rechazado para enviar notificación. Estatus actual: {documento.Estatus}");
        }

        if (string.IsNullOrWhiteSpace(metadata.To))
        {
            return Fallo($"Documento {documento.Id} no tiene destinatario principal (To)");
        }

        var esAutorizado = documento.Estatus == 2;
        var urlDescarga = $"{UrlBase()}/api/sigma/pdf-signature/pdf/{documento.Id}?descargar=true";
        var cuerpo = esAutorizado
            ? GenerarHtmlDocumentoAutorizado(documento, urlDescarga)
            : GenerarHtmlDocumentoRechazado(documento, urlDescarga);

        var asunto = $"{(esAutorizado ? "Documento Autorizado" : "Documento Rechazado")}: {documento.NombreArchivo}";
        var cc = ccList.Count > 0 ? string.Join(";", ccList) : null;
        var envio = await EnviarAsync(metadata.To, cc, asunto, cuerpo, adjunto: null, ct);

        if (!envio.Success)
        {
            return Fallo(envio.Message ?? "No fue posible enviar la notificación");
        }

        await _db.ExecuteAsync(
            "UPDATE app.Documentos SET NotificacionEnviada = 1 WHERE Id = @IdDocumento",
            new { IdDocumento = documento.Id },
            CommandType.Text,
            ct);

        return new DocumentoEmailResult
        {
            Success = true,
            DocumentosProcesados = 1,
            CorreosEnviados = 1,
            Mensaje = MensajeCorreo($"Notificación enviada exitosamente para documento {documento.Id}")
        };
    }

    /// <summary>URL pública base sin barra final (vacía si no está configurada).</summary>
    private string UrlBase() =>
        string.IsNullOrWhiteSpace(_options.Value.UrlBase) ? string.Empty : _options.Value.UrlBase.TrimEnd('/');

    /// <summary>Ajusta el mensaje de éxito cuando el envío de correos está deshabilitado.</summary>
    private string MensajeCorreo(string mensajeEnviado)
    {
        if (_options.Value.EnviarCorreos)
        {
            return mensajeEnviado;
        }

        var prueba = DestinatariosDePrueba();
        return prueba.Count == 0
            ? "Correos deshabilitados por configuración (Sigma:DocumentosNotificaciones:EnviarCorreos=false): no se envió ningún correo"
            : $"Correos deshabilitados: enviado solo a los destinatarios de prueba ({string.Join(", ", prueba)})";
    }

    private List<string> DestinatariosDePrueba() =>
        _options.Value.CorreosDestinatariosPrueba
            .Where(correo => !string.IsNullOrWhiteSpace(correo))
            .Select(correo => correo.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    private async Task<ChannelResult> EnviarAsync(
        string destinatarios,
        string? cc,
        string asunto,
        string cuerpo,
        NotificationAttachment? adjunto,
        CancellationToken ct)
    {
        // Interruptor general: con Sigma:DocumentosNotificaciones:EnviarCorreos=false
        // los correos NO van a los destinatarios reales. Si hay destinatarios de prueba,
        // se redirigen solo a ellos (con el asunto marcado); si no hay, no se envía nada.
        if (!_options.Value.EnviarCorreos)
        {
            var prueba = DestinatariosDePrueba();
            if (prueba.Count == 0)
            {
                _logger.LogInformation(
                    "Correo omitido: Sigma:DocumentosNotificaciones:EnviarCorreos=false y sin destinatarios de prueba (asunto «{Asunto}», destinatarios {Destinatarios}).",
                    asunto,
                    destinatarios);

                return new ChannelResult
                {
                    Success = true,
                    Message = "Envío de correos deshabilitado por configuración (Sigma:DocumentosNotificaciones:EnviarCorreos=false)",
                    SentRecipients = new List<string>()
                };
            }

            _logger.LogInformation(
                "Correo redirigido a destinatarios de prueba: {Prueba} (asunto «{Asunto}», destinatarios originales {Destinatarios}).",
                string.Join(", ", prueba),
                asunto,
                destinatarios);

            destinatarios = string.Join(";", prueba);
            cc = null;
            asunto = $"[PRUEBA] {asunto}";
        }

        var mensaje = new NotificationMessage
        {
            Title = asunto,
            Body = cuerpo,
            Recipients = destinatarios,
            Data = new Dictionary<string, object>()
        };

        if (!string.IsNullOrWhiteSpace(cc))
        {
            mensaje.Data["cc"] = cc;
        }

        if (!string.IsNullOrWhiteSpace(_options.Value.RemitenteAutorizacion))
        {
            mensaje.Data["fromName"] = _options.Value.RemitenteAutorizacion;
        }

        if (adjunto is not null)
        {
            mensaje.Data["attachments"] = new[] { adjunto };
        }

        return await _canalEmail.SendAsync(mensaje, ct);
    }

    private string ConstruirEnlaceValidacion(Guid? idDocumento)
    {
        var id = idDocumento?.ToString("D") ?? string.Empty;
        return $"{UrlBase()}/SIGMA/documentos/validar-firma?idDocumento={id}";
    }

    private string GenerarHtmlAutorizacionPendiente(int cantidadDocumentos)
    {
        var mensaje = _options.Value.MensajeAutorizacionPendiente;
        var url = ConstruirEnlaceValidacion(null);

        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset=""utf-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }}
        .container {{
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }}
        .content {{
            padding: 30px;
        }}
        .badge {{
            display: inline-block;
            background-color: #fbbf24;
            color: #78350f;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 18px;
            margin: 20px 0;
        }}
        .message {{
            font-size: 16px;
            margin: 20px 0;
            line-height: 1.8;
        }}
        .button {{
            display: inline-block;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: gray !important;
            text-decoration: none;
            padding: 16px 40px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 16px;
            margin: 20px 0;
            transition: all 0.3s ease;
            border: 3px solid #047857;
            box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(16, 185, 129, 0.5);
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
        }}
        .footer {{
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6c757d;
            border-top: 1px solid #e9ecef;
        }}
        .info-box {{
            background-color: #e0e7ff;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }}
    </style>
</head>
<body>
    <div class=""container"">
        <div class=""header"">
            <h1>{_options.Value.RemitenteAutorizacion}</h1>
        </div>
        <div class=""content"">
            <div class=""info-box"">
                <p class=""message"">
                    <strong>{mensaje}</strong>
                </p>
            </div>

            <div style=""text-align: center;"">
                <span class=""badge"">{cantidadDocumentos} documento{(cantidadDocumentos != 1 ? "s" : "")}</span>
            </div>

            <p class=""message"">
                Se han recibido <strong>{cantidadDocumentos} documento{(cantidadDocumentos != 1 ? "s" : "")}</strong> que requieren su revisión y autorización.
            </p>

            <div style=""text-align: center; margin: 30px 0;"">
                <!-- Table-based button for better Outlook support -->
                <table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" align=""center"">
                <tr>
                <td align=""center"" bgcolor=""#10b981"" style=""border-radius:6px;"">
                <a href=""{url}"" target=""_blank"" style=""display:inline-block;padding:12px26px;font-size:16px;color:#ffffff;text-decoration:none;font-weight:700;font-family:Segoe UI, Arial, sans-serif;line-height:16px;"">Ver Documentos Pendientes</a>
                </td>
                </tr>
                </table>
                <div style=""margin-top:10px;font-size:13px;color:#6c757d;word-break:break-all;"">
                <a href=""{url}"" target=""_blank"" style=""color:#0b5fff;"">{url}</a>
                </div>
            </div>

            <p style=""font-size: 14px; color: #6c757d;"">
                Por favor, acceda al sistema para revisar y procesar los documentos pendientes.
            </p>
        </div>
        <div class=""footer"">
            <p>Este es un correo automático, por favor no responda a este mensaje.</p>
            <p>&copy; {DateTime.Now.Year} Grupo Lefarma. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>";
    }

    private string GenerarHtmlDocumentoAutorizado(DocumentoEmailRow documento, string urlDescargaPdf)
    {
        var fechaAutorizacion = documento.FechaAutorizacion?.ToString("dd/MM/yyyy HH:mm") ?? "N/A";

        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset=""utf-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }}
        .container {{
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }}
        .status-badge {{
            display: inline-flex;
            align-items: center;
            background-color: #d1fae5;
            color: #065f46;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
        }}
        .checkmark {{
            width: 24px;
            height: 24px;
            background-color: #10b981;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-right: 8px;
            color: white;
            font-weight: bold;
        }}
        .content {{
            padding: 30px;
        }}
        .document-info {{
            background-color: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
        }}
        .info-row {{
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e9ecef;
        }}
        .info-row:last-child {{
            border-bottom: none;
        }}
        .info-label {{
            font-weight: 600;
            color: #6c757d;
        }}
        .info-value {{
            color: #333;
            text-align: right;
        }}
        .comments {{
            background-color: #e0f2fe;
            border-left: 4px solid #0284c7;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }}
        .footer {{
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6c757d;
            border-top: 1px solid #e9ecef;
        }}
        .download-button {{
            display: inline-block;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white !important;
            text-decoration: none;
            padding: 16px 40px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 16px;
            margin: 20px 0;
            transition: all 0.3s ease;
            border: 3px solid #047857;
            box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .download-button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(16, 185, 129, 0.5);
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
        }}
    </style>
</head>
<body>
    <div class=""container"">
        <div class=""header"">
            <h1>Documento Autorizado</h1>
        </div>
        <div class=""content"">
            <div style=""text-align: center;"">
                <div class=""status-badge"">
                    <span class=""checkmark"">✓</span>
                    <span>AUTORIZADO</span>
                </div>
            </div>

            <p style=""font-size: 16px; margin: 20px 0;"">
                Su documento ha sido <strong>autorizado</strong> exitosamente.
            </p>

            <div class=""document-info"">
                <div class=""info-row"">
                    <span class=""info-label"">ID Documento:</span>
                    <span class=""info-value"">{documento.Id}</span>
                </div>
                <div class=""info-row"">
                    <span class=""info-label"">Nombre:</span>
                    <span class=""info-value"">{documento.NombreArchivo}</span>
                </div>
                <div class=""info-row"">
                    <span class=""info-label"">Fecha Subida:</span>
                    <span class=""info-value"">{documento.FechaSubida:dd/MM/yyyy HH:mm}</span>
                </div>
                <div class=""info-row"">
                    <span class=""info-label"">Subido Por:</span>
                    <span class=""info-value"">{documento.SubidoPorUsuario ?? "N/A"}</span>
                </div>
                <div class=""info-row"">
                    <span class=""info-label"">Fecha Autorización:</span>
                    <span class=""info-value"">{fechaAutorizacion}</span>
                </div>
            </div>

            {(!string.IsNullOrWhiteSpace(documento.ComentariosDecision) ? $@"
            <div class=""comments"">
                <strong>Comentarios:</strong>
                <p style=""margin: 10px 0 0 0;"">{documento.ComentariosDecision}</p>
            </div>" : "")}

            <div style=""text-align: center; margin: 30px 0;"">
            <!-- Table-based button for better Outlook support -->
            <table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" align=""center"">
            <tr>
            <td align=""center"" bgcolor=""#10b981"" style=""border-radius:6px;"">
            <a href=""{urlDescargaPdf}"" target=""_blank"" style=""display:inline-block;padding:12px26px;font-size:16px;color:#ffffff;text-decoration:none;font-weight:700;font-family:Segoe UI, Arial, sans-serif;line-height:16px;"">Descargar Documento Autorizado</a>
            </td>
            </tr>
            </table>
            <div style=""margin-top:10px;font-size:13px;color:#6c757d;word-break:break-all;"">
            <a href=""{urlDescargaPdf}"" target=""_blank"" style=""color:#0b5fff;"">{urlDescargaPdf}</a>
            </div>
            </div>

            <p style=""font-size: 14px; color: #6c757d; margin-top: 20px;"">
                Haga clic en el botón de arriba para descargar el documento autorizado.
            </p>
        </div>
        <div class=""footer"">
            <p>Este es un correo automático, por favor no responda a este mensaje.</p>
            <p>&copy; {DateTime.Now.Year} Grupo Lefarma. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>";
    }

    private string GenerarHtmlDocumentoRechazado(DocumentoEmailRow documento, string urlDescargaPdf)
    {
        var fechaRechazo = documento.FechaRechazo?.ToString("dd/MM/yyyy HH:mm") ?? "N/A";

        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset=""utf-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }}
        .container {{
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }}
        .status-badge {{
            display: inline-flex;
            align-items: center;
            background-color: #fee2e2;
            color: #991b1b;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
        }}
        .xmark {{
            width: 24px;
            height: 24px;
            background-color: #ef4444;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-right: 8px;
            color: white;
            font-weight: bold;
        }}
        .content {{
            padding: 30px;
        }}
        .document-info {{
            background-color: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
        }}
        .info-row {{
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e9ecef;
        }}
        .info-row:last-child {{
            border-bottom: none;
        }}
        .info-label {{
            font-weight: 600;
            color: #6c757d;
        }}
        .info-value {{
            color: #333;
            text-align: right;
        }}
        .comments {{
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }}
        .footer {{
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6c757d;
            border-top: 1px solid #e9ecef;
        }}
        .download-button {{
            display: inline-block;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white !important;
            text-decoration: none;
            padding: 16px 40px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 16px;
            margin: 20px 0;
            transition: all 0.3s ease;
            border: 3px solid #b91c1c;
            box-shadow: 0 4px 6px rgba(239, 68, 68, 0.3);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .download-button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(239, 68, 68, 0.5);
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
        }}
    </style>
</head>
<body>
    <div class=""container"">
        <div class=""header"">
            <h1>Documento Rechazado</h1>
        </div>
        <div class=""content"">
            <div style=""text-align: center;"">
                <div class=""status-badge"">
                    <span class=""xmark"">✗</span>
                    <span>RECHAZADO</span>
                </div>
            </div>

            <p style=""font-size: 16px; margin: 20px 0;"">
                Su documento ha sido <strong>rechazado</strong>.
            </p>

            <div class=""document-info"">
                <div class=""info-row"">
                    <span class=""info-label"">ID Documento:</span>
                    <span class=""info-value"">{documento.Id}</span>
                </div>
                <div class=""info-row"">
                    <span class=""info-label"">Nombre:</span>
                    <span class=""info-value"">{documento.NombreArchivo}</span>
                </div>
                <div class=""info-row"">
                    <span class=""info-label"">Fecha Subida:</span>
                    <span class=""info-value"">{documento.FechaSubida:dd/MM/yyyy HH:mm}</span>
                </div>
                <div class=""info-row"">
                    <span class=""info-label"">Subido Por:</span>
                    <span class=""info-value"">{documento.SubidoPorUsuario ?? "N/A"}</span>
                </div>
                <div class=""info-row"">
                    <span class=""info-label"">Fecha Rechazo:</span>
                    <span class=""info-value"">{fechaRechazo}</span>
                </div>
            </div>

            {(!string.IsNullOrWhiteSpace(documento.ComentariosDecision) ? $@"
            <div class=""comments"">
                <strong>Motivo del rechazo:</strong>
                <p style=""margin: 10px 0 0 0;"">{documento.ComentariosDecision}</p>
            </div>" : "")}

            <div style=""text-align: center; margin: 30px 0;"">
            <!-- Table-based button for better Outlook support -->
            <table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" align=""center"">
            <tr>
            <td align=""center"" bgcolor=""#ef4444"" style=""border-radius:6px;"">
            <a href=""{urlDescargaPdf}"" target=""_blank"" style=""display:inline-block;padding:12px26px;font-size:16px;color:#ffffff;text-decoration:none;font-weight:700;font-family:Segoe UI, Arial, sans-serif;line-height:16px;"">Descargar Documento Original</a>
            </td>
            </tr>
            </table>
            <div style=""margin-top:10px;font-size:13px;color:#6c757d;word-break:break-all;"">
            <a href=""{urlDescargaPdf}"" target=""_blank"" style=""color:#0b5fff;"">{urlDescargaPdf}</a>
            </div>
            </div>

            <p style=""font-size: 14px; color: #6c757d; margin-top: 20px;"">
                Puede descargar el documento original y revisar los comentarios para realizar las correcciones necesarias.
            </p>
        </div>
        <div class=""footer"">
            <p>Este es un correo automático, por favor no responda a este mensaje.</p>
            <p>&copy; {DateTime.Now.Year} Grupo Lefarma. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>";
    }

    private string GenerarHtmlDocumentoSubido(DocumentoEmailRow documento)
    {
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset=""utf-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }}
        .container {{
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }}
        .status-badge {{
            display: inline-flex;
            align-items: center;
            background-color: #dbeafe;
            color: #1e40af;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
        }}
        .upload-icon {{
            width: 24px;
            height: 24px;
            background-color: #3b82f6;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-right: 8px;
            color: white;
            font-weight: bold;
        }}
        .content {{
            padding: 30px;
        }}
        .document-info {{
            background-color: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
        }}
        .info-row {{
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e9ecef;
        }}
        .info-row:last-child {{
            border-bottom: none;
        }}
        .info-label {{
            font-weight: 600;
            color: #6c757d;
        }}
        .info-value {{
            color: #333;
            text-align: right;
        }}
        .info-box {{
            background-color: #dbeafe;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }}
        .footer {{
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6c757d;
            border-top: 1px solid #e9ecef;
        }}
    </style>
</head>
<body>
    <div class=""container"">
        <div class=""header"">
            <h1>Nuevo Documento Subido</h1>
        </div>
        <div class=""content"">
            <div style=""text-align: center;"">
                <div class=""status-badge"">
                    <span class=""upload-icon"">↑</span>
                    <span>DOCUMENTO SUBIDO</span>
                </div>
            </div>

            <p style=""font-size: 16px; margin: 20px 0;"">
                Se ha subido un nuevo documento al sistema que requiere su atención.
            </p>

            <div class=""document-info"">
                <div class=""info-row"">
                    <span class=""info-label"">ID Documento:</span>
                    <span class=""info-value"">{documento.Id}</span>
                </div>
                <div class=""info-row"">
                    <span class=""info-label"">Nombre:</span>
                    <span class=""info-value"">{documento.NombreArchivo}</span>
                </div>
                <div class=""info-row"">
                    <span class=""info-label"">Fecha Subida:</span>
                    <span class=""info-value"">{documento.FechaSubida:dd/MM/yyyy HH:mm}</span>
                </div>
                <div class=""info-row"">
                    <span class=""info-label"">Subido Por:</span>
                    <span class=""info-value"">{documento.SubidoPorUsuario ?? "N/A"}</span>
                </div>
                <div class=""info-row"">
                    <span class=""info-label"">Tamaño:</span>
                    <span class=""info-value"">{(documento.TamanoBytes / 1024.0):N2} KB</span>
                </div>
            </div>

            {(!string.IsNullOrWhiteSpace(documento.ComentariosSubida) ? $@"
            <div class=""info-box"">
                <strong>Comentarios:</strong>
                <p style=""margin: 10px 0 0 0;"">{documento.ComentariosSubida}</p>
            </div>" : "")}

            <p style=""font-size: 14px; color: #6c757d; margin-top: 20px;"">
                El documento ha sido adjuntado a este correo para su revisión. Este documento se encuentra pendiente de autorización.
            </p>
        </div>
        <div class=""footer"">
            <p>Este es un correo automático, por favor no responda a este mensaje.</p>
            <p>&copy; {DateTime.Now.Year} Grupo Lefarma. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>";
    }

    private static DocumentoEmailResult Fallo(string mensaje) => new()
    {
        Success = false,
        Mensaje = mensaje,
        Errores = new List<string> { mensaje }
    };

    private static string Html(string? valor) => WebUtility.HtmlEncode(valor ?? string.Empty);
}

/// <summary>Correo/nombre de un aprobador cuando la subconsulta del SP no lo resuelve (aprobador anónimo).</summary>
internal sealed record UsuarioDestinoRow
{
    public string? Correo { get; init; }
    public string? NombreCompleto { get; init; }
}

