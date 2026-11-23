using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Lefarma.API.Domain.Entities.Viaticos;
using Lefarma.API.Features.Viaticos.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Viaticos;

[ApiController]
[Route("api/viaticos")]
[EndpointGroupName("Viaticos")]
[Authorize]
public class DeteccionVuelosController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IDeteccionPrecioService _deteccion;
    private readonly DeteccionPrecioPreviewGate _previewGate;
    private readonly ILogger<DeteccionVuelosController> _logger;

    public DeteccionVuelosController(
        ApplicationDbContext context,
        IDeteccionPrecioService deteccion,
        DeteccionPrecioPreviewGate previewGate,
        ILogger<DeteccionVuelosController> logger)
    {
        _context = context;
        _deteccion = deteccion;
        _previewGate = previewGate;
        _logger = logger;
    }

    [HttpPost("solicitudes/{id:int}/opciones/{idOpcion:int}/detectar-precio")]
    [SwaggerOperation(
        Summary = "Detectar y aplicar el precio real de una opción",
        Description = "Vuelo: Kayak. Autobús: ClickBus/Primera Plus. Hotel: Google " +
                      "Hotels. Primero Playwright; si el sitio bloquea o no hay " +
                      "tarjetas, Firecrawl. Solo aplica si hay precio y captura.")]
    [SwaggerResponse(200, "Resultado de la detección", typeof(ApiResponse<DeteccionPrecioResponse>))]
    [SwaggerResponse(400, "La opción no tiene URL navegable")]
    [SwaggerResponse(403, "No es el dueño y no tiene viaticos.ver_todos")]
    [SwaggerResponse(404, "Solicitud u opción no encontrada")]
    [SwaggerResponse(409, "La solicitud ya no está en borrador o enviada")]
    public async Task<IActionResult> DetectarPrecio(
        [FromRoute] int id,
        [FromRoute] int idOpcion,
        CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Solicitar))
            return Forbid();

        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "Token sin id de usuario válido.",
            });
        }

        var solicitud = await _context.Solicitudes
            .Include(s => s.Opciones)
            .Include(s => s.Eventos)
            .FirstOrDefaultAsync(s => s.IdSolicitud == id && s.Activo, ct);
        if (solicitud is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Solicitud no encontrada.",
            });
        }

        var esVerTodos = User.TienePermiso(Permissions.Viaticos.VerTodos);
        if (solicitud.IdUsuarioSolicitante != userId && !esVerTodos)
            return Forbid();

        if (solicitud.Estado is not (SolicitudesController.EstadoBorrador or SolicitudesController.EstadoEnviada))
        {
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = $"La solicitud está en estado '{solicitud.Estado}'. " +
                          "La detección automática solo aplica en borrador o enviada.",
            });
        }

        var opcion = solicitud.Opciones.FirstOrDefault(o => o.IdOpcion == idOpcion);
        if (opcion is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = $"La opción {idOpcion} no pertenece a la solicitud {id}.",
            });
        }

        if (!TotalesCotizacion.EsTipoDetectable(opcion.Tipo))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "La detección automática solo aplica a vuelo, autobús u hotel.",
            });
        }

        if (string.Equals(opcion.Tipo?.Trim(), "hotel", StringComparison.OrdinalIgnoreCase)
            && opcion.Linea.StartsWith("Hotel en ", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "La opción es una referencia de tabulador, no un hotel concreto. " +
                          "Elige un hotel con nombre o captura el precio manualmente.",
            });
        }

        if (string.IsNullOrWhiteSpace(opcion.UrlCompra)
            || !Uri.TryCreate(opcion.UrlCompra, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "La opción no tiene una URL http/https para consultar el precio.",
            });
        }

        if (CapturasService.EsDominioProhibido(uri.Host))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "La URL apunta a un dominio que el plan no permite consultar (Booking/Expedia).",
            });
        }

        if (!UrlsNavegables.EsPermitida(uri))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "La URL de la opción apunta a una red interna y no se puede consultar.",
            });
        }

        var contexto = ContextoDeteccion.Leer(solicitud, opcion);
        var nombre = CapturasService.NombreSugerido(
            solicitud.Folio,
            solicitud.IdSolicitud,
            opcion.IdOpcion,
            CapturasService.DestinoDeDatos(opcion.DatosJson),
            opcion.Linea,
            "auto");

        DeteccionPrecioResult deteccion;
        try
        {
            deteccion = await _deteccion.DetectarAsync(
                opcion,
                contexto.Fecha,
                contexto.Deadline,
                contexto.MinutosTaxi,
                nombre,
                ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Detección de precio falló para solicitud {Id} opción {Opcion}", id, idOpcion);
            return Ok(new ApiResponse<DeteccionPrecioResponse>
            {
                Success = true,
                Message = "No se pudo completar la detección automática.",
                Data = new DeteccionPrecioResponse
                {
                    Aplicado = false,
                    Motivo = Recortar(ex.Message, 300),
                },
            });
        }

        var respuesta = new DeteccionPrecioResponse
        {
            Aplicado = false,
            Motivo = deteccion.Error,
            Fuente = deteccion.Fuente,
            RutaCaptura = deteccion.RutaCaptura,
            Elegido = deteccion.Elegido is null ? null : ADto(deteccion.Elegido),
            Opciones = deteccion.Opciones.Select(ADto).ToList(),
        };

        if (deteccion.Elegido is null || string.IsNullOrWhiteSpace(deteccion.RutaCaptura))
        {
            respuesta.Motivo ??= "No se detectó un precio con captura.";
            return Ok(new ApiResponse<DeteccionPrecioResponse>
            {
                Success = true,
                Message = respuesta.Motivo,
                Data = respuesta,
            });
        }

        var aplicado = await DeteccionPrecioAplicador.AplicarAsync(
            _context,
            solicitud,
            opcion,
            deteccion,
            userId,
            DateTime.UtcNow,
            "bajo_demanda",
            ct);

        if (!aplicado)
        {
            respuesta.Motivo = "No se pudo aplicar el precio detectado.";
            return Ok(new ApiResponse<DeteccionPrecioResponse>
            {
                Success = true,
                Message = respuesta.Motivo,
                Data = respuesta,
            });
        }

        respuesta.Aplicado = true;
        respuesta.Motivo = null;
        respuesta.Mensaje =
            $"Precio detectado: {deteccion.Elegido.Linea} · {deteccion.Elegido.Precio.ToString("C2", CultureInfo.GetCultureInfo("es-MX"))} MXN.";
        return Ok(new ApiResponse<DeteccionPrecioResponse>
        {
            Success = true,
            Message = respuesta.Mensaje,
            Data = respuesta,
        });
    }

    [HttpPost("opciones/detectar-precio")]
    [SwaggerOperation(
        Summary = "Vista previa del precio real de una opción del wizard",
        Description = "Igual que la detección automática, pero sin escribir en la " +
                      "base de datos. Devuelve el precio y la captura para que el " +
                      "wizard los adjunte a la opción seleccionada.")]
    [SwaggerResponse(200, "Resultado de la vista previa", typeof(ApiResponse<DeteccionPrecioPreviewResponse>))]
    [SwaggerResponse(400, "Opción inválida, URL no navegable o dominio prohibido")]
    [SwaggerResponse(403, "Sin permiso viaticos.solicitar")]
    [SwaggerResponse(429, "Dos vistas previas ya están en curso")]
    public async Task<IActionResult> DetectarPrecioPreview(
        [FromBody] DeteccionPrecioPreviewRequest request,
        CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Solicitar))
            return Forbid();

        if (request is null
            || string.IsNullOrWhiteSpace(request.UrlCompra)
            || string.IsNullOrWhiteSpace(request.Tipo))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "La opción requiere tipo y URL de compra.",
            });
        }

        var tipo = TotalesCotizacion.NormalizarTipo(request.Tipo);
        if (!TotalesCotizacion.EsTipoDetectable(tipo))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "La vista previa solo aplica a vuelo, autobús u hotel.",
            });
        }

        var linea = request.Linea?.Trim() ?? string.Empty;
        if (tipo == "hotel" && linea.StartsWith("Hotel en ", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "La opción es una referencia de tabulador, no un hotel concreto.",
            });
        }

        if (!Uri.TryCreate(request.UrlCompra.Trim(), UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "La opción no tiene una URL http/https válida.",
            });
        }

        if (CapturasService.EsDominioProhibido(uri.Host))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "La URL apunta a un dominio que el plan no permite consultar (Booking/Expedia).",
            });
        }

        if (!UrlsNavegables.EsPermitida(uri))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "La URL de la opción apunta a una red interna y no se puede consultar.",
            });
        }

        if (!_previewGate.TryEntrar())
        {
            return StatusCode(StatusCodes.Status429TooManyRequests, new ApiResponse<object>
            {
                Success = false,
                Message = "Ya hay dos precios confirmándose. Guarda la cotización y la cola lo terminará.",
            });
        }

        try
        {
            var solicitud = new Solicitud
            {
                DatosJson = request.SolicitudDatos is { ValueKind: JsonValueKind.Object } datosSolicitud
                    ? datosSolicitud.GetRawText()
                    : null,
            };
            var opcion = new SolicitudOpcion
            {
                Tipo = tipo,
                Linea = linea,
                UrlCompra = request.UrlCompra.Trim(),
                DatosJson = request.Datos is { ValueKind: JsonValueKind.Object } datosOpcion
                    ? datosOpcion.GetRawText()
                    : null,
                Fuente = "estimado",
                FueElegida = true,
            };
            var contexto = ContextoDeteccion.Leer(solicitud, opcion);
            var nombre = string.IsNullOrWhiteSpace(request.Nombre)
                ? $"preview-{tipo}-{DateTime.UtcNow:yyyyMMddHHmmssfff}"
                : request.Nombre.Trim();

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(75));

            DeteccionPrecioResult deteccion;
            try
            {
                deteccion = await _deteccion.DetectarAsync(
                    opcion,
                    contexto.Fecha,
                    contexto.Deadline,
                    contexto.MinutosTaxi,
                    nombre,
                    cts.Token,
                    request.Capturar);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                return Ok(new ApiResponse<DeteccionPrecioPreviewResponse>
                {
                    Success = true,
                    Message = "La consulta excedió 75 segundos.",
                    Data = new DeteccionPrecioPreviewResponse
                    {
                        Detectado = false,
                        Motivo = "La consulta excedió 75 segundos; el precio se confirmará al guardar.",
                    },
                });
            }

            var opciones = deteccion.Opciones.Select(ADto).ToList();
            var lineaGenerica = Compactar(linea).Contains("estimado", StringComparison.Ordinal);
            var elegido = lineaGenerica
                ? null
                : BuscarCoincidencia(deteccion.Opciones, linea, request.Salida, request.Llegada);
            var pidioCoincidencia = !lineaGenerica
                && TieneFiltro(linea, request.Salida, request.Llegada);
            if (elegido is null && pidioCoincidencia)
            {
                return Ok(new ApiResponse<DeteccionPrecioPreviewResponse>
                {
                    Success = true,
                    Message = "La opción seleccionada no aparece en los resultados actuales.",
                    Data = new DeteccionPrecioPreviewResponse
                    {
                        Detectado = false,
                        Motivo = "La opción seleccionada no aparece en los resultados actuales. " +
                                 "Al guardar se buscará el mejor precio que llegue a tiempo; " +
                                 "si quieres conservar esta línea y horario, captura el precio manualmente.",
                        Fuente = deteccion.Fuente,
                        RutaCaptura = deteccion.RutaCaptura,
                        Opciones = opciones,
                    },
                });
            }

            elegido ??= deteccion.Elegido;
            if (elegido is null
                || (request.Capturar && string.IsNullOrWhiteSpace(deteccion.RutaCaptura)))
            {
                return Ok(new ApiResponse<DeteccionPrecioPreviewResponse>
                {
                    Success = true,
                    Message = deteccion.Error ?? "No se detectó un precio con captura.",
                    Data = new DeteccionPrecioPreviewResponse
                    {
                        Detectado = false,
                        Motivo = deteccion.Error ?? "No se detectó un precio con captura.",
                        Fuente = deteccion.Fuente,
                        RutaCaptura = deteccion.RutaCaptura,
                        Opciones = opciones,
                    },
                });
            }

            return Ok(new ApiResponse<DeteccionPrecioPreviewResponse>
            {
                Success = true,
                Message = "Precio real confirmado.",
                Data = new DeteccionPrecioPreviewResponse
                {
                    Detectado = true,
                    Fuente = deteccion.Fuente,
                    RutaCaptura = deteccion.RutaCaptura,
                    Elegido = ADto(elegido),
                    Opciones = opciones,
                },
            });
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Vista previa de precio falló para {Url}", request.UrlCompra);
            return Ok(new ApiResponse<DeteccionPrecioPreviewResponse>
            {
                Success = true,
                Message = "No se pudo confirmar el precio en este momento.",
                Data = new DeteccionPrecioPreviewResponse
                {
                    Detectado = false,
                    Motivo = Recortar(ex.Message, 300),
                },
            });
        }
        finally
        {
            _previewGate.Salir();
        }
    }

    private static PrecioDetectadoDto ADto(PrecioDetectado precio) => new()
    {
        Tipo = precio.Tipo,
        Linea = precio.Linea,
        Precio = precio.Precio,
        Moneda = precio.Moneda,
        Fuente = precio.Fuente,
        UrlCompra = precio.UrlCompra,
        Detalle = precio.Detalle,
        Salida = precio.Salida?.ToString("HH:mm", CultureInfo.InvariantCulture),
        Llegada = precio.Llegada?.ToString("HH:mm", CultureInfo.InvariantCulture),
        DiasLlegada = precio.DiasLlegada,
        DuracionMin = precio.DuracionMin,
        Asientos = precio.Asientos,
        Noches = precio.Noches,
        Patrocinado = precio.Patrocinado,
    };

    private static PrecioDetectado? BuscarCoincidencia(
        IEnumerable<PrecioDetectado> opciones,
        string? linea,
        string? salida,
        string? llegada)
    {
        var lineaClave = Compactar(linea);
        var ignorarLinea = lineaClave.Length == 0
            || lineaClave.Contains("estimado", StringComparison.Ordinal);
        var salidaHora = ATime(salida);
        var llegadaHora = ATime(llegada);

        var candidatas = opciones
            .Where(o => !o.Patrocinado)
            .Where(o => ignorarLinea || Compactar(o.Linea).Contains(lineaClave, StringComparison.Ordinal))
            .Where(o => salidaHora is null
                        || o.Salida is null
                        || Math.Abs((o.Salida.Value - salidaHora.Value).TotalMinutes) <= 20)
            .Where(o => llegadaHora is null
                        || o.Llegada is null
                        || Math.Abs((o.Llegada.Value - llegadaHora.Value).TotalMinutes) <= 20)
            .ToList();

        if (candidatas.Count == 0) return null;
        return candidatas.OrderBy(o => o.Precio).First();
    }

    private static bool TieneFiltro(string? linea, string? salida, string? llegada) =>
        !string.IsNullOrWhiteSpace(linea)
        || !string.IsNullOrWhiteSpace(salida)
        || !string.IsNullOrWhiteSpace(llegada);

    private static TimeOnly? ATime(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return null;
        var match = Regex.Match(texto, @"(\d{1,2}:\d{2})");
        if (!match.Success) return null;
        return TimeOnly.TryParseExact(
            match.Groups[1].Value,
            new[] { "H:mm", "HH:mm" },
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var hora)
            ? hora
            : null;
    }

    private static string Compactar(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return string.Empty;
        var descompuesto = texto.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(descompuesto.Length);
        foreach (var caracter in descompuesto)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(caracter) != UnicodeCategory.NonSpacingMark)
                builder.Append(char.ToLowerInvariant(caracter));
        }
        return Regex.Replace(builder.ToString(), @"[^a-z0-9]", string.Empty);
    }

    private static string Recortar(string? texto, int maximo) =>
        string.IsNullOrEmpty(texto)
            ? string.Empty
            : texto.Length <= maximo ? texto : texto[..maximo];
}
