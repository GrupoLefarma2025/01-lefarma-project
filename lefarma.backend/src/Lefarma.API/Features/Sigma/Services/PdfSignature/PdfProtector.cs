using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;
using PdfSharp.Pdf.Security;

namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

/// <summary>
/// Bloquea el PDF con la misma protección que el script: AES-256 (revisión 6),
/// contraseña de propietario sin contraseña de usuario y sólo impresión permitida.
/// </summary>
public static class PdfProtector
{
    /// <summary>Cifra el PDF y devuelve los bytes protegidos.</summary>
    public static byte[] Proteger(byte[] pdf, PdfSignatureSettings ajustes)
    {
        using var entrada = new MemoryStream(pdf, writable: false);
        using var documento = PdfReader.Open(entrada, PdfDocumentOpenMode.Modify);

        var seguridad = documento.SecuritySettings;
        seguridad.UserPassword = string.Empty;
        seguridad.OwnerPassword = ajustes.ContrasenaPropietario;

        // Permisos del script: ACCESSIBILITY | PRINT. PDFsharp no expone el permiso
        // de accesibilidad (bit 10 de /P), así que el resto se apaga explícitamente.
        seguridad.PermitPrint = ajustes.PermitirImpresion;
        seguridad.PermitFullQualityPrint = false;
        seguridad.PermitModifyDocument = false;
        seguridad.PermitExtractContent = false;
        seguridad.PermitAnnotations = false;
        seguridad.PermitFormsFill = false;
        seguridad.PermitAssembleDocument = false;

        // PDFsharp 6.2.4 (la última versión MIT) elige el cifrado a través del
        // manejador estándar; V5 equivale a AES-256 (revisión 6) del script.
        documento.SecurityHandler.SetEncryption(PdfStandardSecurityHandler.DefaultEncryption.V5);

        using var salida = new MemoryStream();
        documento.Save(salida, false);
        return salida.ToArray();
    }
}
