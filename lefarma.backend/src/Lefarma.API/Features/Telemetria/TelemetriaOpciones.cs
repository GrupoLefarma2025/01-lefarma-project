namespace Lefarma.API.Features.Telemetria;

public sealed class TelemetriaOpciones
{
    public const string Seccion = "Telemetria";

    public bool Habilitada { get; set; } = true;

    public int RetencionDiasErrores { get; set; } = 180;

    public int RetencionDiasClics { get; set; } = 90;

    public int RetencionDiasMapaCalor { get; set; } = 365;

    public int RetencionDiasVisitas { get; set; } = 365;

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
