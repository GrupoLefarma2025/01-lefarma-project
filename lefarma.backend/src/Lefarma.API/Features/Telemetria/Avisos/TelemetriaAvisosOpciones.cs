namespace Lefarma.API.Features.Telemetria.Avisos;

/// <summary>
/// Configuración de los avisos proactivos. Apagados por omisión: si no hay
/// destinatarios no se envía nada y el API arranca igual.
/// </summary>
public sealed class TelemetriaAvisosOpciones
{
    public const string Seccion = "Telemetria:Avisos";

    public bool Habilitado { get; set; }

    /// <summary>Hora local (0-23) a la que se manda el resumen del día.</summary>
    public int HoraResumen { get; set; } = 8;

    /// <summary>Correos que reciben tanto el resumen como las alertas.</summary>
    public List<string> Destinatarios { get; set; } = [];

    /// <summary>Ventana en minutos para considerar un error «nuevo y repetido».</summary>
    public int VentanaAlertaMinutos { get; set; } = 10;

    /// <summary>Ocurrencias mínimas dentro de la ventana para avisar.</summary>
    public int RepeticionesAlerta { get; set; } = 3;

    /// <summary>Cada cuántos minutos se revisan las alertas.</summary>
    public int PeriodoMinutos { get; set; } = 5;
}
