namespace Lefarma.API.Features.Telemetria;

/// <summary>
/// Configuración del módulo de telemetría (sección <c>Telemetria</c> de appsettings).
/// La telemetría se guarda en la base de Lefarma; no tiene ruta ni archivo propio.
/// </summary>
public sealed class TelemetriaOpciones
{
    public const string Seccion = "Telemetria";

    /// <summary>Apaga captura, ingesta y escritura sin quitar el módulo del binario.</summary>
    public bool Habilitada { get; set; } = true;

    public int RetencionDiasErrores { get; set; } = 180;

    public int RetencionDiasClics { get; set; } = 90;

    public int RetencionDiasMapaCalor { get; set; } = 365;

    public int RetencionDiasVisitas { get; set; } = 365;

    /// <summary>Prefijos de ruta que no generan clics ni mapa de calor (los errores sí se capturan).</summary>
    public string[] RutasExcluidas { get; set; } =
    [
        "/login",
        "/perfil",
        "/perfil/configuracion",
        "/configuracion",
        "/rh/sueldos",
        "/rh/documentos"
    ];

    public int LoteMaximoEventos { get; set; } = 100;

    public int ColaMaximaEventos { get; set; } = 10_000;

    public int MuestreoPunteroMs { get; set; } = 100;

    public int TamanoCeldaPx { get; set; } = 32;
}
