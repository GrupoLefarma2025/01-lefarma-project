using System.Runtime.CompilerServices;
using System.Security.Claims;
using System.Text.Json;
using Lefarma.API.Domain.Entities.Asokam;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.OrdenesCompra.Firmas;
using Lefarma.API.Features.Viaticos.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Viaticos;

[ApiController]
[Route("api/viaticos/macro-concentrado")]
[EndpointGroupName("Viaticos")]
[Authorize]
public class MacroConcentradoController : ControllerBase
{
    private const string PermisoConcentrado = "ordenes.envio_concentrado";

    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly IWorkflowRepository _workflowRepo;
    private readonly IOrdenCompraFirmasService _firmasService;
    private readonly ILogger<MacroConcentradoController> _logger;

    public MacroConcentradoController(
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        IWorkflowRepository workflowRepo,
        IOrdenCompraFirmasService firmasService,
        ILogger<MacroConcentradoController> logger)
    {
        _context = context;
        _asokamContext = asokamContext;
        _workflowRepo = workflowRepo;
        _firmasService = firmasService;
        _logger = logger;
    }

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

    private async Task<HashSet<string>> ObtenerFoliosEnviadosAsync(CancellationToken ct)
    {
        var folios = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        try
        {
            var metadatos = await _asokamContext.Documentos
                .AsNoTracking()
                .Where(d => d.Activo &&
                            d.MetadataJSON != null &&
                            d.MetadataJSON.Contains("concentrado_viaticos"))
                .Select(d => d.MetadataJSON!)
                .ToListAsync(ct);

            foreach (var metadata in metadatos)
            {
                try
                {
                    using var json = JsonDocument.Parse(metadata);
                    if (!json.RootElement.TryGetProperty("tipo", out var tipoJson) ||
                        tipoJson.ValueKind != JsonValueKind.String ||
                        !string.Equals(tipoJson.GetString(), "concentrado_viaticos", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    if (json.RootElement.TryGetProperty("aplicado", out var aplicadoJson) &&
                        aplicadoJson.ValueKind == JsonValueKind.False)
                    {
                        continue;
                    }

                    if (!json.RootElement.TryGetProperty("folios", out var foliosJson) ||
                        foliosJson.ValueKind != JsonValueKind.Array)
                    {
                        continue;
                    }

                    foreach (var item in foliosJson.EnumerateArray())
                    {
                        if (item.ValueKind != JsonValueKind.String) continue;
                        var folio = item.GetString();
                        if (!string.IsNullOrWhiteSpace(folio))
                        {
                            folios.Add(folio.Trim());
                        }
                    }
                }
                catch (JsonException ex)
                {
                    _logger.LogWarning(ex, "MetadataJSON inválido en app.Documentos; se omite.");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudieron leer los folios enviados desde app.Documentos; se muestran todos los viáticos.");
        }

        return folios;
    }

    [HttpGet]
    [SwaggerOperation(
        Summary = "Concentrado macro de viáticos",
        Description = "Lista las filas de dbo.infoMacroViaticos para el concentrado de CxP. Requiere el permiso ordenes.envio_concentrado.")]
    [SwaggerResponse(200, "Concentrado obtenido", typeof(ApiResponse<IReadOnlyList<MacroViaticoResponse>>))]
    [SwaggerResponse(401, "Sin token válido.")]
    [SwaggerResponse(403, "Sin permiso ordenes.envio_concentrado.")]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!User.TienePermiso(PermisoConcentrado))
        {
            return StatusCode(403, new ApiResponse<object>
            {
                Success = false,
                Message = "No tienes permiso para consultar el concentrado de viáticos.",
                Data = null
            });
        }

        try
        {
            var filas = await _context.Database
                .SqlQuery<MacroViaticoResponse>(FormattableStringFactory.Create(
                    "SELECT folio, nombre, gerencia, " +
                    "COALESCE(TRY_CONVERT(date, CONVERT(varchar(50), fecha), 103), " +
                    "TRY_CONVERT(date, CONVERT(varchar(50), fecha), 23), " +
                    "TRY_CONVERT(date, CONVERT(varchar(50), fecha))) AS fecha, " +
                    "renglon, solicitante, " +
                    "COALESCE(TRY_CONVERT(date, viaje.inicio, 103), " +
                    "TRY_CONVERT(date, viaje.inicio, 23), " +
                    "TRY_CONVERT(date, viaje.inicio)) AS fechInicio, " +
                    "COALESCE(TRY_CONVERT(date, viaje.fin, 103), " +
                    "TRY_CONVERT(date, viaje.fin, 23), " +
                    "TRY_CONVERT(date, viaje.fin), " +
                    "TRY_CONVERT(date, NULLIF(CONVERT(varchar(50), m.fechaFin), ''), 103), " +
                    "TRY_CONVERT(date, NULLIF(CONVERT(varchar(50), m.fechaFin), ''), 23), " +
                    "TRY_CONVERT(date, NULLIF(CONVERT(varchar(50), m.fechaFin), ''))) AS fechaFin, " +
                    "origen, destino, costoAutobus, costoAvion, costoGasolina, costoCasetas, " +
                    "costoHospedaje, costoComida, costoTaxi, diasHospedaje, numeroComidas " +
                    "FROM dbo.infoMacroViaticos m " +
                    "CROSS APPLY (SELECT LTRIM(RTRIM(REPLACE(REPLACE(CONVERT(varchar(50), m.fechInicio), CHAR(13), ' '), CHAR(10), ' '))) AS texto) normalizado " +
                    "CROSS APPLY (SELECT CHARINDEX(' AL ', UPPER(normalizado.texto) + ' AL ') AS posicion) busqueda " +
                    "CROSS APPLY (SELECT LEFT(normalizado.texto, busqueda.posicion - 1) AS inicio, " +
                    "NULLIF(LTRIM(RTRIM(SUBSTRING(normalizado.texto, busqueda.posicion + 4, 50))), '') AS fin) viaje " +
                    "WHERE NOT EXISTS (" +
                    "SELECT 1 FROM operaciones.ordenes_compra oc " +
                    "INNER JOIN config.workflow_estados e ON e.id_estado = oc.id_estado " +
                    "WHERE oc.folio = m.folio " +
                    "AND UPPER(e.nombre) IN ('CANCELADA', 'RECHAZADA')) " +
                    "ORDER BY 4 DESC, 2, 3, 5"))
                .ToListAsync(ct);

            var foliosFilas = filas
                .Select(fila => fila.Folio.Trim())
                .Where(folio => folio.Length > 0)
                .Distinct()
                .ToList();

            var idEstadoPreparacion = await _context.WorkflowEstados
                .Where(e => e.Activo && e.Codigo == WorkflowEstadoCodigo.PREPARACION)
                .Select(e => (int?)e.IdEstado)
                .FirstOrDefaultAsync(ct);

            Dictionary<string, int> estadoPorFolio = new(StringComparer.OrdinalIgnoreCase);
            if (idEstadoPreparacion.HasValue && foliosFilas.Count > 0)
            {
                estadoPorFolio = (await _context.OrdenesCompra
                        .Where(o => foliosFilas.Contains(o.Folio))
                        .Select(o => new { o.Folio, o.IdEstado })
                        .ToListAsync(ct))
                    .DistinctBy(o => o.Folio, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(o => o.Folio, o => o.IdEstado, StringComparer.OrdinalIgnoreCase);
            }

            var foliosEnviados = await ObtenerFoliosEnviadosAsync(ct);
            var visibles = filas
                .Where(fila => idEstadoPreparacion.HasValue
                    && estadoPorFolio.TryGetValue(fila.Folio.Trim(), out var idEstado)
                    && idEstado == idEstadoPreparacion.Value)
                .Where(fila => !foliosEnviados.Contains(fila.Folio))
                .ToList();

            return Ok(new ApiResponse<IReadOnlyList<MacroViaticoResponse>>
            {
                Success = true,
                Message = "Concentrado de viáticos obtenido exitosamente.",
                Data = visibles
            });
        }
        catch (SqlException ex) when (ex.Number == 208)
        {
            _logger.LogWarning(ex, "La tabla dbo.infoMacroViaticos no existe; se devuelve un concentrado vacío.");

            return Ok(new ApiResponse<IReadOnlyList<MacroViaticoResponse>>
            {
                Success = true,
                Message = "No hay viáticos disponibles.",
                Data = Array.Empty<MacroViaticoResponse>()
            });
        }
    }

    [HttpPost("pdf")]
    [RequestSizeLimit(25_000_000)]
    [SwaggerOperation(
        Summary = "Enviar concentrado de viáticos a autorización",
        Description = "Persiste el PDF del concentrado de viáticos en app.Documentos. Requiere el permiso ordenes.envio_concentrado.")]
    [SwaggerResponse(200, "Concentrado enviado", typeof(ApiResponse<MacroConcentradoEnvioResponse>))]
    [SwaggerResponse(400, "Faltan el archivo o los folios.")]
    [SwaggerResponse(401, "Sin token válido.")]
    [SwaggerResponse(403, "Sin permiso ordenes.envio_concentrado.")]
    public async Task<IActionResult> Enviar(
        [FromForm] MacroConcentradoEnvioRequest request,
        CancellationToken ct)
    {
        if (!User.TienePermiso(PermisoConcentrado))
        {
            return StatusCode(403, new ApiResponse<object>
            {
                Success = false,
                Message = "No tienes permiso para enviar el concentrado de viáticos.",
                Data = null
            });
        }

        if (request.Archivo is null || request.Archivo.Length == 0)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Adjunta el PDF del concentrado de viáticos.",
                Data = null
            });
        }

        var folios = request.Folios
            .Where(folio => !string.IsNullOrWhiteSpace(folio))
            .Select(folio => folio.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (folios.Count == 0)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Selecciona al menos un viático para enviar.",
                Data = null
            });
        }

        var idEstadoPreparacion = await _context.WorkflowEstados
            .Where(e => e.Activo && e.Codigo == WorkflowEstadoCodigo.PREPARACION)
            .Select(e => (int?)e.IdEstado)
            .FirstOrDefaultAsync(ct);
        if (idEstadoPreparacion is null)
        {
            return StatusCode(500, new ApiResponse<object>
            {
                Success = false,
                Message = "El catálogo de estados no tiene el estado PREPARACION.",
                Data = null
            });
        }

        var estados = await _context.WorkflowEstados
            .Where(e => e.Activo)
            .ToDictionaryAsync(e => e.IdEstado, e => e.Nombre ?? e.Codigo ?? e.IdEstado.ToString(), ct);

        var ordenesPorFolio = (await _context.OrdenesCompra
                .Where(o => folios.Contains(o.Folio))
                .ToListAsync(ct))
            .ToDictionary(o => o.Folio, o => o, StringComparer.OrdinalIgnoreCase);

        var foliosEnviados = await ObtenerFoliosEnviadosAsync(ct);

        var accionesPorPaso = new Dictionary<int, WorkflowAccion?>();
        var resultados = new List<MacroConcentradoEnvioItemResult>();
        var foliosValidos = new List<(OrdenCompra Orden, WorkflowAccion Accion)>();

        foreach (var folio in folios)
        {
            if (!ordenesPorFolio.TryGetValue(folio, out var orden))
            {
                resultados.Add(new MacroConcentradoEnvioItemResult
                {
                    Folio = folio,
                    Exitoso = false,
                    Motivo = "No existe una orden de compra con ese folio."
                });
                continue;
            }

            if (!orden.IdPasoActual.HasValue)
            {
                resultados.Add(new MacroConcentradoEnvioItemResult
                {
                    Folio = folio,
                    Exitoso = false,
                    Motivo = "La orden no tiene paso actual."
                });
                continue;
            }

            if (orden.IdEstado != idEstadoPreparacion.Value)
            {
                var estadoActual = estados.GetValueOrDefault(orden.IdEstado, $"estado {orden.IdEstado}");
                resultados.Add(new MacroConcentradoEnvioItemResult
                {
                    Folio = folio,
                    Exitoso = false,
                    Motivo = $"La orden no está lista para concentrado (estado actual: {estadoActual})."
                });
                continue;
            }

            if (foliosEnviados.Contains(folio))
            {
                resultados.Add(new MacroConcentradoEnvioItemResult
                {
                    Folio = folio,
                    Exitoso = false,
                    Motivo = "Ya fue enviada en un concentrado de viáticos."
                });
                continue;
            }

            if (!accionesPorPaso.TryGetValue(orden.IdPasoActual.Value, out var accionEnviar))
            {
                var acciones = await _workflowRepo.GetAccionesDisponiblesAsync(orden.IdPasoActual.Value);
                accionEnviar = acciones.FirstOrDefault(a => a.EnviaConcentrado && a.Activo);
                accionesPorPaso[orden.IdPasoActual.Value] = accionEnviar;
            }

            if (accionEnviar is null)
            {
                resultados.Add(new MacroConcentradoEnvioItemResult
                {
                    Folio = folio,
                    Exitoso = false,
                    Motivo = "La orden no tiene acción de envío concentrado disponible en su paso actual."
                });
                continue;
            }

            resultados.Add(new MacroConcentradoEnvioItemResult { Folio = folio, Exitoso = true });
            foliosValidos.Add((orden, accionEnviar));
        }

        if (resultados.Any(r => !r.Exitoso))
        {
            return BadRequest(new ApiResponse<MacroConcentradoEnvioResponse>
            {
                Success = false,
                Message = "No se puede enviar el concentrado: "
                    + string.Join("; ", resultados.Where(r => !r.Exitoso).Select(r => $"{r.Folio}: {r.Motivo}")),
                Data = new MacroConcentradoEnvioResponse
                {
                    TotalFolios = folios.Count,
                    Resultados = resultados
                }
            });
        }

        var nombreArchivo = string.IsNullOrWhiteSpace(request.Nombre)
            ? $"concentrado-viaticos-{DateTime.Now:yyyyMMddHHmm}"
            : request.Nombre.Trim();
        if (!nombreArchivo.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
        {
            nombreArchivo += ".pdf";
        }

        var comentario = string.IsNullOrWhiteSpace(request.Comentario)
            ? null
            : request.Comentario.Trim();
        if (comentario is { Length: > 500 })
        {
            comentario = comentario[..500];
        }

        using var stream = new MemoryStream();
        await request.Archivo.CopyToAsync(stream, ct);

        var idUsuario = GetUserId();
        var metadatos = new Dictionary<string, object?>
        {
            ["tipo"] = "concentrado_viaticos",
            ["folios"] = folios,
            ["nombre"] = request.Nombre,
            ["gerencia"] = request.Gerencia,
            ["fecha"] = request.Fecha,
            ["to"] = request.Correo,
            ["cc"] = request.CorreoCC,
            ["aplicado"] = false
        };
        var metadata = JsonSerializer.Serialize(metadatos);

        var documento = new Documento
        {
            Id = Guid.NewGuid(),
            NombreArchivo = nombreArchivo,
            MimeType = string.IsNullOrWhiteSpace(request.Archivo.ContentType)
                ? "application/pdf"
                : request.Archivo.ContentType,
            TamanoBytes = (int)stream.Length,
            PDFBinario = stream.ToArray(),
            Estatus = 1,
            FechaSubida = DateTime.Now,
            SubidoPorUsuario = string.IsNullOrWhiteSpace(request.Usuario)
                ? idUsuario.ToString()
                : request.Usuario.Trim(),
            ComentariosSubida = comentario,
            Activo = true,
            IpOrigen = HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty,
            EnviadoParaAutorizacion = false,
            NotificacionEnviada = false,
            MetadataJSON = metadata,
            TieneDocumentoLigado = false
        };

        _asokamContext.Documentos.Add(documento);
        await _asokamContext.SaveChangesAsync(ct);

        var avances = new List<MacroConcentradoEnvioItemResult>();
        var commitHecho = false;
        var transaccionTerminada = false;
        await using var transaction = await _context.Database.BeginTransactionAsync(ct);
        try
        {
            foreach (var (orden, accionEnviar) in foliosValidos)
            {
                var resultadoFirma = await _firmasService.FirmarAsync(
                    orden.IdOrden,
                    new FirmarRequest { IdAccion = accionEnviar.IdAccion, Comentario = comentario },
                    idUsuario);

                avances.Add(resultadoFirma.IsError
                    ? new MacroConcentradoEnvioItemResult
                    {
                        Folio = orden.Folio,
                        Exitoso = false,
                        Motivo = resultadoFirma.FirstError.Description
                    }
                    : new MacroConcentradoEnvioItemResult { Folio = orden.Folio, Exitoso = true });
            }

            if (avances.Any(a => !a.Exitoso))
            {
                await transaction.RollbackAsync(ct);
                transaccionTerminada = true;
                DesactivarDocumento(documento, folios, string.Join(" | ", avances.Where(a => !a.Exitoso).Select(a => $"{a.Folio}: {a.Motivo}")));
                await _asokamContext.SaveChangesAsync(ct);

                return Conflict(new ApiResponse<MacroConcentradoEnvioResponse>
                {
                    Success = false,
                    Message = "El envío se canceló: "
                        + string.Join("; ", avances.Where(a => !a.Exitoso).Select(a => $"{a.Folio}: {a.Motivo}")),
                    Data = new MacroConcentradoEnvioResponse
                    {
                        IdDocumento = documento.Id,
                        NombreArchivo = documento.NombreArchivo,
                        TotalFolios = folios.Count,
                        Resultados = avances
                    }
                });
            }

            await transaction.CommitAsync(ct);
            transaccionTerminada = true;
            commitHecho = true;

            metadatos["aplicado"] = true;
            metadatos["fechaAplicado"] = DateTime.Now;
            documento.MetadataJSON = JsonSerializer.Serialize(metadatos);
            await _asokamContext.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            if (!transaccionTerminada)
                await transaction.RollbackAsync(ct);

            if (!commitHecho)
            {
                DesactivarDocumento(documento, folios, "Error inesperado al concentrar las órdenes de compra.");
                await _asokamContext.SaveChangesAsync(ct);
                _logger.LogError(ex, "El documento {IdDocumento} del concentrado de viáticos se desactivó porque el avance de las órdenes falló.", documento.Id);

                return StatusCode(500, new ApiResponse<MacroConcentradoEnvioResponse>
                {
                    Success = false,
                    Message = "Error inesperado al concentrar las órdenes de compra. Reintenta el envío.",
                    Data = null
                });
            }

            _logger.LogWarning(ex, "Las órdenes del concentrado {IdDocumento} se avanzaron, pero no se pudo marcar el documento como aplicado.", documento.Id);
        }

        return Ok(new ApiResponse<MacroConcentradoEnvioResponse>
        {
            Success = true,
            Message = "Concentrado de viáticos enviado a autorización.",
            Data = new MacroConcentradoEnvioResponse
            {
                IdDocumento = documento.Id,
                NombreArchivo = documento.NombreArchivo,
                TotalFolios = folios.Count,
                Resultados = avances
            }
        });
    }

    private static void DesactivarDocumento(Documento documento, List<string> folios, string motivo)
    {
        documento.Activo = false;
        documento.MetadataJSON = JsonSerializer.Serialize(new
        {
            tipo = "concentrado_viaticos",
            folios,
            aplicado = false,
            error = motivo
        });
    }
}
