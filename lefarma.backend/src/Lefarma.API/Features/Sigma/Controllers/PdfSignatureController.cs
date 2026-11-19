using System.Data;
using System.Security.Cryptography;
using System.Text.Json;
using Lefarma.API.Features.Sigma.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace Lefarma.API.Features.Sigma.Controllers;

/// <summary>
/// Puerto de <c>PdfSignatureModule</c> (core-manager, <c>/asokam/pdf-signature</c>):
/// lecturas, escrituras y verificación de los PDFs que consume la bandeja de SIGMA.
/// Las escrituras ejecutan el mismo script Python de estampado del proyecto original,
/// pero conectado a la base configurada en <c>AsokamConnection</c> (AsokamDev en
/// desarrollo, Asokam en producción), sin depender del sitio externo <c>sisco2-1</c>.
/// </summary>
[ApiController]
[Route("api/sigma/pdf-signature")]
[Authorize]
[EndpointGroupName("Sigma")]
public sealed class PdfSignatureController : ControllerBase
{
    private const long LimiteSubidaBytes = 52_428_800;

    private readonly SigmaDb _db;
    private readonly SigmaPdfSignatureRunner _firma;
    private readonly ILogger<PdfSignatureController> _log;

    public PdfSignatureController(
        SigmaDb db,
        SigmaPdfSignatureRunner firma,
        ILogger<PdfSignatureController> log)
    {
        _db = db;
        _firma = firma;
        _log = log;
    }

    /// <summary>Listado de documentos con los mismos filtros que el servicio original.</summary>
    [HttpGet("listar-documento")]
    public async Task<IActionResult> Listar(
        [FromQuery] bool soloActivos = true,
        [FromQuery] int? estatus = null,
        [FromQuery] string? nombreDocumento = null,
        [FromQuery] string? subidoPorUsuario = null,
        [FromQuery] DateTime? fechaSubidaDesde = null,
        [FromQuery] DateTime? fechaSubidaHasta = null,
        [FromQuery] string? ordenPor = "FechaSubida DESC",
        CancellationToken ct = default)
    {
        try
        {
            var filas = await _db.QueryAsync<PdfSignatureDocumentoRow>(
                "app.sp_ObtenerDocumentos",
                new
                {
                    SoloActivos = soloActivos ? 1 : 0,
                    Estatus = estatus,
                    NombreDocumento = nombreDocumento,
                    SubidoPorUsuario = subidoPorUsuario,
                    FechaSubidaDesde = fechaSubidaDesde,
                    FechaSubidaHasta = fechaSubidaHasta,
                    OrdenPor = string.IsNullOrWhiteSpace(ordenPor) ? "FechaSubida DESC" : ordenPor
                },
                CommandType.StoredProcedure,
                ct);

            var data = filas
                .Select(f => new PdfSignatureDocumentoDto
                {
                    Id = f.Id,
                    NombreArchivo = f.NombreArchivo,
                    MimeType = f.MimeType,
                    TamanoBytes = f.TamanoBytes,
                    Estatus = f.Estatus,
                    FechaSubida = f.FechaSubida,
                    SubidoPorUsuario = f.SubidoPorUsuario,
                    FechaAutorizacion = f.FechaAutorizacion,
                    AutorizadoPorUsuario = f.AutorizadoPorUsuario,
                    FechaRechazo = f.FechaRechazo,
                    RechazadoPorUsuario = f.RechazadoPorUsuario,
                    ComentariosSubida = f.ComentariosSubida,
                    ComentariosDecision = f.ComentariosDecision,
                    Activo = f.Activo,
                    IpOrigen = f.IpOrigen,
                    TieneDocumentoLigado = f.TieneDocumentoLigado
                })
                .ToList();

            return Ok(new
            {
                success = true,
                message = "PDFs listados correctamente",
                data,
                totalCount = data.Count
            });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "No fue posible listar los documentos de Asokam");
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new { success = false, error = "No fue posible listar los documentos." });
        }
    }

    /// <summary>
    /// Devuelve el binario del documento (autorizado si existe). <paramref name="mostrarDocumentoSoporte"/>
    /// sirve el anexo de soporte cuando el documento lo tiene ligado.
    /// </summary>
    [HttpGet("pdf/{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> Pdf(
        Guid id,
        [FromQuery] bool mostrarDocumentoSoporte = false,
        [FromQuery] bool descargar = true,
        CancellationToken ct = default)
    {
        try
        {
            var documento = await _db.QueryFirstOrDefaultAsync<PdfSignatureDocumentoDetalleRow>(
                "app.sp_ObtenerDocumentoDetalle",
                new { IdDocumento = id, MostrarDocumentoSoporte = mostrarDocumentoSoporte ? 1 : 0 },
                CommandType.StoredProcedure,
                ct);

            if (documento is null)
            {
                return NotFound(new { success = false, message = "Documento no encontrado" });
            }

            var bytes = documento.PDFBinarioAutorizado is { Length: > 0 }
                ? documento.PDFBinarioAutorizado
                : documento.PDFBinario;

            if (bytes is null || bytes.Length == 0)
            {
                return NotFound(new { success = false, message = "PDF no disponible" });
            }

            Response.Headers.ContentDisposition =
                $"{(descargar ? "attachment" : "inline")}; filename=\"{documento.NombreArchivo ?? $"documento_{id}.pdf"}\"";

            return File(bytes, "application/pdf");
        }
        catch (SqlException ex)
        {
            _log.LogWarning(ex, "El documento {IdDocumento} no existe o fue eliminado", id);
            return NotFound(new { success = false, message = "Documento no encontrado" });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "No fue posible obtener el PDF {IdDocumento}", id);
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new { success = false, error = "No fue posible obtener el documento." });
        }
    }

    /// <summary>
    /// Sube un PDF al repositorio de Asokam (sp_GestionarDocumento, operación 1) y
    /// comprueba con el script de firma que contenga el texto que se sustituye.
    /// </summary>
    [HttpPost("subir-documento")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(LimiteSubidaBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = LimiteSubidaBytes)]
    public async Task<IActionResult> Subir(
        [FromForm] string? nombre,
        [FromForm] string? usuario,
        [FromForm] string? comentario,
        [FromForm] string? correo,
        [FromForm] string? correoCC,
        IFormFile? archivo,
        [FromForm] bool tieneDocumentoSoporte = false,
        IFormFile? archivoSoporte = null,
        CancellationToken ct = default)
    {
        if (archivo is null || archivo.Length == 0)
        {
            return BadRequest(new { success = false, message = "El archivo PDF es requerido." });
        }

        if (string.IsNullOrWhiteSpace(usuario))
        {
            return BadRequest(new { success = false, message = "El usuario que sube el documento es requerido." });
        }

        try
        {
            var nombreSolicitado = string.IsNullOrWhiteSpace(nombre) ? archivo.FileName : nombre.Trim();
            var nombreArchivo = Path.GetFileName(nombreSolicitado);
            if (!nombreArchivo.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            {
                nombreArchivo += ".pdf";
            }

            var bytes = await LeerBytesAsync(archivo, ct);
            var bytesSoporte = tieneDocumentoSoporte && archivoSoporte is { Length: > 0 }
                ? await LeerBytesAsync(archivoSoporte, ct)
                : null;

            var metadata = new Dictionary<string, string>();
            if (!string.IsNullOrWhiteSpace(correo))
            {
                metadata["to"] = correo.Trim();
            }

            if (!string.IsNullOrWhiteSpace(correoCC))
            {
                metadata["cc"] = correoCC.Trim();
            }

            var resultado = (await _db.QueryAsync<GestionDocumentoResultado>(
                "app.sp_GestionarDocumento",
                new
                {
                    Operacion = 1,
                    NombreArchivo = nombreArchivo,
                    MimeType = string.IsNullOrWhiteSpace(archivo.ContentType) ? "application/pdf" : archivo.ContentType,
                    TamanoBytes = archivo.Length,
                    PDFBinario = bytes,
                    SubidoPorUsuario = usuario.Trim(),
                    ComentariosSubida = comentario,
                    IpOrigen = IpOrigen(),
                    TieneDocumentoLigado = tieneDocumentoSoporte,
                    PDFBinarioAdicional = bytesSoporte,
                    MetadataJSON = metadata.Count > 0 ? JsonSerializer.Serialize(metadata) : null
                },
                CommandType.StoredProcedure,
                ct)).FirstOrDefault();

            if (resultado is null || resultado.Codigo != 0 || resultado.IdDocumento is null || resultado.IdDocumento == Guid.Empty)
            {
                return BadRequest(new
                {
                    success = false,
                    message = resultado?.Mensaje ?? "No fue posible registrar el documento en Asokam."
                });
            }

            var idDocumento = resultado.IdDocumento.Value;
            var firma = await _firma.EjecutarAsync(idDocumento, soloEscanear: true, ct);
            if (firma.PalabraClaveAusente)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "El documento no contiene la palabra clave requerida para firma.",
                    errorCode = "KEYWORD_NOT_FOUND",
                    data = new { idDocumento }
                });
            }

            return Ok(new
            {
                success = true,
                message = "PDF subido correctamente",
                data = new
                {
                    idDocumento,
                    archivo = nombreArchivo,
                    usuario = usuario.Trim(),
                    comentario,
                    tamano = bytes.Length,
                    estado = "Pendiente"
                }
            });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "No fue posible subir el PDF a Asokam");
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new { success = false, message = "No fue posible subir el documento.", error = ex.Message });
        }
    }

    /// <summary>
    /// Autoriza un PDF: el script de firma lo estampa y actualiza el binario autorizado;
    /// después se registra el usuario, el motivo y el SHA-256 (sp_GestionarDocumento, operación 2).
    /// </summary>
    [HttpPost("autorizar-documento")]
    public async Task<IActionResult> Autorizar(
        [FromBody] AutorizarRechazarPdfRequest peticion,
        CancellationToken ct)
    {
        if (peticion.IdDocumento == Guid.Empty)
        {
            return BadRequest(new { success = false, message = "El id del documento es requerido." });
        }

        var usuario = string.IsNullOrWhiteSpace(peticion.Usuario) ? User.Identity?.Name : peticion.Usuario.Trim();
        if (string.IsNullOrWhiteSpace(usuario))
        {
            return BadRequest(new { success = false, message = "El usuario que autoriza es requerido." });
        }

        try
        {
            var firma = await _firma.EjecutarAsync(peticion.IdDocumento, soloEscanear: false, ct);
            if (firma.PalabraClaveAusente)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "El documento no contiene la palabra clave requerida para firma.",
                    errorCode = "KEYWORD_NOT_FOUND",
                    data = new { idDocumento = peticion.IdDocumento }
                });
            }

            var binario = await _db.ExecuteScalarAsync<byte[]>(
                "SELECT PDFBinarioAutorizado FROM app.Documentos WHERE Id = @Id",
                new { Id = peticion.IdDocumento },
                CommandType.Text,
                ct);

            if (binario is null || binario.Length == 0)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "El binario autorizado no está disponible para generar el hash."
                });
            }

            var hash = CalcularSha256(binario);
            var resultado = (await _db.QueryAsync<GestionDocumentoResultado>(
                "app.sp_GestionarDocumento",
                new
                {
                    Operacion = 2,
                    IdDocumento = peticion.IdDocumento,
                    AutorizadoPorUsuario = usuario,
                    ComentariosDecision = peticion.Motivo,
                    IpOrigen = IpOrigen(),
                    HashSHA256Autorizado = hash
                },
                CommandType.StoredProcedure,
                ct)).FirstOrDefault();

            if (resultado is null || resultado.Codigo != 0)
            {
                return BadRequest(new
                {
                    success = false,
                    message = resultado?.Mensaje ?? "No fue posible autorizar el documento."
                });
            }

            return Ok(new
            {
                success = true,
                message = "PDF autorizado correctamente",
                data = new { idDocumento = peticion.IdDocumento, usuario, estado = "Autorizado", hash }
            });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "No fue posible autorizar el documento {IdDocumento}", peticion.IdDocumento);
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new { success = false, message = "No fue posible autorizar el documento.", error = ex.Message });
        }
    }

    /// <summary>Rechaza un documento (sp_GestionarDocumento, operación 3).</summary>
    [HttpPost("rechazar-documento")]
    public async Task<IActionResult> Rechazar(
        [FromBody] AutorizarRechazarPdfRequest peticion,
        CancellationToken ct)
    {
        if (peticion.IdDocumento == Guid.Empty)
        {
            return BadRequest(new { success = false, message = "El id del documento es requerido." });
        }

        var usuario = string.IsNullOrWhiteSpace(peticion.Usuario) ? User.Identity?.Name : peticion.Usuario.Trim();
        if (string.IsNullOrWhiteSpace(usuario))
        {
            return BadRequest(new { success = false, message = "El usuario que rechaza es requerido." });
        }

        try
        {
            var resultado = (await _db.QueryAsync<GestionDocumentoResultado>(
                "app.sp_GestionarDocumento",
                new
                {
                    Operacion = 3,
                    IdDocumento = peticion.IdDocumento,
                    RechazadoPorUsuario = usuario,
                    ComentariosDecision = peticion.Motivo,
                    IpOrigen = IpOrigen()
                },
                CommandType.StoredProcedure,
                ct)).FirstOrDefault();

            if (resultado is null || resultado.Codigo != 0)
            {
                return BadRequest(new
                {
                    success = false,
                    message = resultado?.Mensaje ?? "No fue posible rechazar el documento."
                });
            }

            return Ok(new
            {
                success = true,
                message = "PDF rechazado correctamente",
                data = new { idDocumento = peticion.IdDocumento, usuario, estado = "Rechazado" }
            });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "No fue posible rechazar el documento {IdDocumento}", peticion.IdDocumento);
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new { success = false, message = "No fue posible rechazar el documento.", error = ex.Message });
        }
    }

    /// <summary>Eliminación lógica: marca el documento como inactivo.</summary>
    [HttpDelete("eliminar-documento/{id:guid}")]
    public async Task<IActionResult> Eliminar(Guid id, CancellationToken ct)
    {
        try
        {
            var afectadas = await _db.ExecuteAsync(
                "UPDATE app.Documentos SET Activo = 0 WHERE Id = @Id",
                new { Id = id },
                CommandType.Text,
                ct);

            return Ok(new
            {
                success = true,
                message = afectadas > 0
                    ? "Documento eliminado (soft delete) correctamente"
                    : "No se realizó ningún cambio",
                data = new { id, eliminado = afectadas > 0 }
            });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "No fue posible eliminar el documento {IdDocumento}", id);
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new { success = false, message = "No fue posible eliminar el documento.", error = ex.Message });
        }
    }

    /// <summary>
    /// Verifica que un PDF coincide con el SHA-256 registrado al autorizarlo.
    /// Es el endpoint público al que apuntan los enlaces de validación.
    /// </summary>
    [HttpPost("verificar-documento/{id:guid}")]
    [AllowAnonymous]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(LimiteSubidaBytes)]
    public async Task<IActionResult> Verificar(Guid id, IFormFile? archivo, CancellationToken ct = default)
    {
        if (archivo is null || archivo.Length == 0)
        {
            return BadRequest(new { success = false, message = "No se recibió ningún archivo para verificación." });
        }

        try
        {
            var esperado = await _db.ExecuteScalarAsync<string>(
                "SELECT HashSHA256Autorizado FROM app.Documentos WHERE Id = @Id",
                new { Id = id },
                CommandType.Text,
                ct);

            if (string.IsNullOrWhiteSpace(esperado))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "El documento no ha sido autorizado o no existe."
                });
            }

            var calculado = CalcularSha256(await LeerBytesAsync(archivo, ct));
            var coincide = string.Equals(calculado, esperado.Trim(), StringComparison.OrdinalIgnoreCase);

            if (coincide)
            {
                return Ok(new
                {
                    success = true,
                    message = "El documento coincide con la firma autorizada.",
                    data = new { id, estado = "Verificado", coincidencia = true, hash = esperado }
                });
            }

            return BadRequest(new
            {
                success = false,
                message = "Falla de integridad: el hash del archivo no coincide con el autorizado.",
                data = new { id, estado = "Fallido", coincidencia = false, hashCalculado = calculado, hashEsperado = esperado }
            });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "No fue posible verificar el documento {IdDocumento}", id);
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new { success = false, message = "No fue posible verificar el documento.", error = ex.Message });
        }
    }

    private string? IpOrigen() => HttpContext.Connection.RemoteIpAddress?.ToString();

    private static async Task<byte[]> LeerBytesAsync(IFormFile archivo, CancellationToken ct)
    {
        await using var memoria = new MemoryStream();
        await archivo.CopyToAsync(memoria, ct);
        return memoria.ToArray();
    }

    private static string CalcularSha256(byte[] bytes) =>
        Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
}
