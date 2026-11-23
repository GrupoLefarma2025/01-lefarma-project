namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

public sealed class PdfSignatureSettings
{
    public double AnchoFirma { get; init; } = 150;

    public double AltoFirma { get; init; } = 50;

    public double DesplazamientoX { get; init; }

    public double DesplazamientoY { get; init; } = -15;

    public double RellenoCubierta { get; init; } = 3;

    public double TamanoFuente { get; init; } = 8;

    public double SeparacionTexto { get; init; } = 2;

    public double InterlineadoTexto { get; init; } = 10;

    public int DpiAplanado { get; init; } = 250;

    public string ContrasenaPropietario { get; init; } = "SignerLock2025!";

    public bool PermitirImpresion { get; init; } = true;

    public bool Aplanar { get; init; } = true;
}
