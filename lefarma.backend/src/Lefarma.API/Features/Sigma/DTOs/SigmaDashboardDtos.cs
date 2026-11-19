namespace Lefarma.API.Features.Sigma.DTOs;

// Respuestas y filas del dashboard de documentos (puerto de DocumentosModule.cs / DocumentosDashboardModels de SIGMA).

public sealed record DocumentosDashboardStatisticsDto
{
    public int DocumentsPendingAuthorization { get; init; }
    public int DocumentsAuthorized { get; init; }
    public decimal AverageDocumentsPerDay { get; init; }
}

public sealed record DocumentosDashboardUserStatDto
{
    public string? SamAccountName { get; init; }
    public string? UserName { get; init; }
    public int AuthorizedThisMonth { get; init; }
    public int PendingThisMonth { get; init; }
    public int RejectedThisMonth { get; init; }
}

public sealed record DocumentosDashboardSeriesPointDto
{
    public string Date { get; init; } = "";
    public int Uploaded { get; init; }
    public int Authorized { get; init; }
    public int Rejected { get; init; }
}

public sealed record DocumentosDashboardUserDto
{
    public string DisplayName { get; init; } = "";
    public string SamAccountName { get; init; } = "";
    public bool CanViewAll { get; init; }
}

public sealed record DocumentosDashboardDataDto
{
    public DocumentosDashboardUserDto User { get; init; } = new();
    public DocumentosDashboardStatisticsDto Statistics { get; init; } = new();
    public IReadOnlyList<DocumentosDashboardUserStatDto> UserStats { get; init; } = Array.Empty<DocumentosDashboardUserStatDto>();
    public IReadOnlyList<DocumentosDashboardSeriesPointDto> ActivitySeries { get; init; } = Array.Empty<DocumentosDashboardSeriesPointDto>();
}

public sealed record BandejaUsuarioDto
{
    public string Value { get; init; } = "";
    public string Label { get; init; } = "";
}

// --- Filas privadas de los SP (mismos nombres que SIGMA) ---

internal sealed record DocumentosDashboardStatisticsRow
{
    public int DocumentsPendingAuthorization { get; init; }
    public int DocumentsAuthorized { get; init; }
    public decimal AverageDocumentsPerDay { get; init; }
}

internal sealed record DocumentosDashboardUserStatRow
{
    public string? SamAccountName { get; init; }
    public string? UserName { get; init; }
    public int AuthorizedThisMonth { get; init; }
    public int PendingThisMonth { get; init; }
    public int RejectedThisMonth { get; init; }
}

internal sealed record DocumentosDashboardSeriesRow
{
    public DateTime Fecha { get; init; }
    public int Uploaded { get; init; }
    public int Authorized { get; init; }
    public int Rejected { get; init; }
}

internal sealed record BandejaUsuariosRow
{
    public string? SamAccountName { get; init; }
    public string? Dominio { get; init; }
    public string? NombreCompleto { get; init; }
    public int? IdUsuario { get; init; }
}
