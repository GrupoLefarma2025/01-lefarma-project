using System.Text.Json;
using System.Text.Json.Nodes;
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
/// Endpoint que envuelve <c>captura-viaticos.mjs</c> (T7) y lo expone a la SPA.
/// T8 del plan costos-ruta-demo: el wizard de viaticos necesita una imagen
/// "para ir a comprar de inmediato" por opcion de la tabla.
/// </summary>
[ApiController]
[Route("api/viaticos")]
[EndpointGroupName("Viaticos")]
[Authorize]
public class CapturasController : ControllerBase
{
    private readonly CapturasService _service;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<CapturasController> _logger;
    private readonly string _capturasDir;

    public CapturasController(
        CapturasService service,
        ApplicationDbContext context,
        ILogger<CapturasController> logger)
    {
        _service = service;
        _context = context;
        _logger = logger;
        // Una sola fuente de verdad con CapturasService: si
        // CapturasSettings:OutputPath cambia la carpeta, el GET la sigue.
        _capturasDir = service.DirectorioCapturas;
    }

    /// <summary>
    /// Ruta absoluta de <paramref name="archivo"/> dentro del directorio de
    /// capturas, o <c>null</c> si la ruta escapa del directorio (traversal o
    /// ruta absoluta). Mismo criterio que <see cref="CapturasService"/>:
    /// <c>Path.GetFullPath</c> + comprobacion del prefijo del directorio con
    /// separador final.
    /// </summary>
    public static string? RutaDentroDelDirectorio(string directorioCapturas, string archivo)
    {
        if (string.IsNullOrWhiteSpace(archivo)) return null;

        var baseDir = Path.GetFullPath(directorioCapturas);
        var destino = Path.GetFullPath(Path.Combine(
            baseDir, archivo.Replace('/', Path.DirectorySeparatorChar)));
        var prefijo = baseDir + Path.DirectorySeparatorChar;
        return destino.StartsWith(prefijo, StringComparison.Ordinal) ? destino : null;
    }

    [HttpPost("capturas")]
    [SwaggerOperation(
        Summary = "Capturar pantallas PNG de URLs de compra",
        Description = "Acepta `urls` como array de strings o de objetos { url, nombre }. " +
                      "Valida whitelist (configurable, vacia por defecto), dominio (max 10) y " +
                      "delega al script captura-viaticos.mjs. Los PNG se copian a " +
                      "wwwroot/media/capturas-viaticos y se sirven, ya autenticados, por " +
                      "GET api/viaticos/capturas/{archivo}.")]
    [SwaggerResponse(200, "Capturas procesadas (cada item puede tener ok=false)", typeof(ApiResponse<List<CapturaResultDto>>))]
    [SwaggerResponse(400, "Demasiadas URLs o dominio fuera de la lista blanca")]
    public async Task<IActionResult> Capturar([FromBody] CapturaRequest? request, CancellationToken ct)
    {
        if (request?.Urls == null)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "el campo 'urls' es requerido",
            });
        }

        var items = new List<CapturaItem>(request.Urls.Count);
        foreach (var el in request.Urls)
        {
            switch (el.ValueKind)
            {
                case JsonValueKind.String:
                    var s = el.GetString();
                    if (string.IsNullOrWhiteSpace(s))
                    {
                        return BadRequest(new ApiResponse<object>
                        {
                            Success = false,
                            Message = "URL vacia en 'urls'",
                        });
                    }
                    items.Add(new CapturaItem { Url = s });
                    break;
                case JsonValueKind.Object:
                    var url = el.TryGetProperty("url", out var u) && u.ValueKind == JsonValueKind.String
                        ? u.GetString() ?? "" : "";
                    var nombre = el.TryGetProperty("nombre", out var n) && n.ValueKind == JsonValueKind.String
                        ? n.GetString() : null;
                    if (string.IsNullOrWhiteSpace(url))
                    {
                        return BadRequest(new ApiResponse<object>
                        {
                            Success = false,
                            Message = "objeto en 'urls' sin campo 'url'",
                        });
                    }
                    items.Add(new CapturaItem { Url = url, Nombre = nombre });
                    break;
                default:
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "elemento de 'urls' invalido (debe ser string u objeto {url,nombre})",
                    });
            }
        }

        var result = await _service.CapturarAsync(items, ct);

        if (result.Outcome == CapturaOutcome.TooMany || result.Outcome == CapturaOutcome.DomainBlocked)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = result.Message ?? "solicitud invalida",
            });
        }

        return Ok(new ApiResponse<List<CapturaResultDto>>
        {
            Success = true,
            Message = "Capturas procesadas.",
            Data = result.Results,
        });
    }

    /// <summary>
    /// Unico camino a los PNG bajo wwwroot/media/capturas-viaticos. El estatico
    /// anonimo /api/media/capturas-viaticos quedo cerrado (Program.cs), por eso
    /// el frontend pide la imagen con token y la pinta desde un object URL.
    /// </summary>
    [HttpGet("capturas/{**archivo}")]
    [SwaggerOperation(
        Summary = "Servir un PNG de captura de viaticos",
        Description = "Exige token ([Authorize]) y resuelve `archivo` DENTRO de " +
                      "wwwroot/media/capturas-viaticos: cualquier ruta que escape del " +
                      "directorio (traversal o ruta absoluta) se rechaza con 400.")]
    [SwaggerResponse(200, "PNG de la captura", typeof(FileResult))]
    [SwaggerResponse(400, "Ruta de captura invalida (traversal o ruta absoluta)")]
    [SwaggerResponse(404, "La captura no existe")]
    public IActionResult ObtenerCaptura(string archivo)
    {
        var ruta = RutaDentroDelDirectorio(_capturasDir, archivo);
        if (ruta is null)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "ruta de captura invalida",
            });
        }

        if (!System.IO.File.Exists(ruta))
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "captura no encontrada",
            });
        }

        return PhysicalFile(ruta, "image/png");
    }

    // ----------------------------------------------------------------
    // GET /api/viaticos/solicitudes/{id}/capturas
    // ----------------------------------------------------------------
    [HttpGet("solicitudes/{id:int}/capturas")]
    [SwaggerOperation(
        Summary = "Evidencias de un viaje: capturas y links de compra",
        Description = "Devuelve, por cada opcion cotizada del viaje, su link de compra " +
                      "(url_compra) y la captura ya guardada (ruta_captura + url_captura). " +
                      "No captura nada: si falta la evidencia, usa el POST del mismo path.")]
    [SwaggerResponse(200, "Evidencias (pueden venir sin captura)", typeof(ApiResponse<EvidenciasSolicitudDto>))]
    [SwaggerResponse(401, "Sin token")]
    [SwaggerResponse(403, "No es el dueño y no tiene viaticos.ver_todos")]
    [SwaggerResponse(404, "La solicitud no existe")]
    public async Task<IActionResult> Evidencias([FromRoute] int id, CancellationToken ct)
    {
        var (solicitud, error) = await CargarSolicitudPropiaAsync(id, ct);
        if (error is not null) return error;

        // En el GET no se captura nada: lo que ya existe se reporta como
        // reutilizada para que el cliente sepa cuantas pantallas hay sin
        // tener que revisar ruta_captura renglon por renglon.
        var existentes = solicitud!.Opciones.Count(o =>
            !string.IsNullOrWhiteSpace(o.RutaCaptura) && CapturaEnDisco(o.RutaCaptura));

        return Ok(new ApiResponse<EvidenciasSolicitudDto>
        {
            Success = true,
            Message = "Evidencias obtenidas.",
            Data = MapearEvidencias(solicitud, generadas: 0, reutilizadas: existentes, fallidas: 0, aviso: null),
        });
    }

    // ----------------------------------------------------------------
    // POST /api/viaticos/solicitudes/{id}/capturas
    // ----------------------------------------------------------------
    [HttpPost("solicitudes/{id:int}/capturas")]
    [SwaggerOperation(
        Summary = "Capturar pantallas de las opciones de un viaje",
        Description = "Toma (con Playwright) la captura de cada url_compra que aun no tiene " +
                      "evidencia y la persiste en solicitud_opciones.ruta_captura. " +
                      "Body opcional { forzar: true } para re-capturar las que ya existen. " +
                      "Maximo 10 opciones por llamada.")]
    [SwaggerResponse(200, "Evidencias con las capturas nuevas", typeof(ApiResponse<EvidenciasSolicitudDto>))]
    [SwaggerResponse(400, "Demasiadas opciones con link de compra para capturar de una vez")]
    [SwaggerResponse(401, "Sin token")]
    [SwaggerResponse(403, "No es el dueño y no tiene viaticos.ver_todos")]
    [SwaggerResponse(404, "La solicitud no existe")]
    public async Task<IActionResult> CapturarEvidencias(
        [FromRoute] int id,
        [FromBody] CapturarEvidenciasRequest? request,
        CancellationToken ct)
    {
        var (solicitud, error) = await CargarSolicitudPropiaAsync(id, ct);
        if (error is not null) return error;

        var forzar = request?.Forzar ?? false;
        var opciones = solicitud!.Opciones.OrderBy(o => o.IdOpcion).ToList();

        // Solo se intenta capturar lo que tiene link y (aun) no tiene PNG en
        // disco; `forzar` re-captura aunque ya exista. Si el PNG registrado en
        // la BD se perdio (otra maquina, carpeta limpiada), tambien se repite.
        var pendientes = opciones
            .Where(o => !string.IsNullOrWhiteSpace(o.UrlCompra))
            .Where(o => forzar || string.IsNullOrWhiteSpace(o.RutaCaptura) || !CapturaEnDisco(o.RutaCaptura))
            .ToList();

        string? aviso = null;
        if (pendientes.Count > CapturasService.MaxUrls)
        {
            aviso = $"Hay {pendientes.Count} opciones con link; se capturan las primeras " +
                    $"{CapturasService.MaxUrls}. Vuelve a llamar el endpoint para el resto.";
            pendientes = pendientes.Take(CapturasService.MaxUrls).ToList();
        }

        var generadas = 0;
        var fallidas = 0;
        if (pendientes.Count > 0)
        {
            var items = pendientes
                .Select(o => new CapturaItem
                {
                    Url = o.UrlCompra!,
                    // Nombre deterministico: re-capturar sobreescribe el mismo
                    // PNG en vez de acumular archivos huerfanos.
                    Nombre = $"viaje{solicitud.IdSolicitud}-op{o.IdOpcion}",
                })
                .ToList();

            var resultado = await _service.CapturarAsync(items, ct);
            var porUrl = resultado.Results
                .Where(r => !string.IsNullOrWhiteSpace(r.Url))
                .GroupBy(r => r.Url!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

            foreach (var opcion in pendientes)
            {
                if (!porUrl.TryGetValue(opcion.UrlCompra!, out var captura) ||
                    !captura.Ok ||
                    string.IsNullOrWhiteSpace(captura.Archivo))
                {
                    fallidas++;
                    continue;
                }

                opcion.RutaCaptura = captura.Archivo;
                opcion.CapturadaEn = DateTime.UtcNow;
                generadas++;
            }

            if (generadas > 0)
            {
                await _context.SaveChangesAsync(ct);
            }
        }

        var reutilizadas = opciones.Count(o =>
            !string.IsNullOrWhiteSpace(o.RutaCaptura) && !pendientes.Contains(o));

        _logger.LogInformation(
            "Evidencias viaje {IdSolicitud}: generadas={Generadas}, reutilizadas={Reutilizadas}, fallidas={Fallidas}",
            solicitud.IdSolicitud, generadas, reutilizadas, fallidas);

        return Ok(new ApiResponse<EvidenciasSolicitudDto>
        {
            Success = true,
            Message = generadas > 0
                ? $"Se capturaron {generadas} pantalla(s)."
                : "No hubo capturas nuevas.",
            Data = MapearEvidencias(solicitud, generadas, reutilizadas, fallidas, aviso),
        });
    }

    // ----------------------------------------------------------------
    // POST /api/viaticos/solicitudes/{id}/buscar
    // ----------------------------------------------------------------
    [HttpPost("solicitudes/{id:int}/buscar")]
    [SwaggerOperation(
        Summary = "Buscar informacion del viaje y capturar pantallas con el agente",
        Description = "Para cada opcion con link de compra pide al servicio de capturas " +
                      "(modo agentico: OpenCode + Playwright MCP) navegar la pagina, extraer " +
                      "los datos del viaje (transportista, horarios, precio) y tomar la captura. " +
                      "Persiste captura y el bloque 'informacion_buscada' en solicitud_opciones. " +
                      "Maximo 10 opciones por llamada.")]
    [SwaggerResponse(200, "Evidencias con los datos buscados", typeof(ApiResponse<EvidenciasSolicitudDto>))]
    [SwaggerResponse(401, "Sin token")]
    [SwaggerResponse(403, "No es el dueño y no tiene viaticos.ver_todos")]
    [SwaggerResponse(404, "La solicitud no existe")]
    public async Task<IActionResult> BuscarEvidencias(
        [FromRoute] int id,
        [FromBody] BuscarEvidenciasRequest? request,
        CancellationToken ct)
    {
        var (solicitud, error) = await CargarSolicitudPropiaAsync(id, ct);
        if (error is not null) return error;

        var opciones = solicitud!.Opciones.OrderBy(o => o.IdOpcion).ToList();
        if (request?.OpcionId is int soloOpcion)
        {
            var elegida = opciones.FirstOrDefault(o => o.IdOpcion == soloOpcion);
            if (elegida is null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = $"La opcion {soloOpcion} no pertenece al viaje.",
                });
            }
            opciones = new List<SolicitudOpcion> { elegida };
        }

        var conLink = opciones.Where(o => !string.IsNullOrWhiteSpace(o.UrlCompra)).ToList();

        string? aviso = null;
        if (conLink.Count > CapturasService.MaxUrls)
        {
            aviso = $"Hay {conLink.Count} opciones con link; se buscan las primeras " +
                    $"{CapturasService.MaxUrls}. Vuelve a llamar el endpoint para el resto.";
            conLink = conLink.Take(CapturasService.MaxUrls).ToList();
        }

        var contexto = ContextoDeSolicitud(solicitud);
        var generadas = 0;
        var fallidas = 0;
        var conDatos = 0;
        foreach (var opcion in conLink)
        {
            var item = new CapturaItem
            {
                Url = opcion.UrlCompra!,
                Nombre = $"viaje{solicitud.IdSolicitud}-op{opcion.IdOpcion}",
            };

            var busqueda = await _service.BuscarAsync(item, contexto, ct);
            if (!busqueda.Captura.Ok || string.IsNullOrWhiteSpace(busqueda.Captura.Archivo))
            {
                fallidas++;
                _logger.LogWarning(
                    "Busqueda viaje {IdSolicitud} opcion {IdOpcion} sin captura: {Error}",
                    solicitud.IdSolicitud, opcion.IdOpcion, busqueda.Captura.Error);
                continue;
            }

            opcion.RutaCaptura = busqueda.Captura.Archivo;
            opcion.CapturadaEn = busqueda.BuscadoEn;
            opcion.DatosJson = CombinarDatos(opcion.DatosJson, busqueda.Datos);
            generadas++;
            if (busqueda.Datos is not null) conDatos++;
        }

        if (generadas > 0)
        {
            await _context.SaveChangesAsync(ct);
        }

        _logger.LogInformation(
            "Busqueda viaje {IdSolicitud}: generadas={Generadas}, con_datos={ConDatos}, fallidas={Fallidas}",
            solicitud.IdSolicitud, generadas, conDatos, fallidas);

        return Ok(new ApiResponse<EvidenciasSolicitudDto>
        {
            Success = true,
            Message = generadas > 0
                ? $"Se buscaron {generadas} opcion(es); {conDatos} con datos estructurados."
                : "No se pudo buscar informacion de las opciones.",
            Data = MapearEvidencias(solicitud, generadas, 0, fallidas, aviso),
        });
    }

    // ----------------------------------------------------------------
    // POST /api/viaticos/capturas/buscar
    // ----------------------------------------------------------------
    [HttpPost("capturas/buscar")]
    [SwaggerOperation(
        Summary = "Buscar una oferta en su sitio y capturar los RESULTADOS",
        Description = "Pide al servicio de capturas (OpenCode + Playwright MCP) abrir la URL " +
                      "del proveedor, llenar su buscador con el contexto de la ruta " +
                      "(origen, destino y fecha), ejecutar la busqueda y devolver la captura de " +
                      "la pagina de RESULTADOS con el costo y horarios detectados. " +
                      "Devuelve Success=false con el motivo si el agente no logro capturar.")]
    [SwaggerResponse(200, "Captura y datos de la oferta buscada", typeof(ApiResponse<CapturaBuscadaDto>))]
    [SwaggerResponse(400, "Falta la url")]
    [SwaggerResponse(401, "Sin token")]
    public async Task<IActionResult> BuscarCaptura(
        [FromBody] BuscarCapturaRequest request,
        CancellationToken ct)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Url))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Falta la url de la oferta que se quiere buscar.",
            });
        }

        var item = new CapturaItem
        {
            Url = request.Url.Trim(),
            Nombre = string.IsNullOrWhiteSpace(request.Nombre) ? "busqueda" : request.Nombre.Trim(),
        };

        var busqueda = await _service.BuscarAsync(item, request.Contexto, ct);
        if (!busqueda.Captura.Ok || string.IsNullOrWhiteSpace(busqueda.Captura.Archivo))
        {
            return Ok(new ApiResponse<CapturaBuscadaDto>
            {
                Success = false,
                Message = busqueda.Captura.Error ?? "No se pudo buscar la oferta en el sitio.",
                Data = new CapturaBuscadaDto { Error = busqueda.Captura.Error },
            });
        }

        _logger.LogInformation(
            "Busqueda de oferta {Url}: archivo={Archivo}, modelo={Modelo}",
            item.Url, busqueda.Captura.Archivo, busqueda.Modelo);

        return Ok(new ApiResponse<CapturaBuscadaDto>
        {
            Success = true,
            Message = "Busqueda lista.",
            Data = new CapturaBuscadaDto
            {
                Archivo = busqueda.Captura.Archivo,
                UrlCaptura = UrlPublicaCaptura(busqueda.Captura.Archivo!),
                Datos = busqueda.Datos,
                Modelo = busqueda.Modelo,
                BuscadoEn = busqueda.BuscadoEn,
                Error = busqueda.Advertencia,
            },
        });
    }

    /// <summary>
    /// Arma el contexto que se manda al agente para que llene el buscador del
    /// sitio: origen, destino y fecha de llegada del <c>datos_json</c> del
    /// wizard (solicitud-v2).
    /// </summary>
    private static string? ContextoDeSolicitud(Solicitud solicitud)
    {
        if (string.IsNullOrWhiteSpace(solicitud.DatosJson)) return null;

        try
        {
            using var doc = JsonDocument.Parse(solicitud.DatosJson);
            var raiz = doc.RootElement;
            string? origen = null;
            string? destino = null;
            string? fecha = null;
            string? hora = null;

            if (raiz.TryGetProperty("origen", out var origenEl) &&
                origenEl.ValueKind == JsonValueKind.Object &&
                origenEl.TryGetProperty("punto", out var puntoOrigen) &&
                puntoOrigen.ValueKind == JsonValueKind.Object &&
                puntoOrigen.TryGetProperty("nombre", out var nombreOrigen) &&
                nombreOrigen.ValueKind == JsonValueKind.String)
            {
                origen = nombreOrigen.GetString();
            }

            if (raiz.TryGetProperty("destinos", out var destinosEl) &&
                destinosEl.ValueKind == JsonValueKind.Array &&
                destinosEl.GetArrayLength() > 0)
            {
                var primer = destinosEl[0];
                if (primer.ValueKind == JsonValueKind.Object &&
                    primer.TryGetProperty("punto", out var puntoDestino) &&
                    puntoDestino.ValueKind == JsonValueKind.Object &&
                    puntoDestino.TryGetProperty("nombre", out var nombreDestino) &&
                    nombreDestino.ValueKind == JsonValueKind.String)
                {
                    destino = nombreDestino.GetString();
                }
                if (primer.ValueKind == JsonValueKind.Object &&
                    primer.TryGetProperty("debeEstarFecha", out var fechaEl) &&
                    fechaEl.ValueKind == JsonValueKind.String)
                {
                    fecha = fechaEl.GetString();
                }
                if (primer.ValueKind == JsonValueKind.Object &&
                    primer.TryGetProperty("debeEstarHora", out var horaEl) &&
                    horaEl.ValueKind == JsonValueKind.String)
                {
                    hora = horaEl.GetString();
                }
            }

            var partes = new List<string>();
            if (!string.IsNullOrWhiteSpace(origen)) partes.Add($"Origen: {origen}");
            if (!string.IsNullOrWhiteSpace(destino)) partes.Add($"Destino: {destino}");
            if (!string.IsNullOrWhiteSpace(fecha))
            {
                partes.Add(string.IsNullOrWhiteSpace(hora)
                    ? $"Fecha de llegada: {fecha}"
                    : $"Fecha de llegada: {fecha} {hora}");
            }

            return partes.Count > 0 ? string.Join("; ", partes) : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// Carga la solicitud activa con sus opciones y valida dueño / permiso
    /// <c>viaticos.ver_todos</c>, igual que el GET de detalle de la solicitud.
    /// </summary>
    private async Task<(Solicitud? Solicitud, IActionResult? Error)> CargarSolicitudPropiaAsync(
        int id,
        CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return (null, Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "Token sin id de usuario válido.",
            }));
        }

        var solicitud = await _context.Solicitudes
            .Include(s => s.Opciones)
            .FirstOrDefaultAsync(s => s.IdSolicitud == id && s.Activo, ct);

        if (solicitud is null)
        {
            return (null, NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Solicitud no encontrada.",
            }));
        }

        var esVerTodos = User.TienePermiso(Permissions.Viaticos.VerTodos);
        if (solicitud.IdUsuarioSolicitante != userId && !esVerTodos)
        {
            return (null, Forbid());
        }

        return (solicitud, null);
    }

    private EvidenciasSolicitudDto MapearEvidencias(
        Solicitud solicitud,
        int generadas,
        int reutilizadas,
        int fallidas,
        string? aviso)
    {
        return new EvidenciasSolicitudDto
        {
            IdSolicitud = solicitud.IdSolicitud,
            Folio = solicitud.Folio,
            Generadas = generadas,
            Reutilizadas = reutilizadas,
            Fallidas = fallidas,
            Aviso = aviso,
            Opciones = solicitud.Opciones
                .OrderBy(o => o.IdOpcion)
                .Select(o => new EvidenciaOpcionDto
                {
                    IdOpcion = o.IdOpcion,
                    Tipo = o.Tipo,
                    Linea = o.Linea,
                    Precio = o.Precio,
                    Moneda = o.Moneda,
                    Fuente = o.Fuente,
                    FueElegida = o.FueElegida,
                    UrlCompra = o.UrlCompra,
                    RutaCaptura = o.RutaCaptura,
                    UrlCaptura = UrlPublicaCaptura(o.RutaCaptura),
                    CapturadaEn = o.CapturadaEn,
                    Error = string.IsNullOrWhiteSpace(o.UrlCompra)
                        ? "Sin enlace de compra registrado."
                        : string.IsNullOrWhiteSpace(o.RutaCaptura)
                            ? "Sin captura."
                            : null,
                    Datos = LeerInformacionBuscada(o.DatosJson),
                    BuscadoEn = LeerBuscadoEn(o.DatosJson),
                })
                .ToList(),
        };
    }

    /// <summary>true si la ruta persistida apunta a un PNG que sigue en disco.</summary>
    private bool CapturaEnDisco(string rutaCaptura)
    {
        var ruta = RutaDentroDelDirectorio(_capturasDir, rutaCaptura
            .Replace(CapturasService.CarpetaPublica + "/", "", StringComparison.Ordinal));
        return ruta is not null && System.IO.File.Exists(ruta);
    }

    /// <summary>Ruta publica autenticada del PNG: /api/viaticos/capturas/{archivo}.</summary>
    private static string? UrlPublicaCaptura(string? rutaCaptura)
    {
        if (string.IsNullOrWhiteSpace(rutaCaptura)) return null;
        var nombre = Path.GetFileName(rutaCaptura.Replace('/', Path.DirectorySeparatorChar));
        return string.IsNullOrWhiteSpace(nombre)
            ? null
            : $"/api/viaticos/capturas/{Uri.EscapeDataString(nombre)}";
    }

    /// <summary>Tamaño maximo aceptado para una captura externa (8 MiB).</summary>
    public const long MaxCapturaBytes = 8 * 1024 * 1024;

    private static ReadOnlySpan<byte> PngSignature =>
        new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };

    /// <summary>
    /// Adjunta un PNG tomado FUERA del backend (navegador real, harness del
    /// agente o captura manual) y lo publica en la misma carpeta y ruta publica
    /// que usa la captura automatica. No sustituye a POST /capturas: es la via
    /// para las paginas que el headless no alcanza (login, CAPTCHA o precio que
    /// solo aparece tras llenar el formulario).
    /// </summary>
    [HttpPost("capturas/adjuntar")]
    [RequestSizeLimit(MaxCapturaBytes)]
    [Consumes("multipart/form-data")]
    [SwaggerOperation(
        Summary = "Adjuntar una captura PNG tomada fuera del backend",
        Description = "multipart/form-data con `Archivo` (PNG, max 8 MiB) y `Nombre` opcional. " +
                      "Devuelve la misma ruta publica que POST /capturas: " +
                      "capturas-viaticos/<nombre>.png.")]
    [SwaggerResponse(200, "Captura publicada", typeof(ApiResponse<CapturaResultDto>))]
    [SwaggerResponse(400, "Archivo ausente, demasiado grande o que no es PNG")]
    public async Task<IActionResult> Adjuntar(
        [FromForm] AdjuntarCapturaRequest request,
        CancellationToken ct)
    {
        var archivo = request.Archivo;

        if (archivo is null || archivo.Length == 0)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "falta el archivo 'archivo' (PNG)",
            });
        }

        if (archivo.Length > MaxCapturaBytes)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = $"la captura excede {MaxCapturaBytes / (1024 * 1024)} MiB",
            });
        }

        if (!string.Equals(archivo.ContentType, "image/png", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "solo se aceptan imagenes PNG",
            });
        }

        var bytes = new byte[archivo.Length];
        await using (var stream = archivo.OpenReadStream())
        {
            var leidos = 0;
            while (leidos < bytes.Length)
            {
                var n = await stream.ReadAsync(bytes.AsMemory(leidos), ct);
                if (n == 0) break;
                leidos += n;
            }

            if (leidos != bytes.Length)
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = "no se pudo leer el archivo completo",
                });
            }
        }

        if (bytes.Length < PngSignature.Length ||
            !bytes.AsSpan(0, PngSignature.Length).SequenceEqual(PngSignature))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "el archivo no es un PNG valido",
            });
        }

        var baseName = NombreSeguro(request.Nombre) ?? $"captura-{Guid.NewGuid():N}";
        var destino = Path.Combine(_capturasDir, baseName + ".png");
        Directory.CreateDirectory(_capturasDir);

        try
        {
            await System.IO.File.WriteAllBytesAsync(destino, bytes, ct);
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = $"no se pudo guardar la captura: {ex.Message}",
            });
        }

        return Ok(new ApiResponse<CapturaResultDto>
        {
            Success = true,
            Message = "Captura adjuntada.",
            Data = new CapturaResultDto
            {
                Url = null,
                Ok = true,
                Archivo = $"{CapturasService.CarpetaPublica}/{baseName}.png",
            },
        });
    }

    /// <summary>
    /// Nombre de archivo seguro: mismos caracteres que sanitizeName del script
    /// ([a-zA-Z0-9_-]); el resto se vuelve '_'. <c>null</c> si no queda nada.
    /// </summary>
    private static string? NombreSeguro(string? nombre)
    {
        if (string.IsNullOrWhiteSpace(nombre)) return null;

        var limpio = string.Concat(
            nombre.Select(c => char.IsAsciiLetterOrDigit(c) || c is '_' or '-' ? c : '_'))
            .Trim('_');

        if (limpio.Length == 0) return null;
        return limpio.Length <= 120 ? limpio : limpio[..120];
    }

    /// <summary>
    /// Guarda el bloque <c>informacion_buscada</c> dentro del JSON de la opcion
    /// sin pisar lo que ya tenia (por ejemplo, los datos importados de pi).
    /// </summary>
    private static string? CombinarDatos(string? datosExistentes, JsonElement? datos)
    {
        if (datos is null) return datosExistentes;

        JsonObject raiz;
        if (string.IsNullOrWhiteSpace(datosExistentes))
        {
            raiz = new JsonObject();
        }
        else
        {
            try
            {
                raiz = JsonNode.Parse(datosExistentes) as JsonObject ?? new JsonObject();
            }
            catch
            {
                raiz = new JsonObject();
            }
        }

        raiz["informacion_buscada"] = JsonNode.Parse(datos.Value.GetRawText());
        raiz["informacion_buscada_en"] = DateTime.UtcNow.ToString("o");
        return raiz.ToJsonString();
    }

    /// <summary>Extrae <c>informacion_buscada</c> del JSON persistido (si existe).</summary>
    private static JsonElement? LeerInformacionBuscada(string? datosJson)
    {
        if (string.IsNullOrWhiteSpace(datosJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(datosJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return null;
            return doc.RootElement.TryGetProperty("informacion_buscada", out var info) &&
                   info.ValueKind == JsonValueKind.Object
                ? info.Clone()
                : null;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Fecha de la ultima busqueda agentica guardada en el JSON.</summary>
    private static DateTime? LeerBuscadoEn(string? datosJson)
    {
        if (string.IsNullOrWhiteSpace(datosJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(datosJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return null;
            return doc.RootElement.TryGetProperty("informacion_buscada_en", out var fecha) &&
                   fecha.ValueKind == JsonValueKind.String &&
                   fecha.TryGetDateTime(out var valor)
                ? valor
                : null;
        }
        catch
        {
            return null;
        }
    }
}
