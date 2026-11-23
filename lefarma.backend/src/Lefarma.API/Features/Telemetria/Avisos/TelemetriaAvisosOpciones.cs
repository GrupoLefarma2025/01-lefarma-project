namespace Lefarma.API.Features.Telemetria.Avisos;

public sealed class TelemetriaAvisosOpciones
{
    public const string Seccion = "Telemetria:Avisos";

    public bool Habilitado { get; set; }

    public int HoraResumen { get; set; } = 8;

    public List<string> Destinatarios { get; set; } = [];

    public int VentanaAlertaMinutos { get; set; } = 10;

    public int RepeticionesAlerta { get; set; } = 3;

    public int PeriodoMinutos { get; set; } = 5;
}
