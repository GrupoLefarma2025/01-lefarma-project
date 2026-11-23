using System.Runtime.CompilerServices;
using System.Security.Claims;
using System.Text.Json;
using Lefarma.API.Domain.Entities.Asokam;
using Lefarma.API.Features.Viaticos.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Authorization;
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
    private readonly ILogger<MacroConcentradoController> _logger;

    public MacroConcentradoController(
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        ILogger<MacroConcentradoController> logger)
    {
        _context = context;
        _asokamContext = asokamContext;
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
                .Where(d => d.MetadataJSON != null &&
                            d.MetadataJSON.Contains("concentrado_viaticos"))
                .Select(d => d.MetadataJSON!)
                .ToListAsync(ct);

            foreach (var metadata in metadatos)
            {
                try
                {
                    using var json = JsonDocument.Parse(metadata);
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
                    "COALESCE(TRY_CONVERT(date, LEFT(CONVERT(varchar(50), fechInicio), " +
                    "CHARINDEX(' AL ', CONVERT(varchar(50), fechInicio) + ' AL ') - 1), 103), " +
                    "TRY_CONVERT(date, CONVERT(varchar(50), fechInicio), 23), " +
                    "TRY_CONVERT(date, CONVERT(varchar(50), fechInicio))) AS fechInicio, " +
                    "COALESCE(TRY_CONVERT(date, NULLIF(CONVERT(varchar(50), fechaFin), ''), 103), " +
                    "TRY_CONVERT(date, NULLIF(CONVERT(varchar(50), fechaFin), ''), 23), " +
                    "TRY_CONVERT(date, NULLIF(CONVERT(varchar(50), fechaFin), ''))) AS fechaFin, " +
                    "origen, destino, costoAutobus, costoAvion, costoGasolina, costoCasetas, " +
                    "costoHospedaje, costoComida, costoTaxi, diasHospedaje, numeroComidas " +
                    "FROM dbo.infoMacroViaticos m " +
                    "WHERE NOT EXISTS (" +
                    "SELECT 1 FROM operaciones.ordenes_compra oc " +
                    "INNER JOIN config.workflow_estados e ON e.id_estado = oc.id_estado " +
                    "WHERE oc.folio = m.folio " +
                    "AND UPPER(e.nombre) IN ('CANCELADA', 'RECHAZADA')) " +
                    "ORDER BY 4 DESC, 2, 3, 5"))
                .ToListAsync(ct);

            var foliosEnviados = await ObtenerFoliosEnviadosAsync(ct);
            var visibles = filas
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
        var metadata = JsonSerializer.Serialize(new
        {
            tipo = "concentrado_viaticos",
            folios,
            nombre = request.Nombre,
            gerencia = request.Gerencia,
            fecha = request.Fecha,
            to = request.Correo,
            cc = request.CorreoCC
        });

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

        return Ok(new ApiResponse<MacroConcentradoEnvioResponse>
        {
            Success = true,
            Message = "Concentrado de viáticos enviado a autorización.",
            Data = new MacroConcentradoEnvioResponse
            {
                IdDocumento = documento.Id,
                NombreArchivo = documento.NombreArchivo,
                TotalFolios = folios.Count
            }
        });
    }
}
