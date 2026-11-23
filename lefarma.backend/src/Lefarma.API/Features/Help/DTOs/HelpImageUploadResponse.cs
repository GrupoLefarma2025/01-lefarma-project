namespace Lefarma.API.Features.Help.DTOs;

public record HelpImageUploadResponse
{
    public int Id { get; init; }

    public string NombreOriginal { get; init; } = string.Empty;

    public string NombreArchivo { get; init; } = string.Empty;

    public string RutaRelativa { get; init; } = string.Empty;

    public long TamanhoBytes { get; init; }

    public string MimeType { get; init; } = string.Empty;

    public int? Ancho { get; init; }

    public int? Alto { get; init; }

    public DateTime FechaSubida { get; init; }
}
