namespace Lefarma.API.Features.Sigma.DTOs;

// DTOs copiados del módulo de documentos de SIGMA (DocumentosModuleV2.cs). Se conservan
// los nombres y formas exactas; la serialización de la API los expone en camelCase.

public sealed record UsuarioParaFlujoDto
{
    public string Usuario { get; init; } = "";
    public string NombreCompleto { get; init; } = "";
    public bool TieneFirma { get; init; }
    public string IdentificadorFirma { get; init; } = "";
    public string? PathFirma { get; init; }
}

public sealed record AprobadorDto
{
    public string Usuario { get; init; } = "";
    public string? Identificador { get; init; }
    public int Orden { get; init; }
}

public sealed record DocumentoPendienteDto
{
    public Guid IdGrupo { get; init; }
    public Guid IdDocumento { get; init; }
    public string NombreArchivo { get; init; } = "";
    public DateTime FechaCreacion { get; init; }
    public string EstatusFlujo { get; init; } = "";
    public string ComentarioInicial { get; init; } = "";
    public string CreadoPor { get; init; } = "";
    public string NombreCreadoPor { get; init; } = "";
    public DateTime? FechaUltimaInteraccion { get; init; }
    public int Orden { get; init; }
    public string? IdentificadorFirma { get; init; }
    public DateTime? FechaUltimaNotificacion { get; init; }
    public int TotalPasos { get; init; }
    public int PasosCompletados { get; init; }
    public int PasoActual { get; init; }
    public string? UsuarioActual { get; init; }
    public string? NombreUsuarioActual { get; init; }
    public string ColorAlerta { get; init; } = "normal";
    public bool EsMiTurno { get; init; }
    public string? Documentos { get; init; }
}

public sealed record MiDocumentoDto
{
    public Guid IdGrupo { get; init; }
    public Guid IdDocumento { get; init; }
    public string NombreArchivo { get; init; } = "";
    public DateTime FechaCreacion { get; init; }
    public string EstatusFlujo { get; init; } = "";
    public string ComentarioInicial { get; init; } = "";
    public string CreadoPor { get; init; } = "";
    public string NombreCreadoPor { get; init; } = "";
    public DateTime? FechaCompletado { get; init; }
    public DateTime? FechaUltimaInteraccion { get; init; }
    public int TotalPasos { get; init; }
    public int PasosCompletados { get; init; }
    public string? PasoActualUsuario { get; init; }
    public string? NombrePasoActual { get; init; }
    public int? DiasSinFirmar { get; init; }
    public string? AlertaColor { get; init; }
    public string? Documentos { get; init; }
}

public sealed record DocumentoFirmadoPorMiDto
{
    public Guid IdGrupo { get; init; }
    public Guid IdDocumento { get; init; }
    public string NombreArchivo { get; init; } = "";
    public DateTime FechaCreacion { get; init; }
    public string EstatusFlujo { get; init; } = "";
    public string ComentarioInicial { get; init; } = "";
    public string CreadoPor { get; init; } = "";
    public string NombreCreadoPor { get; init; } = "";
    public DateTime? FechaUltimaInteraccion { get; init; }
    public DateTime? MiFechaFirma { get; init; }
    public string? MisComentarios { get; init; }
    public string? PasoActualUsuario { get; init; }
    public string? NombrePasoActual { get; init; }
    public int TotalPasos { get; init; }
    public int PasosCompletados { get; init; }
    public int PasoActual { get; init; }
    public string? Documentos { get; init; }
}

public sealed record TodosLosDocumentosDto
{
    public Guid IdGrupo { get; init; }
    public Guid IdDocumento { get; init; }
    public string NombreArchivo { get; init; } = "";
    public DateTime FechaCreacion { get; init; }
    public string EstatusFlujo { get; init; } = "";
    public string ComentarioInicial { get; init; } = "";
    public string CreadoPor { get; init; } = "";
    public string NombreCreadoPor { get; init; } = "";
    public DateTime? FechaCompletado { get; init; }
    public DateTime? FechaUltimaAccion { get; init; }
    public DateTime? FechaUltimaInteraccion { get; init; }
    public int TotalPasos { get; init; }
    public int PasosCompletados { get; init; }
    public string? PasoActualUsuario { get; init; }
    public string? NombrePasoActual { get; init; }
    public string? Documentos { get; init; }
}

public sealed record AprobarDocumentoRequest
{
    public Guid IdDocumento { get; init; }
    public string? Comentarios { get; init; }
}

public sealed record RechazarDocumentoRequest
{
    public Guid IdDocumento { get; init; }
    public string Motivo { get; init; } = "";
}

public sealed record SiguienteUsuarioDto
{
    public string? SiguienteUsuario { get; init; }
    public int SiguienteOrden { get; init; }
}

public sealed record DocumentoInfoDto
{
    public Guid IdGrupo { get; init; }
    public Guid IdDocumento { get; init; }
    public string NombreArchivo { get; init; } = "";
    public DateTime FechaCreacion { get; init; }
    public string EstatusFlujo { get; init; } = "";
    public string ComentarioInicial { get; init; } = "";
    public string CreadoPor { get; init; } = "";
    public DateTime? FechaCompletado { get; init; }
    public string? Documentos { get; init; }
}

public sealed record PasoFlujoDto
{
    public Guid IdPaso { get; init; }
    public int Orden { get; init; }
    public string UsuarioAprobador { get; init; } = "";
    public string Estatus { get; init; } = "";
    public DateTime FechaAsignacion { get; init; }
    public DateTime? FechaAccion { get; init; }
    public string? Comentarios { get; init; }
    public string? IdentificadorFirma { get; init; }
    public string? NombreUsuario { get; init; }
}

public sealed record PasoNotificacionDto
{
    public Guid IdPaso { get; init; }
    public string UsuarioAprobador { get; init; } = "";
    public int Orden { get; init; }
    public bool NotificacionEnviada { get; init; }
    public string NombreArchivo { get; init; } = "";
    public string ComentarioInicial { get; init; } = "";
    public string CreadoPor { get; init; } = "";
    public string CorreoUsuario { get; init; } = "";
    public string NombreUsuario { get; init; } = "";
}

public sealed record ComentarioHistorialDto
{
    public DateTime Fecha { get; init; }
    public string Usuario { get; init; } = "";
    public string Estatus { get; init; } = "";
    public string Comentario { get; init; } = "";
}

/// <summary>Fila usada al descargar un documento (rutas físicas y nombre original).</summary>
internal sealed record DocumentoRutaRow
{
    public string? RutaArchivoInicial { get; init; }
    public string? RutaArchivoFirmado { get; init; }
    public string? NombreArchivo { get; init; }
}

/// <summary>Documento recibido en el JSON de sp_CrearGrupoDocumentosConFlujo.</summary>
public sealed record DocumentoGrupoJson
{
    public Guid IdDocumento { get; init; }
    public string NombreArchivo { get; init; } = "";
    public string RutaArchivoInicial { get; init; } = "";
    public string TipoDocumento { get; init; } = "";
    public long TamanoBytes { get; init; }
    public string HashSHA256 { get; init; } = "";
}

/// <summary>Solicitud del portal externo para obtener identidad de visitante.</summary>
public sealed record AccesoExternoRequest
{
    public string NombreCompleto { get; init; } = "";
    public string Correo { get; init; } = "";
}

/// <summary>Identidad de visitante devuelta por el alta anónima.</summary>
public sealed record VisitanteDto
{
    public int? IdUsuario { get; init; }
    public string NombreCompleto { get; init; } = "";
    public string Correo { get; init; } = "";
    public string VisitorToken { get; init; } = "";
}

/// <summary>Fila que devuelve app.sp_CrearUsuarioAnonimo.</summary>
public sealed record UsuarioAnonimoRow
{
    public int? IdUsuario { get; init; }
    public string? SamAccountName { get; init; }
    public string? Dominio { get; init; }
    public string? NombreCompleto { get; init; }
    public string? Correo { get; init; }
    public bool EsAnonimo { get; init; }
}
