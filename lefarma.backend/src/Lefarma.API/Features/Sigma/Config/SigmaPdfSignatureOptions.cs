namespace Lefarma.API.Features.Sigma.Config;

public sealed class SigmaPdfSignatureOptions
{
    public const string SectionName = "Sigma:PdfSignature";

    public string Motor { get; set; } = "csharp";

    public string PythonExe { get; set; } = "python";

    public string ScriptPath { get; set; } = "scripts/pdf_signature_replacer.py";

    public string ImagePath { get; set; } = "scripts/assets/firma.png";

    public string SearchText { get; set; } = "#firmad";

    public int TimeoutSeconds { get; set; } = 120;
}
