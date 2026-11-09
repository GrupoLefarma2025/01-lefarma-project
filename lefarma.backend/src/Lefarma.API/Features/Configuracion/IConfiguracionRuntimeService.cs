using ErrorOr;

namespace Lefarma.API.Features.Configuracion;

/// <summary>
/// Acceso en runtime a las variables de configuración disponibles para backend.
/// Mantiene una caché por clave con respaldo del último valor conocido.
/// </summary>
public interface IConfiguracionRuntimeService
{
    /// <summary>Obtiene el valor deserializado al tipo solicitado.</summary>
    Task<ErrorOr<T>> GetAsync<T>(string clave, CancellationToken ct = default);

    /// <summary>Obtiene el valor como texto (desenvuelve cadenas JSON).</summary>
    Task<ErrorOr<string>> GetTextAsync(string clave, CancellationToken ct = default);

    /// <summary>Invalida la entrada de caché de una clave (llamar después del commit).</summary>
    void Invalidar(string clave);
}
