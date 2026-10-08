using System.Text.Json;
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

/// <summary>
/// Wizard de solicitudes de viáticos. Endpoints centrados en el
/// solicitante (crear / cotizar / consultar). Las transiciones
/// autorizadas/ajustes viven en AprobacionesController (otro worker).
///
/// Reglas duras:
///  - <c>id_usuario_solicitante</c> SIEMPRE de <c>User.GetUserId()</c>,
///    NUNCA del body.
///  - <c>periodo</c> SIEMPRE derivado del servidor (yyyy-MM, UTC).
///  - <c>gerencia</c> del body si llega; si no, <see cref="GerenciaPorDefecto"/>
///    (documentado en DoneClaim como supuesto).
///  - PUT de cotizacion exige <c>url_compra</c> y <c>fuente</c> en cada
///    opcion; <c>precio:null</c> solo si <c>fuente</c> contiene "estimado".
///
/// Transiciones que escribe este controller (ninguna otra):
///  - <c>borrador</c> --(PUT opciones)--> <c>enviada</c>. Guardar la cotizacion
///    ES el envio: no hay un endpoint aparte de "enviar" y, sin esta
///    transicion, la solicitud se quedaba en <c>borrador</c> para siempre y
///    <c>AprobacionesController</c> la rechazaba con 409, dejando la bandeja
///    autorizable vacia. El resto de estados (<c>autorizada</c>,
///    <c>autorizada_con_ajustes</c>, <c>rechazada</c>) los pone
///    <c>AprobacionesController</c> y este controller no los toca.
/// </summary>
[ApiController]
[Route("api/viaticos")]
[EndpointGroupName("Viaticos")]
[Authorize]
public class SolicitudesController : ControllerBase
{
    /// <summary>
    /// Valor por defecto de gerencia cuando el solicitante no manda una
    /// y el backend todavía no tiene un catálogo de empleados
    /// (siguiente incremento: leer de <c>Asokam.genEmpleadosCat</c>).
    /// Documentado como supuesto en el DoneClaim.
    /// </summary>
    public const string GerenciaPorDefecto = "Sin asignar";

    /// <summary>Estado en el que nace toda solicitud (POST /solicitudes).</summary>
    public const string EstadoBorrador = "borrador";

    /// <summary>
    /// Estado al que pasa la solicitud al guardar sus opciones. Es el unico
    /// estado que <c>AprobacionesController</c> acepta para autorizar o
    /// rechazar; cualquier otro devuelve 409.
    /// </summary>
    public const string EstadoEnviada = "enviada";

    private readonly ApplicationDbContext _context;
    private readonly ILogger<SolicitudesController> _logger;

    public SolicitudesController(ApplicationDbContext context, ILogger<SolicitudesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // ----------------------------------------------------------------
    // POST /api/viaticos/solicitudes
    // ----------------------------------------------------------------
    [HttpPost("solicitudes")]
    [SwaggerOperation(
        Summary = "Crear solicitud de viáticos (borrador)",
        Description = "Crea una solicitud en estado 'borrador' a nombre del usuario autenticado. " +
                      "id_usuario_solicitante SIEMPRE viene del claim NameIdentifier; " +
                      "el body no puede sobrescribirlo. " +
                      "periodo (yyyy-MM) y gerencia se derivan del servidor.")]
    [SwaggerResponse(201, "Solicitud creada", typeof(ApiResponse<SolicitudDto>))]
    [SwaggerResponse(400, "Body inválido")]
    [SwaggerResponse(401, "Sin token")]
    [SwaggerResponse(403, "Sin permiso viaticos.solicitar")]
    public async Task<IActionResult> Crear([FromBody] CrearSolicitudRequest? request, CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Solicitar))
        {
            return Forbid();
        }
        if (request is null)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Body requerido."
            });
        }

        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "Token sin id de usuario válido."
            });
        }

        var ahora = DateTime.UtcNow;
        var gerencia = string.IsNullOrWhiteSpace(request.Gerencia) ? GerenciaPorDefecto : request.Gerencia.Trim();

        var solicitud = new Solicitud
        {
            IdUsuarioSolicitante = userId,
            Periodo = ahora.ToString("yyyy-MM"),
            Gerencia = gerencia,
            Estado = EstadoBorrador,
            DatosJson = request.Datos.ValueKind == JsonValueKind.Undefined || request.Datos.ValueKind == JsonValueKind.Null
                ? "{}"
                : request.Datos.GetRawText(),
            Activo = true,
            FechaCreacion = ahora,
            FechaModificacion = ahora,
        };

        _context.Solicitudes.Add(solicitud);
        await _context.SaveChangesAsync(ct);

        _context.SolicitudEventos.Add(new SolicitudEvento
        {
            IdSolicitud = solicitud.IdSolicitud,
            Tipo = "creada",
            PayloadJson = JsonSerializer.Serialize(new { estado = solicitud.Estado, gerencia }),
            IdUsuario = userId,
            FechaCreacion = ahora,
        });
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Solicitud viaticos {Id} creada por usuario {UserId} (periodo {Periodo}).",
            solicitud.IdSolicitud, userId, solicitud.Periodo);

        var dto = MapearDto(solicitud, opciones: false, eventos: false);
        return StatusCode(StatusCodes.Status201Created, new ApiResponse<SolicitudDto>
        {
            Success = true,
            Message = "Solicitud creada en borrador.",
            Data = dto
        });
    }

    // ----------------------------------------------------------------
    // GET /api/viaticos/solicitudes/mis
    // ----------------------------------------------------------------
    [HttpGet("solicitudes/mis")]
    [SwaggerOperation(
        Summary = "Mis solicitudes de viáticos",
        Description = "Lista las solicitudes del usuario autenticado, ordenado por fecha de creación desc.")]
    [SwaggerResponse(200, "Listado", typeof(ApiResponse<List<SolicitudDto>>))]
    [SwaggerResponse(401, "Sin token")]
    public async Task<IActionResult> MisSolicitudes(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "Token sin id de usuario válido."
            });
        }

        var rows = await _context.Solicitudes
            .AsNoTracking()
            .Where(s => s.IdUsuarioSolicitante == userId && s.Activo)
            .OrderByDescending(s => s.FechaCreacion)
            .ToListAsync(ct);

        var data = rows.Select(s => MapearDto(s, opciones: false, eventos: false)).ToList();
        return Ok(new ApiResponse<List<SolicitudDto>>
        {
            Success = true,
            Message = "Listado obtenido.",
            Data = data
        });
    }

    // ----------------------------------------------------------------
    // GET /api/viaticos/solicitudes/{id}
    // ----------------------------------------------------------------
    [HttpGet("solicitudes/{id:int}")]
    [SwaggerOperation(
        Summary = "Detalle de una solicitud",
        Description = "Incluye opciones y eventos. Solo el dueño puede verla, " +
                      "salvo que el solicitante tenga viaticos.ver_todos.")]
    [SwaggerResponse(200, "Detalle", typeof(ApiResponse<SolicitudDto>))]
    [SwaggerResponse(401, "Sin token")]
    [SwaggerResponse(403, "No es el dueño y no tiene viaticos.ver_todos")]
    [SwaggerResponse(404, "No existe")]
    public async Task<IActionResult> Detalle([FromRoute] int id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "Token sin id de usuario válido."
            });
        }

        var esVerTodos = User.TienePermiso(Permissions.Viaticos.VerTodos);
        var query = _context.Solicitudes
            .Include(s => s.Opciones)
            .Include(s => s.Eventos)
            .AsNoTracking()
            .Where(s => s.IdSolicitud == id && s.Activo);

        var solicitud = await query.FirstOrDefaultAsync(ct);
        if (solicitud is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Solicitud no encontrada."
            });
        }

        if (solicitud.IdUsuarioSolicitante != userId && !esVerTodos)
        {
            return Forbid();
        }

        var dto = MapearDto(solicitud, opciones: true, eventos: true);
        return Ok(new ApiResponse<SolicitudDto>
        {
            Success = true,
            Message = "Detalle obtenido.",
            Data = dto
        });
    }

    // ----------------------------------------------------------------
    // PUT /api/viaticos/solicitudes/{id}/opciones
    // ----------------------------------------------------------------
    [HttpPut("solicitudes/{id:int}/opciones")]
    [SwaggerOperation(
        Summary = "Persistir cotización (vuelo/hotel) y enviar la solicitud",
        Description = "Recibe { cotizacion: { opciones: [...] } }. " +
                      "Cada opción requiere url_compra y fuente. " +
                      "precio solo puede ser null si fuente contiene 'estimado'. " +
                      "Si la solicitud ya tenía opciones del mismo tipo, se reemplazan. " +
                      "Si la solicitud estaba en 'borrador', la misma transacción la pasa a 'enviada' " +
                      "y registra el evento 'enviada' junto al 'cotizacion_guardada'; " +
                      "guardar la cotización ES el envío. " +
                      "Una solicitud que ya no está en 'borrador' conserva su estado.")]
    [SwaggerResponse(200, "Cotización persistida", typeof(ApiResponse<SolicitudDto>))]
    [SwaggerResponse(400, "Cotización inválida (campo faltante o precio sin fuente estimado)")]
    [SwaggerResponse(401, "Sin token")]
    [SwaggerResponse(403, "No es el dueño y no tiene viaticos.ver_todos")]
    [SwaggerResponse(404, "Solicitud no existe")]
    public async Task<IActionResult> GuardarOpciones(
        [FromRoute] int id,
        [FromBody] CotizacionRequest request,
        CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Solicitar))
        {
            return Forbid();
        }
        if (request is null || request.Cotizacion.ValueKind == JsonValueKind.Undefined || request.Cotizacion.ValueKind == JsonValueKind.Null)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Body requerido con campo 'cotizacion'."
            });
        }

        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "Token sin id de usuario válido."
            });
        }

        // 1) Validar el JSON de cotización antes de tocar la BD.
        if (!request.Cotizacion.TryGetProperty("opciones", out var opcionesEl) || opcionesEl.ValueKind != JsonValueKind.Array)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "El campo 'opciones' debe ser un array."
            });
        }

        var ahora = DateTime.UtcNow;
        var nuevasOpciones = new List<SolicitudOpcion>();
        var indice = 0;
        foreach (var op in opcionesEl.EnumerateArray())
        {
            if (op.ValueKind != JsonValueKind.Object)
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"opciones[{indice}] debe ser un objeto."
                });
            }

            if (!op.TryGetProperty("url_compra", out var urlEl) || urlEl.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(urlEl.GetString()))
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"opciones[{indice}].url_compra es obligatorio."
                });
            }
            if (!op.TryGetProperty("fuente", out var fuenteEl) || fuenteEl.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(fuenteEl.GetString()))
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"opciones[{indice}].fuente es obligatorio."
                });
            }
            var fuente = fuenteEl.GetString()!.Trim();

            string? urlCompra = urlEl.GetString()!.Trim();
            decimal? precio = null;
            if (op.TryGetProperty("precio", out var precioEl) && precioEl.ValueKind == JsonValueKind.Number)
            {
                precio = precioEl.GetDecimal();
            }
            else if (op.TryGetProperty("precio", out var precioElNull) && precioElNull.ValueKind == JsonValueKind.Null)
            {
                precio = null;
            }
            else if (op.TryGetProperty("precio", out precioEl))
            {
                // precio con un tipo no soportado (p.ej. string) -> rechazado
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"opciones[{indice}].precio debe ser numérico o null."
                });
            }

            if (precio is null && fuente.IndexOf("estimado", StringComparison.OrdinalIgnoreCase) < 0)
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"opciones[{indice}].precio solo puede ser null si la fuente es estimada."
                });
            }

            var tipo = op.TryGetProperty("tipo", out var tipoEl) && tipoEl.ValueKind == JsonValueKind.String
                ? tipoEl.GetString()!
                : "vuelo";
            var linea = op.TryGetProperty("linea", out var lineaEl) && lineaEl.ValueKind == JsonValueKind.String
                ? lineaEl.GetString()!
                : "(sin línea)";
            var moneda = op.TryGetProperty("moneda", out var monEl) && monEl.ValueKind == JsonValueKind.String
                ? monEl.GetString()
                : null;
            var fueElegida = op.TryGetProperty("fue_elegida", out var feEl) && feEl.ValueKind == JsonValueKind.True;
            var rutaCaptura = op.TryGetProperty("ruta_captura", out var rcEl) && rcEl.ValueKind == JsonValueKind.String
                ? rcEl.GetString()
                : null;
            var datosJson = op.TryGetProperty("datos", out var dEl) && dEl.ValueKind == JsonValueKind.Object
                ? dEl.GetRawText()
                : null;

            nuevasOpciones.Add(new SolicitudOpcion
            {
                IdSolicitud = id,
                Tipo = tipo,
                Linea = linea,
                DatosJson = datosJson,
                Precio = precio,
                Moneda = moneda,
                UrlCompra = urlCompra,
                Fuente = fuente,
                FueElegida = fueElegida,
                RutaCaptura = rutaCaptura,
                CapturadaEn = rutaCaptura is not null ? (DateTime?)ahora : null,
            });
            indice++;
        }

        // 2) Cargar la solicitud (con verificación de dueño).
        var solicitud = await _context.Solicitudes
            .Include(s => s.Opciones)
            .Include(s => s.Eventos)
            .FirstOrDefaultAsync(s => s.IdSolicitud == id && s.Activo, ct);
        if (solicitud is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Solicitud no encontrada."
            });
        }

        var esVerTodos = User.TienePermiso(Permissions.Viaticos.VerTodos);
        if (solicitud.IdUsuarioSolicitante != userId && !esVerTodos)
        {
            return Forbid();
        }

        // 3) Reemplazar las opciones existentes (regla de UX: la última cotización gana).
        if (solicitud.Opciones.Count > 0)
        {
            _context.SolicitudOpciones.RemoveRange(solicitud.Opciones);
        }
        foreach (var nueva in nuevasOpciones)
        {
            _context.SolicitudOpciones.Add(nueva);
        }

        // 4) Transición borrador -> enviada. Guardar la cotización ES el envío:
        // es el único punto donde una solicitud entra a la bandeja autorizable,
        // porque AprobacionesController solo acepta 'enviada' y responde 409 en
        // cualquier otro estado. Va en el MISMO SaveChangesAsync que las
        // opciones y la bitácora, así que las tres escrituras son atómicas:
        // no queda una solicitud enviada sin cotización ni al revés.
        // Una solicitud en cualquier otro estado (autorizada, rechazada, ...)
        // conserva el suyo: aquí no se inventa ni se retrocede ningún estado.
        var hayQueEnviar = solicitud.Estado == EstadoBorrador;
        if (hayQueEnviar)
        {
            solicitud.Estado = EstadoEnviada;
        }

        // 5) Bitácora
        _context.SolicitudEventos.Add(new SolicitudEvento
        {
            IdSolicitud = id,
            Tipo = "cotizacion_guardada",
            PayloadJson = JsonSerializer.Serialize(new
            {
                opciones = nuevasOpciones.Count,
                ids = nuevasOpciones.Select(o => new { o.Tipo, o.FueElegida }).ToArray(),
            }),
            IdUsuario = userId,
            FechaCreacion = ahora,
        });

        if (hayQueEnviar)
        {
            _context.SolicitudEventos.Add(new SolicitudEvento
            {
                IdSolicitud = id,
                Tipo = EstadoEnviada,
                PayloadJson = JsonSerializer.Serialize(new
                {
                    estado_anterior = EstadoBorrador,
                    estado = EstadoEnviada,
                    opciones = nuevasOpciones.Count,
                }),
                IdUsuario = userId,
                FechaCreacion = ahora,
            });
        }

        solicitud.FechaModificacion = ahora;
        await _context.SaveChangesAsync(ct);

        // Recargar con las nuevas opciones para responder con el detalle completo.
        var recargada = await _context.Solicitudes
            .Include(s => s.Opciones)
            .Include(s => s.Eventos)
            .AsNoTracking()
            .FirstAsync(s => s.IdSolicitud == id, ct);

        var dto = MapearDto(recargada, opciones: true, eventos: true);
        return Ok(new ApiResponse<SolicitudDto>
        {
            Success = true,
            Message = $"Cotización persistida ({nuevasOpciones.Count} opción(es)).",
            Data = dto
        });
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------
    private static SolicitudDto MapearDto(Solicitud s, bool opciones, bool eventos)
    {
        JsonElement? datos = null;
        if (!string.IsNullOrWhiteSpace(s.DatosJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(s.DatosJson);
                datos = doc.RootElement.Clone();
            }
            catch (JsonException)
            {
                datos = null;
            }
        }

        return new SolicitudDto
        {
            IdSolicitud = s.IdSolicitud,
            IdUsuarioSolicitante = s.IdUsuarioSolicitante,
            Periodo = s.Periodo,
            Gerencia = s.Gerencia,
            Estado = s.Estado,
            Activo = s.Activo,
            FechaCreacion = s.FechaCreacion,
            FechaModificacion = s.FechaModificacion,
            Datos = datos,
            Opciones = opciones
                ? s.Opciones
                    .OrderBy(o => o.IdOpcion)
                    .Select(o => new SolicitudOpcionDto
                    {
                        IdOpcion = o.IdOpcion,
                        Tipo = o.Tipo,
                        Linea = o.Linea,
                        Precio = o.Precio,
                        Moneda = o.Moneda,
                        UrlCompra = o.UrlCompra,
                        Fuente = o.Fuente,
                        FueElegida = o.FueElegida,
                        RutaCaptura = o.RutaCaptura,
                    }).ToList()
                : new List<SolicitudOpcionDto>(),
            Eventos = eventos
                ? s.Eventos
                    .OrderBy(ev => ev.FechaCreacion)
                    .Select(ev => new SolicitudEventoDto
                    {
                        IdEvento = ev.IdEvento,
                        Tipo = ev.Tipo,
                        IdUsuario = ev.IdUsuario,
                        FechaCreacion = ev.FechaCreacion,
                        Payload = ParsearJsonTolerante(ev.PayloadJson),
                    }).ToList()
                : new List<SolicitudEventoDto>(),
        };
    }

    /// <summary>
    /// Convierte un *_json de la BD a <see cref="JsonElement"/> sin romper el
    /// detalle: null / vacio / JSON invalido devuelven <c>null</c>.
    /// </summary>
    private static JsonElement? ParsearJsonTolerante(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
