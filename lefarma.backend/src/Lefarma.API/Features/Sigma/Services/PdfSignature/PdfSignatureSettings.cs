namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

/// <summary>
/// Constantes del estampado de firma. Reproducen los valores por defecto de
/// <c>scripts/pdf_signature_replacer.py</c>: caja de 150×50 pt centrada sobre el
/// texto encontrado, desplazada 0/-15, texto de 8 pt debajo y aplanado a 250 dpi.
/// </summary>
public sealed class PdfSignatureSettings
{
    /// <summary>Ancho de la caja donde se dibuja la firma, en puntos.</summary>
    public double AnchoFirma { get; init; } = 150;

    /// <summary>Alto de la caja donde se dibuja la firma, en puntos.</summary>
    public double AltoFirma { get; init; } = 50;

    /// <summary>Desplazamiento horizontal de la firma respecto al centro del texto.</summary>
    public double DesplazamientoX { get; init; }

    /// <summary>Desplazamiento vertical de la firma respecto al borde superior del texto.</summary>
    public double DesplazamientoY { get; init; } = -15;

    /// <summary>Margen del rectángulo blanco que tapa el texto reemplazado.</summary>
    public double RellenoCubierta { get; init; } = 3;

    /// <summary>Tamaño del texto con el id y la fecha.</summary>
    public double TamanoFuente { get; init; } = 8;

    /// <summary>Separación entre el borde inferior de la firma y la primera línea.</summary>
    public double SeparacionTexto { get; init; } = 2;

    /// <summary>Distancia entre líneas de texto: en el script es <c>font_size + 2</c>.</summary>
    public double InterlineadoTexto { get; init; } = 10;

    /// <summary>Resolución del aplanado: el script usa 250 dpi.</summary>
    public int DpiAplanado { get; init; } = 250;

    /// <summary>Contraseña de propietario con la que se bloquea el PDF.</summary>
    public string ContrasenaPropietario { get; init; } = "SignerLock2025!";

    /// <summary>Si el PDF resultante permite imprimir.</summary>
    public bool PermitirImpresion { get; init; } = true;

    /// <summary>Si cada página se convierte en imagen (comportamiento del backend).</summary>
    public bool Aplanar { get; init; } = true;
}
