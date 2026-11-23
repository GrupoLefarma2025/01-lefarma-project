using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;
using PdfSharp.Pdf.Security;

namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

public static class PdfProtector
{
    public static byte[] Proteger(byte[] pdf, PdfSignatureSettings ajustes)
    {
        using var entrada = new MemoryStream(pdf, writable: false);
        using var documento = PdfReader.Open(entrada, PdfDocumentOpenMode.Modify);

        var seguridad = documento.SecuritySettings;
        seguridad.UserPassword = string.Empty;
        seguridad.OwnerPassword = ajustes.ContrasenaPropietario;

        seguridad.PermitPrint = ajustes.PermitirImpresion;
        seguridad.PermitFullQualityPrint = false;
        seguridad.PermitModifyDocument = false;
        seguridad.PermitExtractContent = false;
        seguridad.PermitAnnotations = false;
        seguridad.PermitFormsFill = false;
        seguridad.PermitAssembleDocument = false;

        documento.SecurityHandler.SetEncryption(PdfStandardSecurityHandler.DefaultEncryption.V5);

        using var salida = new MemoryStream();
        documento.Save(salida, false);
        return salida.ToArray();
    }
}
