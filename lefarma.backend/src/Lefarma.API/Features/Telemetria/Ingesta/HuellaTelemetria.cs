using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Lefarma.API.Features.Telemetria.Ingesta;

/// <summary>
/// Huella estable de un error: agrupa el mismo fallo aunque cambien los números de
/// línea, los identificadores de la ruta o los argumentos del stack.
/// </summary>
public static partial class HuellaTelemetria
{
    private const int Largo = 16;

    public static string Calcular(string tipoError, string mensaje, string? stack, string ruta)
    {
        var texto = string.Join(
            '|',
            Normalizar(tipoError),
            NormalizarMensaje(mensaje),
            NormalizarStack(stack),
            NormalizarRuta(ruta));

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(texto));
        return Convert.ToHexString(hash)[..Largo].ToLowerInvariant();
    }

    private static string NormalizarMensaje(string mensaje)
    {
        var limpio = Espacios().Replace(Numeros().Replace(mensaje.Trim(), "#"), " ");
        return Recortar(limpio.ToLowerInvariant(), 300);
    }

    private static string NormalizarStack(string? stack)
    {
        if (string.IsNullOrWhiteSpace(stack))
        {
            return string.Empty;
        }

        var lineas = stack
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Take(3)
            .Select(linea => Argumentos().Replace(RutaArchivo().Replace(linea, string.Empty), "()"));

        return Recortar(Espacios().Replace(string.Join("·", lineas), " "), 300);
    }

    private static string NormalizarRuta(string ruta)
    {
        var limpia = ruta.Split('?', 2)[0];
        limpia = Guids().Replace(limpia, ":id");
        limpia = Identificadores().Replace(limpia, ":id");
        return Recortar(limpia.ToLowerInvariant(), 200);
    }

    private static string Normalizar(string valor) => valor.Trim().ToLowerInvariant();

    private static string Recortar(string valor, int maximo) =>
        valor.Length <= maximo ? valor : valor[..maximo];

    [GeneratedRegex(@"\d+")]
    private static partial Regex Numeros();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Espacios();

    [GeneratedRegex(@"^.*[\\/]")]
    private static partial Regex RutaArchivo();

    [GeneratedRegex(@"\([^)]*\)")]
    private static partial Regex Argumentos();

    [GeneratedRegex(@"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")]
    private static partial Regex Guids();

    [GeneratedRegex(@"/(\d+)(?=/|$)")]
    private static partial Regex Identificadores();
}
