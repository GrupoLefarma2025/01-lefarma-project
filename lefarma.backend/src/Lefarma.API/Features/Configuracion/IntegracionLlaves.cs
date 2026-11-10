using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ErrorOr;
using Lefarma.API.Shared.Errors;

namespace Lefarma.API.Features.Configuracion;

/// <summary>
/// Generación y verificación de llaves de integración.
/// Formato: <c>cfg_&lt;base64url de 32 bytes&gt;</c>. Solo se persiste el SHA-256 hexadecimal.
/// </summary>
public static class IntegracionLlaves
{
    public const string Prefijo = "cfg_";

    /// <summary>Longitud del prefijo visible que se guarda en la base de datos.</summary>
    public const int LongitudPrefijoVisible = 16;

    /// <summary>Genera una llave criptográficamente segura.</summary>
    public static string Generar()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var base64Url = Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

        return $"{Prefijo}{base64Url}";
    }

    /// <summary>SHA-256 hexadecimal en minúsculas de la llave completa.</summary>
    public static string CalcularHash(string llave)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(llave))).ToLowerInvariant();

    /// <summary>Prefijo visible de la llave (nunca la llave completa).</summary>
    public static string ObtenerPrefijoVisible(string llave)
        => llave.Length <= LongitudPrefijoVisible ? llave : llave[..LongitudPrefijoVisible];

    /// <summary>Comparación de hashes en tiempo constante.</summary>
    public static bool HashesIguales(string hashGuardado, string hashCalculado)
    {
        var guardado = Encoding.UTF8.GetBytes(hashGuardado ?? string.Empty);
        var calculado = Encoding.UTF8.GetBytes(hashCalculado ?? string.Empty);

        return guardado.Length == calculado.Length &&
               CryptographicOperations.FixedTimeEquals(guardado, calculado);
    }

    /// <summary>
    /// Normaliza la lista de claves permitidas. Devuelve null cuando no se restringe
    /// (array vacío o ausente = todas las variables disponibles para integraciones).
    /// </summary>
    public static ErrorOr<List<string>?> NormalizarClaves(IEnumerable<string>? claves)
    {
        if (claves is null)
        {
            return (List<string>?)null;
        }

        var normalizadas = new List<string>();

        foreach (var clave in claves)
        {
            if (string.IsNullOrWhiteSpace(clave))
            {
                return CommonErrors.Validation("clavesPermitidas", "Las claves permitidas no pueden estar vacías.");
            }

            var valor = clave.Trim();

            if (valor.EndsWith('*'))
            {
                var prefijo = valor[..^1];
                if (string.IsNullOrWhiteSpace(prefijo))
                {
                    return CommonErrors.Validation("clavesPermitidas", "Un prefijo de clave debe tener contenido antes del '*'.");
                }
            }

            if (!normalizadas.Contains(valor, StringComparer.OrdinalIgnoreCase))
            {
                normalizadas.Add(valor);
            }
        }

        return normalizadas.Count == 0 ? (List<string>?)null : normalizadas;
    }

    public static List<string>? DeserializarClaves(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static string? SerializarClaves(List<string>? claves)
        => claves is null || claves.Count == 0 ? null : JsonSerializer.Serialize(claves);

    /// <summary>
    /// Indica si la clave solicitada está permitida: coincidencia exacta o prefijo
    /// terminado en '*'. Sin restricciones (null) permite todas.
    /// </summary>
    public static bool ClavePermitida(IReadOnlyCollection<string>? patrones, string clave)
    {
        if (patrones is null || patrones.Count == 0)
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(clave))
        {
            return false;
        }

        foreach (var patron in patrones)
        {
            if (string.IsNullOrWhiteSpace(patron))
            {
                continue;
            }

            if (patron.EndsWith('*'))
            {
                var prefijo = patron[..^1];
                if (clave.StartsWith(prefijo, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            else if (string.Equals(patron, clave, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }
}
