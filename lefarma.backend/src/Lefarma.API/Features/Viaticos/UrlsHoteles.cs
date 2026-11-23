namespace Lefarma.API.Features.Viaticos;

public static class UrlsHoteles
{
    private const string PrefijoListado = "hoteles en ";

    public static string ParaListado(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return url;

        var partes = uri.Query.TrimStart('?')
            .Split('&', StringSplitOptions.RemoveEmptyEntries);
        if (partes.Length == 0) return url;

        var reescrito = false;
        var nuevas = new List<string>(partes.Length);
        foreach (var parte in partes)
        {
            var separador = parte.IndexOf('=');
            if (separador <= 0)
            {
                nuevas.Add(parte);
                continue;
            }

            var clave = parte[..separador];
            var valor = parte[(separador + 1)..];
            if (!reescrito && clave.Equals("q", StringComparison.OrdinalIgnoreCase))
            {
                var consulta = Uri.UnescapeDataString(valor.Replace("+", " ", StringComparison.Ordinal));
                if (!consulta.StartsWith(PrefijoListado, StringComparison.OrdinalIgnoreCase))
                {
                    var coma = consulta.IndexOf(',');
                    if (coma > 0)
                    {
                        var ciudad = consulta[(coma + 1)..].Trim();
                        if (ciudad.Length >= 3)
                        {
                            consulta = $"{PrefijoListado}{ciudad}";
                            valor = Uri.EscapeDataString(consulta);
                            reescrito = true;
                        }
                    }
                }
            }

            nuevas.Add($"{clave}={valor}");
        }

        if (!reescrito) return url;
        return new UriBuilder(uri) { Query = string.Join("&", nuevas) }.Uri.AbsoluteUri;
    }
}
