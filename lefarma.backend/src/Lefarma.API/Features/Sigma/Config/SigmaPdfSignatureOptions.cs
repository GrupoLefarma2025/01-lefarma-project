namespace Lefarma.API.Features.Sigma.Config;

/// <summary>
/// Configuración del motor de firma de PDFs (script Python del proyecto
/// core-manager). Se enlaza desde la sección <c>Sigma:PdfSignature</c>.
/// </summary>
public sealed class SigmaPdfSignatureOptions
{
    public const string SectionName = "Sigma:PdfSignature";

    /// <summary>Ejecutable de Python; por defecto el que esté en el PATH.</summary>
    public string PythonExe { get; set; } = "python";

    /// <summary>Script de estampado de firma, relativo al ContentRoot si no es absoluto.</summary>
    public string ScriptPath { get; set; } = "scripts/pdf_signature_replacer.py";

    /// <summary>Imagen de la firma, relativa al ContentRoot si no es absoluta.</summary>
    public string ImagePath { get; set; } = "scripts/assets/firma.png";

    /// <summary>Texto del PDF que se sustituye por la imagen de la firma.</summary>
    public string SearchText { get; set; } = "#firmad";

    /// <summary>Tiempo máximo de ejecución del script, en segundos.</summary>
    public int TimeoutSeconds { get; set; } = 120;
}
