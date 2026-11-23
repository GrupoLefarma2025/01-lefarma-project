using ErrorOr;

namespace Lefarma.API.Features.Configuracion;

public interface IConfiguracionRuntimeService
{
    Task<ErrorOr<T>> GetAsync<T>(string clave, CancellationToken ct = default);

    Task<ErrorOr<string>> GetTextAsync(string clave, CancellationToken ct = default);

    void Invalidar(string clave);
}
