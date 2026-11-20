using System.Security.Cryptography;
using System.Text;
using Lefarma.API.Features.Telemetria.Almacen;
using Microsoft.Extensions.Caching.Memory;

namespace Lefarma.API.Features.Telemetria.Ingesta;

public interface IAtribucionUsuario
{
    /// <summary>
    /// Huella estable del usuario (nunca se guarda su id). Devuelve null si no se
    /// puede calcular, y entonces el evento se guarda sin usuario.
    /// </summary>
    Task<string?> ObtenerHashAsync(string? usuarioId, CancellationToken cancellationToken);
}

/// <summary>
/// Calcula la huella del usuario con HMAC-SHA256 y una sal guardada en la base.
/// La sal se cachea en memoria; si el almacén no responde, no se guarda el id.
/// </summary>
public class AtribucionUsuario(
    TelemetriaRepositorio repositorio,
    IMemoryCache cache,
    ILogger<AtribucionUsuario> log) : IAtribucionUsuario
{
    private const string ClaveCache = "telemetria:sal_usuario";

    public async Task<string?> ObtenerHashAsync(string? usuarioId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(usuarioId))
            return null;

        var sal = await ObtenerSalAsync(cancellationToken);
        if (sal is null)
            return null;

        var hash = HMACSHA256.HashData(
            Convert.FromBase64String(sal),
            Encoding.UTF8.GetBytes(usuarioId.Trim()));

        return Convert.ToHexString(hash)[..32].ToLowerInvariant();
    }

    private async Task<string?> ObtenerSalAsync(CancellationToken cancellationToken)
    {
        if (cache.TryGetValue(ClaveCache, out string? cacheada) && !string.IsNullOrWhiteSpace(cacheada))
            return cacheada;

        try
        {
            var sal = await repositorio.ObtenerOCrearSalAsync(cancellationToken);
            cache.Set(ClaveCache, sal, TimeSpan.FromHours(12));
            return sal;
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Sin sal de telemetría: el evento se guardará sin usuario.");
            return null;
        }
    }
}
