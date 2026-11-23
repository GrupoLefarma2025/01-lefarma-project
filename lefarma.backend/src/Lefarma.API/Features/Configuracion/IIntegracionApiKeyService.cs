using ErrorOr;

namespace Lefarma.API.Features.Configuracion;

public sealed record IntegracionAutenticada(
    int IdIntegracion,
    string Nombre,
    IReadOnlyCollection<string>? ClavesPermitidas);

public interface IIntegracionApiKeyService
{
    Task<ErrorOr<IntegracionAutenticada>> AutenticarAsync(string? apiKey, CancellationToken ct = default);
}
