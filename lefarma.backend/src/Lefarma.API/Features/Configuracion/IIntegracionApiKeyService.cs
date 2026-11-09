using ErrorOr;

namespace Lefarma.API.Features.Configuracion;

/// <summary>Cliente de integración ya autenticado.</summary>
public sealed record IntegracionAutenticada(
    int IdIntegracion,
    string Nombre,
    IReadOnlyCollection<string>? ClavesPermitidas);

/// <summary>Autenticación de clientes externos mediante el encabezado X-API-Key.</summary>
public interface IIntegracionApiKeyService
{
    Task<ErrorOr<IntegracionAutenticada>> AutenticarAsync(string? apiKey, CancellationToken ct = default);
}
