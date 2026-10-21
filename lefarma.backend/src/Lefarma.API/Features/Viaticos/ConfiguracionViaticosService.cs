using System.Runtime.CompilerServices;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Lefarma.API.Features.Viaticos;

/// <summary>Fila de la tabla de configuración de viáticos (clave/valor).</summary>
public class ConfigParametroFila
{
    public string clave { get; set; } = string.Empty;
    public string valor { get; set; } = string.Empty;
}

/// <summary>
/// Carga la configuración de viáticos desde la tabla
/// <c>viaticos.config_parametros</c> y la deja disponible para el motor
/// (<see cref="ConfiguracionViaticos"/>). La cache evita consultar en cada
/// cálculo.
/// </summary>
public static class ConfiguracionViaticosService
{
    private const string CacheKey = "viaticos.config_parametros:v1";

    public static async Task ActualizarAsync(
        ApplicationDbContext context, IMemoryCache cache, CancellationToken ct)
    {
        if (cache.TryGetValue(CacheKey, out Dictionary<string, string>? guardada) && guardada is not null)
        {
            ConfiguracionViaticos.Cargar(guardada.Select(kv => (kv.Key, kv.Value)));
            return;
        }

        try
        {
            var filas = await context.Database
                .SqlQuery<ConfigParametroFila>(
                    FormattableStringFactory.Create("SELECT clave, valor FROM viaticos.config_parametros"))
                .ToListAsync(ct);
            var dict = filas.ToDictionary(f => f.clave, f => f.valor, StringComparer.OrdinalIgnoreCase);
            cache.Set(CacheKey, dict, TimeSpan.FromMinutes(5));
            ConfiguracionViaticos.Cargar(dict.Select(kv => (kv.Key, kv.Value)));
        }
        catch (Exception ex)
        {
            // La tabla puede no existir todavía: se siguen los valores por defecto.
            Serilog.Log.Debug($"Configuración de viáticos: no se pudo leer la tabla ({ex.Message}). Se usan los valores por defecto.");
        }
    }
}
