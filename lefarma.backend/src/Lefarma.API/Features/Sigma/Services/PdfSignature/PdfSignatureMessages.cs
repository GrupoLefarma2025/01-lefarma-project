namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

internal static class PdfSignatureMessages
{
    public const string MarcadorSinPalabra = "ERROR_KEYWORD_NOT_FOUND";

    public const string PalabraEncontrada = "KEYWORD_FOUND";

    public const string Exito = "Proceso completado exitosamente.";
}

internal static class RutasRecursos
{
    public static string Resolver(string raizContenido, string ruta)
    {
        if (string.IsNullOrWhiteSpace(ruta))
        {
            return raizContenido;
        }

        return Path.IsPathRooted(ruta)
            ? Path.GetFullPath(ruta)
            : Path.GetFullPath(Path.Combine(raizContenido, ruta));
    }
}
