namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

/// <summary>Marcadores de salida que el controlador y los registros ya consumen.</summary>
internal static class PdfSignatureMessages
{
    /// <summary>El PDF no contenía el texto que se reemplaza por la firma.</summary>
    public const string MarcadorSinPalabra = "ERROR_KEYWORD_NOT_FOUND";

    /// <summary>El escaneo encontró el texto de firma.</summary>
    public const string PalabraEncontrada = "KEYWORD_FOUND";

    /// <summary>Mensaje de éxito que antes imprimía el script.</summary>
    public const string Exito = "Proceso completado exitosamente.";
}

/// <summary>Resuelve rutas de recursos relativas a la raíz de contenido de la API.</summary>
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
