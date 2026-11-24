namespace Lefarma.API.Features.Catalogos.Proveedores.DTOs;

public class ArchivoUploadResponse
{
    public string FileName { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
}
