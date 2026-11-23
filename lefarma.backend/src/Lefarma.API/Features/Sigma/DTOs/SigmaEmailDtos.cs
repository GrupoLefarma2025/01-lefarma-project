using System.Text.Json.Serialization;

namespace Lefarma.API.Features.Sigma.DTOs;

public sealed class DocumentoEmailResult
{
    public bool Success { get; set; }
    public int DocumentosProcesados { get; set; }
    public int CorreosEnviados { get; set; }
    public List<string> Errores { get; set; } = new();
    public string Mensaje { get; set; } = "";
}

public sealed class DocumentoMetadata
{
    [JsonPropertyName("to")]
    public string? To { get; set; }

    [JsonPropertyName("cc")]
    public string? Cc { get; set; }

    public List<string> GetCcList() =>
        string.IsNullOrWhiteSpace(Cc)
            ? new List<string>()
            : Cc.Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    public List<string> GetToList() =>
        string.IsNullOrWhiteSpace(To)
            ? new List<string>()
            : To.Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
}

internal sealed record DocumentoEmailRow
{
    public Guid Id { get; init; }
    public string NombreArchivo { get; init; } = "";
    public string? MimeType { get; init; }
    public byte[]? PDFBinario { get; init; }
    public string? MetadataJSON { get; init; }
    public int Estatus { get; init; }
    public long? TamanoBytes { get; init; }
    public DateTime FechaSubida { get; init; }
    public DateTime? FechaAutorizacion { get; init; }
    public DateTime? FechaRechazo { get; init; }
    public string? ComentariosSubida { get; init; }
    public string? ComentariosDecision { get; init; }
    public string? SubidoPorUsuario { get; init; }
}

internal sealed record DocumentoPendienteEmailRow
{
    public Guid Id { get; init; }
    public string NombreArchivo { get; init; } = "";
    public DateTime FechaSubida { get; init; }
}

public sealed record AutorizacionPendienteResponse
{
    public string Message { get; init; } = "";
    public int DocumentosProcesados { get; init; }
    public int CorreosEnviados { get; init; }
    public IReadOnlyList<string> Errores { get; init; } = Array.Empty<string>();
}

public sealed record NotificarDocumentoResponse
{
    public string Message { get; init; } = "";
    public Guid DocumentoId { get; init; }
    public bool SoloCC { get; init; }
}
