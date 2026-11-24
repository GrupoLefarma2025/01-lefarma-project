namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

internal static class PdfSignatureMessages
{
    public const string MarcadorSinPalabra = "ERROR_KEYWORD_NOT_FOUND";

    public const string PalabraEncontrada = "KEYWORD_FOUND";

    public const string Exito = "Proceso completado exitosamente.";
}

internal static class RutasRecursos
{
    private const string CarpetaExtraccion = "App_Data/recursos";

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

    public static string ResolverArchivo(string raizContenido, string ruta)
    {
        var rutaDirecta = Resolver(raizContenido, ruta);
        if (string.IsNullOrWhiteSpace(ruta) || File.Exists(rutaDirecta))
        {
            return rutaDirecta;
        }

        var recurso = BuscarRecurso(ruta);
        if (recurso is null)
        {
            return rutaDirecta;
        }

        var carpeta = Resolver(raizContenido, CarpetaExtraccion);
        Directory.CreateDirectory(carpeta);

        var destino = Path.Combine(carpeta, Path.GetFileName(ruta));
        if (File.Exists(destino))
        {
            return destino;
        }

        var temporal = destino + "." + Guid.NewGuid().ToString("N") + ".tmp";
        using (var origen = typeof(RutasRecursos).Assembly.GetManifestResourceStream(recurso)!)
        using (var archivo = File.Create(temporal))
        {
            origen.CopyTo(archivo);
        }

        try
        {
            File.Move(temporal, destino);
        }
        catch (IOException) when (File.Exists(destino))
        {
            File.Delete(temporal);
        }

        return destino;
    }

    private static string? BuscarRecurso(string ruta)
    {
        var sufijo = "." + ruta.Replace('\\', '.').Replace('/', '.');
        return typeof(RutasRecursos).Assembly.GetManifestResourceNames()
            .FirstOrDefault(nombre => nombre.EndsWith(sufijo, StringComparison.OrdinalIgnoreCase));
    }
}
