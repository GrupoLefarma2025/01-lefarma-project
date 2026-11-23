using System.Data;
using System.Text.Json;
using System.Xml.Linq;
using Lefarma.API.Features.Sigma.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace Lefarma.API.Features.Sigma.Controllers;

[ApiController]
[Route("api/v2/documentos")]
[EndpointGroupName("Sigma")]
public sealed class DocumentosV2Controller : ControllerBase
{
    private readonly SigmaDb _db;
    private readonly SigmaIdentity _identidad;
    private readonly SigmaDocumentAccess _acceso;
    private readonly SigmaDocumentStorage _almacen;
    private readonly SigmaDocumentoEmailService _correos;
    private readonly SigmaVisitorTokenService _tickets;
    private readonly ILogger<DocumentosV2Controller> _log;

    public DocumentosV2Controller(
        SigmaDb db,
        SigmaIdentity identidad,
        SigmaDocumentAccess acceso,
        SigmaDocumentStorage almacen,
        SigmaDocumentoEmailService correos,
        SigmaVisitorTokenService tickets,
        ILogger<DocumentosV2Controller> log)
    {
        _db = db;
        _identidad = identidad;
        _acceso = acceso;
        _almacen = almacen;
        _correos = correos;
        _tickets = tickets;
        _log = log;
    }

[HttpPost("acceso-externo")]
    [AllowAnonymous]
    public async Task<IActionResult> AccesoExterno([FromBody] AccesoExternoRequest? solicitud, CancellationToken ct)
    {
        var nombre = solicitud?.NombreCompleto?.Trim();
        var correo = solicitud?.Correo?.Trim();

        if (string.IsNullOrWhiteSpace(nombre))
        {
            return BadRequest(new { success = false, message = "El nombre completo es requerido" });
        }

        if (string.IsNullOrWhiteSpace(correo))
        {
            return BadRequest(new { success = false, message = "El correo es requerido" });
        }

        if (!correo.Contains('@') || correo.StartsWith('@') || correo.EndsWith('@'))
        {
            return BadRequest(new { success = false, message = "Formato de correo inválido" });
        }

        try
        {
            var usuario = await _db.QueryFirstOrDefaultAsync<UsuarioAnonimoRow>(
                "app.sp_CrearUsuarioAnonimo",
                new { NombreCompleto = nombre, Correo = correo },
                CommandType.StoredProcedure,
                ct);

            if (usuario?.IdUsuario is null)
            {
                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { success = false, message = "No fue posible registrar al visitante" });
            }

            var correoFinal = string.IsNullOrWhiteSpace(usuario.Correo) ? correo : usuario.Correo;
            var visitante = new VisitanteDto
            {
                IdUsuario = usuario.IdUsuario,
                NombreCompleto = string.IsNullOrWhiteSpace(usuario.NombreCompleto) ? nombre : usuario.NombreCompleto,
                Correo = correoFinal,
                VisitorToken = _tickets.Issue(usuario.IdUsuario.Value, correoFinal)
            };

            return Ok(new { success = true, data = visitante });
        }
        catch (Exception ex)
        {
            return ErrorInterno(ex, "Error al registrar el acceso externo");
        }
    }

[HttpGet("usuarios-para-flujo")]
    public async Task<IActionResult> UsuariosParaFlujo(CancellationToken ct)
    {
        var actor = _identidad.Resolve();
        if (actor is null)
        {
            return NoAutenticado();
        }

        if (actor.EsAnonimo)
        {
            return SinPermiso();
        }

        try
        {
            var usuarios = await _db.QueryAsync<UsuarioParaFlujoDto>(
                "app.sp_ObtenerUsuariosParaFlujo",
                null,
                CommandType.StoredProcedure,
                ct);

            var data = usuarios.Select(u => new
            {
                usuario = u.Usuario,
                nombreCompleto = u.NombreCompleto,
                tieneFirma = u.TieneFirma,
                identificadorFirma = string.IsNullOrEmpty(u.IdentificadorFirma) ? null : u.IdentificadorFirma,
                pathFirma = u.PathFirma
            });

            return Ok(new { success = true, data });
        }
        catch (Exception ex)
        {
            return ErrorInterno(ex, "No fue posible obtener los usuarios para flujo");
        }
    }

    [HttpPost("crear-con-flujo")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    public async Task<IActionResult> CrearConFlujo(
        IFormFile? archivo,
        [FromForm] string? comentarioInicial,
        [FromForm] string? aprobadores,
        CancellationToken ct)
    {
        var actor = _identidad.Resolve();
        if (actor is null)
        {
            return NoAutenticado();
        }

        if (actor.EsAnonimo || !User.TienePermiso(Permissions.Documentos.Subir))
        {
            return SinPermiso();
        }

        if (archivo is null || archivo.Length == 0)
        {
            return BadRequest(new { success = false, message = "Debe proporcionar un archivo PDF" });
        }

        if (string.IsNullOrWhiteSpace(comentarioInicial))
        {
            return BadRequest(new { success = false, message = "Debe proporcionar el motivo de solicitud" });
        }

        var listaAprobadores = LeerAprobadores(aprobadores, out var errorAprobadores);
        if (errorAprobadores is not null)
        {
            return BadRequest(new { success = false, message = errorAprobadores });
        }

        if (listaAprobadores.Count == 0)
        {
            return BadRequest(new { success = false, message = "Debe seleccionar al menos un aprobador" });
        }

        if (listaAprobadores.Any(a => a.Orden <= 0))
        {
            return BadRequest(new { success = false, message = "La orden de los aprobadores debe ser mayor a 0" });
        }

        if (listaAprobadores.Any(a => string.IsNullOrWhiteSpace(a.Usuario)))
        {
            return BadRequest(new { success = false, message = "Todos los aprobadores deben tener usuario" });
        }

        var errorPdf = _almacen.ValidarPdf(archivo);
        if (errorPdf is not null)
        {
            return BadRequest(new { success = false, message = errorPdf });
        }

        try
        {
            var idDocumento = Guid.NewGuid();
            var guardado = await _almacen.GuardarInicialAsync(idDocumento, archivo, ct);

            await _db.ExecuteAsync(
                "app.sp_CrearDocumentoConFlujo",
                new
                {
                    IdDocumento = idDocumento,
                    NombreArchivo = SigmaDocumentStorage.SanearNombreArchivo(archivo.FileName),
                    RutaArchivoInicial = guardado.RutaAbsoluta,
                    CreadoPor = actor.Usuario,
                    ComentarioInicial = comentarioInicial.Trim(),
                    TamanoBytes = guardado.TamanoBytes,
                    HashSHA256 = guardado.HashSHA256,
                    Aprobadores = ConstruirAprobadores(listaAprobadores)
                },
                CommandType.StoredProcedure,
                ct);

            return Ok(new
            {
                success = true,
                message = "Documento creado exitosamente",
                data = new { idDocumento }
            });
        }
        catch (Exception ex)
        {
            return ErrorInterno(ex, "Error al crear el documento");
        }
    }

    [HttpPost("crear-grupo-con-flujo")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    public async Task<IActionResult> CrearGrupoConFlujo(
        List<IFormFile>? archivos,
        [FromForm] List<string>? tiposDocumento,
        [FromForm] string? comentarioInicial,
        [FromForm] string? aprobadores,
        CancellationToken ct)
    {
        var actor = _identidad.Resolve();
        if (actor is null)
        {
            return NoAutenticado();
        }

        if (actor.EsAnonimo || !User.TienePermiso(Permissions.Documentos.Subir))
        {
            return SinPermiso();
        }

        if (archivos is null || archivos.Count == 0)
        {
            return BadRequest(new { success = false, message = "Debe proporcionar al menos un archivo PDF" });
        }

        if (string.IsNullOrWhiteSpace(comentarioInicial))
        {
            return BadRequest(new { success = false, message = "Debe proporcionar el motivo de solicitud" });
        }

        var tipos = tiposDocumento ?? new List<string>();
        if (tipos.Count != archivos.Count)
        {
            return BadRequest(new { success = false, message = "Debe especificar el tipo para cada archivo" });
        }

        if (!tipos.Any(t => string.Equals(t?.Trim(), "Principal", StringComparison.OrdinalIgnoreCase)))
        {
            return BadRequest(new { success = false, message = "Debe haber al menos un archivo Principal" });
        }

        var listaAprobadores = LeerAprobadores(aprobadores, out var errorAprobadores);
        if (errorAprobadores is not null)
        {
            return BadRequest(new { success = false, message = errorAprobadores });
        }

        if (listaAprobadores.Count == 0)
        {
            return BadRequest(new { success = false, message = "Debe seleccionar al menos un aprobador" });
        }

        if (listaAprobadores.Any(a => a.Orden <= 0))
        {
            return BadRequest(new { success = false, message = "La orden de los aprobadores debe ser mayor a 0" });
        }

        if (listaAprobadores.Any(a => string.IsNullOrWhiteSpace(a.Usuario)))
        {
            return BadRequest(new { success = false, message = "Todos los aprobadores deben tener usuario" });
        }

        foreach (var archivo in archivos)
        {
            var errorPdf = _almacen.ValidarPdf(archivo);
            if (errorPdf is not null)
            {
                return BadRequest(new { success = false, message = errorPdf });
            }
        }

        try
        {
            var idGrupo = Guid.NewGuid();
            var documentos = new List<DocumentoGrupoJson>(archivos.Count);

            for (var i = 0; i < archivos.Count; i++)
            {
                var idDocumento = Guid.NewGuid();
                var guardado = await _almacen.GuardarInicialGrupoAsync(idGrupo, idDocumento, archivos[i], ct);

                documentos.Add(new DocumentoGrupoJson
                {
                    IdDocumento = idDocumento,
                    NombreArchivo = SigmaDocumentStorage.SanearNombreArchivo(archivos[i].FileName),
                    RutaArchivoInicial = guardado.RutaAbsoluta,
                    TipoDocumento = (tipos[i] ?? string.Empty).Trim(),
                    TamanoBytes = guardado.TamanoBytes,
                    HashSHA256 = guardado.HashSHA256
                });
            }

            var json = JsonSerializer.Serialize(documentos);

            await _db.ExecuteAsync(
                "app.sp_CrearGrupoDocumentosConFlujo",
                new
                {
                    IdGrupo = idGrupo,
                    CreadoPor = actor.Usuario,
                    ComentarioInicial = comentarioInicial.Trim(),
                    Documentos = json,
                    Aprobadores = ConstruirAprobadores(listaAprobadores)
                },
                CommandType.StoredProcedure,
                ct);

            return Ok(new
            {
                success = true,
                message = $"{archivos.Count} documento(s) creado(s) exitosamente",
                data = new { idGrupo, cantidadArchivos = archivos.Count }
            });
        }
        catch (Exception ex)
        {
            return ErrorInterno(ex, "Error al crear el grupo de documentos");
        }
    }

[HttpGet("pendientes-firmar")]
    public async Task<IActionResult> PendientesFirmar(CancellationToken ct)
    {
        var actor = _identidad.Resolve();
        if (actor is null)
        {
            return NoAutenticado();
        }

        try
        {
            var data = await _db.QueryAsync<DocumentoPendienteDto>(
                "app.sp_ObtenerDocumentosPendientesFirmar",
                new { Usuario = actor.Usuario },
                CommandType.StoredProcedure,
                ct);

            return Ok(new { success = true, data });
        }
        catch (Exception ex)
        {
            return ErrorInterno(ex, "No fue posible obtener los documentos pendientes de firma");
        }
    }

    [HttpGet("mis-documentos")]
    public async Task<IActionResult> MisDocumentos(
        [FromQuery] DateTime? fechaDesde,
        [FromQuery] DateTime? fechaHasta,
        CancellationToken ct)
    {
        var actor = _identidad.Resolve();
        if (actor is null)
        {
            return NoAutenticado();
        }

        try
        {
            var data = await _db.QueryAsync<MiDocumentoDto>(
                "app.sp_ObtenerMisDocumentos",
                new { Usuario = actor.Usuario, FechaDesde = fechaDesde, FechaHasta = fechaHasta },
                CommandType.StoredProcedure,
                ct);

            return Ok(new { success = true, data });
        }
        catch (Exception ex)
        {
            return ErrorInterno(ex, "No fue posible obtener los documentos del usuario");
        }
    }

    [HttpGet("firmados-por-mi")]
    public async Task<IActionResult> FirmadosPorMi(CancellationToken ct)
    {
        var actor = _identidad.Resolve();
        if (actor is null)
        {
            return NoAutenticado();
        }

        try
        {
            var data = await _db.QueryAsync<DocumentoFirmadoPorMiDto>(
                "app.sp_ObtenerDocumentosFirmadosPorMi",
                new { Usuario = actor.Usuario },
                CommandType.StoredProcedure,
                ct);

            return Ok(new { success = true, data });
        }
        catch (Exception ex)
        {
            return ErrorInterno(ex, "No fue posible obtener los documentos firmados por el usuario");
        }
    }

    [HttpGet("todos")]
    public async Task<IActionResult> Todos(
        [FromQuery] string? filtroUsuario,
        [FromQuery] DateTime? fechaDesde,
        [FromQuery] DateTime? fechaHasta,
        [FromQuery] string? estatusFlujo,
        CancellationToken ct)
    {
        var actor = _identidad.Resolve();
        if (actor is null)
        {
            return NoAutenticado();
        }

        try
        {
            var data = await _db.QueryAsync<TodosLosDocumentosDto>(
                "app.sp_ObtenerTodosLosDocumentos",
                new
                {
                    Usuario = actor.Usuario,
                    FiltroUsuario = filtroUsuario,
                    FechaDesde = fechaDesde,
                    FechaHasta = fechaHasta,
                    EstatusFlujo = estatusFlujo
                },
                CommandType.StoredProcedure,
                ct);

            return Ok(new { success = true, data });
        }
        catch (Exception ex)
        {
            return ErrorInterno(ex, "No fue posible obtener los documentos");
        }
    }

[HttpDelete("{idDocumento:guid}")]
    public async Task<IActionResult> Eliminar(Guid idDocumento, CancellationToken ct)
    {
        var actor = _identidad.Resolve();
        if (actor is null)
        {
            return NoAutenticado();
        }

        if (actor.EsAnonimo || !User.TienePermiso(Permissions.Documentos.Eliminar))
        {
            return SinPermiso();
        }

        try
        {
            var filas = await _db.ExecuteAsync(
                "app.sp_EliminarDocumentoSinFirmas",
                new { IdDocumento = idDocumento, Usuario = actor.Usuario },
                CommandType.StoredProcedure,
                ct);

            return Ok(new
            {
                success = true,
                message = filas > 0 ? "Documento eliminado" : "No se realizó ningún cambio"
            });
        }
        catch (SqlException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
        catch (Exception ex)
        {
            return ErrorInterno(ex, "Error al eliminar el documento");
        }
    }

    [HttpPost("aprobar")]
    public async Task<IActionResult> Aprobar([FromBody] AprobarDocumentoRequest? solicitud, CancellationToken ct)
    {
        var actor = _identidad.Resolve();
        if (actor is null)
        {
            return NoAutenticado();
        }

        if (!actor.EsAnonimo && !User.TienePermiso(SigmaPermissions.Aprobar))
        {
            return SinPermiso();
        }

        if (solicitud is null || solicitud.IdDocumento == Guid.Empty)
        {
            return BadRequest(new { success = false, message = "Debe indicar el documento a aprobar" });
        }

        try
        {
            var rutaInicial = await _db.ExecuteScalarAsync<string>(
                "SELECT RutaArchivoInicial FROM app.DocumentosConFlujo WHERE IdDocumento = @IdDocumento",
                new { IdDocumento = solicitud.IdDocumento },
                CommandType.Text,
                ct);

            var rutaFirmado = _almacen.PrepararArchivoFirmado(rutaInicial) ?? _almacen.RutaFirmado(solicitud.IdDocumento);

            var siguiente = await _db.QueryFirstOrDefaultAsync<SiguienteUsuarioDto>(
                "app.sp_AprobarDocumento",
                new
                {
                    IdDocumento = solicitud.IdDocumento,
                    Usuario = actor.Usuario,
                    Comentarios = solicitud.Comentarios,
                    RutaArchivoFirmado = rutaFirmado
                },
                CommandType.StoredProcedure,
                ct);

            return Ok(new
            {
                success = true,
                message = "Documento aprobado exitosamente",
                data = new
                {
                    siguienteUsuario = siguiente?.SiguienteUsuario,
                    flujoCompletado = siguiente is null
                }
            });
        }
        catch (SqlException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
        catch (Exception ex)
        {
            return ErrorInterno(ex, "Error al aprobar el documento");
        }
    }

    [HttpPost("rechazar")]
    public async Task<IActionResult> Rechazar([FromBody] RechazarDocumentoRequest? solicitud, CancellationToken ct)
    {
        var actor = _identidad.Resolve();
        if (actor is null)
        {
            return NoAutenticado();
        }

        if (!actor.EsAnonimo && !User.TienePermiso(SigmaPermissions.Aprobar))
        {
            return SinPermiso();
        }

        if (solicitud is null || solicitud.IdDocumento == Guid.Empty)
        {
            return BadRequest(new { success = false, message = "Debe indicar el documento a rechazar" });
        }

        if (string.IsNullOrWhiteSpace(solicitud.Motivo))
        {
            return BadRequest(new { success = false, message = "Debe indicar el motivo del rechazo" });
        }

        try
        {
            await _db.ExecuteAsync(
                "app.sp_RechazarDocumento",
                new
                {
                    IdDocumento = solicitud.IdDocumento,
                    Usuario = actor.Usuario,
                    Motivo = solicitud.Motivo
                },
                CommandType.StoredProcedure,
                ct);

            return Ok(new { success = true, message = "Documento rechazado" });
        }
        catch (SqlException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
        catch (Exception ex)
        {
            return ErrorInterno(ex, "Error al rechazar el documento");
        }
    }

    [HttpGet("{idDocumento:guid}/flujo")]
    public async Task<IActionResult> Flujo(Guid idDocumento, CancellationToken ct)
    {
        var actor = _identidad.Resolve();
        if (actor is null)
        {
            return NoAutenticado();
        }

        if (!await _acceso.PuedeAccederAsync(idDocumento, actor, ct))
        {
            return SinPermiso();
        }

        try
        {
            var (documentos, pasos) = await _db.QueryMultipleAsync<DocumentoInfoDto, PasoFlujoDto>(
                "app.sp_ObtenerFlujoDocumento",
                new { IdDocumento = idDocumento },
                CommandType.StoredProcedure,
                ct);

            var documento = documentos.FirstOrDefault();
            if (documento is null)
            {
                return NotFound(new { success = false, message = "Documento no encontrado" });
            }

            var pasosProyectados = pasos.Select(p => new
            {
                orden = p.Orden,
                usuarioAprobador = p.UsuarioAprobador,
                estatus = p.Estatus,
                fechaFirma = p.FechaAccion,
                motivoRechazo = p.Comentarios,
                identificadorFirma = p.IdentificadorFirma,
                nombreUsuario = p.NombreUsuario
            });

            return Ok(new { success = true, data = new { documento, pasos = pasosProyectados } });
        }
        catch (SqlException ex)
        {
            return NotFound(new { success = false, message = ex.Message });
        }
        catch (Exception ex)
        {
            return ErrorInterno(ex, "Error al obtener el flujo del documento");
        }
    }

    [HttpGet("{idDocumento:guid}/historial-comentarios")]
    public async Task<IActionResult> HistorialComentarios(Guid idDocumento, CancellationToken ct)
    {
        var actor = _identidad.Resolve();
        if (actor is null)
        {
            return NoAutenticado();
        }

        if (!await _acceso.PuedeAccederAsync(idDocumento, actor, ct))
        {
            return SinPermiso();
        }

        try
        {
            var data = await _db.QueryAsync<ComentarioHistorialDto>(
                "app.sp_ObtenerHistorialComentarios",
                new { IdDocumento = idDocumento },
                CommandType.StoredProcedure,
                ct);

            return Ok(new { success = true, data });
        }
        catch (SqlException ex)
        {
            return NotFound(new { success = false, message = ex.Message });
        }
        catch (Exception ex)
        {
            return ErrorInterno(ex, "Error al obtener el historial del documento");
        }
    }

    [HttpPost("{idDocumento:guid}/reenviar-notificacion")]
    public async Task<IActionResult> ReenviarNotificacion(Guid idDocumento, CancellationToken ct)
    {
        var actor = _identidad.Resolve();
        if (actor is null)
        {
            return NoAutenticado();
        }

        try
        {
            var creador = await _db.ExecuteScalarAsync<string>(
                "SELECT CreadoPor FROM app.DocumentosConFlujo WHERE IdDocumento = @IdDocumento",
                new { IdDocumento = idDocumento },
                CommandType.Text,
                ct);

            if (string.IsNullOrWhiteSpace(creador))
            {
                return NotFound(new { success = false, message = "Documento no encontrado" });
            }

            if (!string.Equals(creador, actor.Usuario, StringComparison.OrdinalIgnoreCase))
            {
                return SinPermiso();
            }

            var paso = await _db.QueryFirstOrDefaultAsync<PasoNotificacionDto>(
                "app.sp_ObtenerPasosParaNotificar",
                new { IdDocumento = idDocumento },
                CommandType.StoredProcedure,
                ct);

            if (paso is null)
            {
                return BadRequest(new { success = false, message = "No hay pasos pendientes" });
            }

            var envio = await _correos.EnviarRecordatorioAsync(idDocumento, paso, ct);
            if (!envio.Success)
            {
                return StatusCode(StatusCodes.Status502BadGateway,
                    new { success = false, message = envio.Mensaje, errores = envio.Errores });
            }

            await _db.ExecuteAsync(
                "app.sp_ActualizarNotificacionEnviada",
                new { IdPaso = paso.IdPaso },
                CommandType.StoredProcedure,
                ct);

            return Ok(new { success = true, message = "Notificación enviada exitosamente" });
        }
        catch (SqlException ex)
        {
            return NotFound(new { success = false, message = ex.Message });
        }
        catch (Exception ex)
        {
            return ErrorInterno(ex, "Error al reenviar la notificación");
        }
    }

    [HttpGet("{idDocumento:guid}/descargar")]
    public async Task<IActionResult> Descargar(
        Guid idDocumento,
        [FromQuery] bool firmado = true,
        CancellationToken ct = default)
    {
        var actor = _identidad.Resolve();
        if (actor is null)
        {
            return NoAutenticado();
        }

        if (!await _acceso.PuedeAccederAsync(idDocumento, actor, ct))
        {
            return SinPermiso();
        }

        try
        {
            var fila = await _db.QueryFirstOrDefaultAsync<DocumentoRutaRow>(
                "SELECT RutaArchivoInicial, RutaArchivoFirmado, NombreArchivo FROM app.DocumentosConFlujo WHERE IdDocumento = @IdDocumento",
                new { IdDocumento = idDocumento },
                CommandType.Text,
                ct);

            if (fila is null)
            {
                return NotFound(new { success = false, message = "Documento no encontrado" });
            }

            var ruta = firmado ? fila.RutaArchivoFirmado : null;
            if (string.IsNullOrWhiteSpace(ruta) || !System.IO.File.Exists(ruta))
            {
                ruta = fila.RutaArchivoInicial;
            }

            if (string.IsNullOrWhiteSpace(ruta) || !System.IO.File.Exists(ruta))
            {
                return NotFound(new { success = false, message = "Documento no encontrado" });
            }

            var bytes = await System.IO.File.ReadAllBytesAsync(ruta, ct);
            var nombre = string.IsNullOrWhiteSpace(fila.NombreArchivo) ? $"{idDocumento}.pdf" : fila.NombreArchivo;

            return File(bytes, "application/pdf", nombre);
        }
        catch (Exception ex)
        {
            return ErrorInterno(ex, "Error al descargar el documento");
        }
    }

private static List<AprobadorDto> LeerAprobadores(string? json, out string? error)
    {
        error = null;

        if (string.IsNullOrWhiteSpace(json))
        {
            return new List<AprobadorDto>();
        }

        try
        {
            var opciones = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            return JsonSerializer.Deserialize<List<AprobadorDto>>(json, opciones) ?? new List<AprobadorDto>();
        }
        catch (JsonException)
        {
            error = "La lista de aprobadores no tiene un formato válido";
            return new List<AprobadorDto>();
        }
    }

    private static string ConstruirAprobadores(IEnumerable<AprobadorDto> aprobadores) =>
        new XElement(
            "Pasos",
            aprobadores
                .OrderBy(a => a.Orden)
                .Select(a => new XElement(
                    "Paso",
                    new XAttribute("Orden", a.Orden),
                    new XAttribute("Usuario", a.Usuario),
                    new XAttribute("Identificador", a.Identificador ?? string.Empty))))
        .ToString();

    private IActionResult NoAutenticado() =>
        Unauthorized(new { success = false, message = "Usuario no autenticado" });

    private IActionResult SinPermiso() =>
        StatusCode(StatusCodes.Status403Forbidden, new { success = false, message = "No tiene permiso para realizar esta acción" });

    private ObjectResult ErrorInterno(Exception ex, string mensaje)
    {
        _log.LogError(ex, "{Mensaje}", mensaje);
        return StatusCode(StatusCodes.Status500InternalServerError, new { success = false, message = mensaje });
    }
}
