namespace Lefarma.API.Features.Telemetria.Consulta;

public sealed record ResumenTelemetria(
    int ErroresHoy,
    int ErroresPeriodo,
    int ClicsPeriodo,
    int VisitasPeriodo,
    long EventosDescartados,
    IReadOnlyList<HuellaErrorResumen> TopErrores,
    IReadOnlyList<BotonResumen> TopBotones);

public sealed record HuellaErrorResumen(
    string Huella,
    string TipoError,
    string Mensaje,
    string Ruta,
    int Ocurrencias,
    int UsuariosAfectados,
    DateTime PrimeraVez,
    DateTime UltimaVez);

public sealed record OcurrenciaError(
    DateTime RecibidoEn,
    DateTime OcurridoEn,
    string Mensaje,
    string? Stack,
    string Ruta,
    string? Navegador,
    string? UsuarioHash,
    int? EstadoHttp,
    string? RequestId,
    string? Entorno);

public sealed record BotonResumen(
    string Ruta,
    string Elemento,
    string? Etiqueta,
    int Clics,
    int UsuariosUnicos,
    int ClicsDeEnojo,
    DateTime UltimoClic);

public sealed record MapaCalorResumen(
    string Ruta,
    int Columnas,
    int Filas,
    int TamanoCelda,
    long TotalMovimientos,
    int Visitas,
    IReadOnlyList<int> Celdas);

public sealed record RutaResumen(
    string Ruta,
    int Clics,
    int Errores,
    int Visitas);

public sealed record ErrorServidorResumen(
    long Id,
    DateTime FechaError,
    string Severidad,
    string TipoExcepcion,
    string MensajeError,
    string? RutaEndpoint,
    string? MetodoHttp,
    int? StatusCode,
    string? NombreUsuario,
    long? DurationMs,
    Guid? RequestId);

public sealed record PaginaErrorServidor(
    int Total,
    int Pagina,
    int Tamano,
    IReadOnlyList<ErrorServidorResumen> Elementos);
