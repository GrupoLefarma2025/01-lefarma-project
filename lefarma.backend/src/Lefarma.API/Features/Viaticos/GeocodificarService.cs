using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Lefarma.API.Features.Viaticos;

// Proxy de geocodificación para el selector de puntos en mapa (viáticos).
// Búsqueda (tipo=global): Nominatim es el motor primario bajo la política de
// OSM (https://operations.osmfoundation.org/policies/nominatim/: User-Agent
// identificable y máximo 1 request/s) y Photon (photon.komoot.io, misma fuente
// OSM, pensado para consultas parciales del tipo "hosp xoco") entra como
// refuerzo SOLO cuando Nominatim no devuelve nada o falla, para tolerar
// palabras incompletas o abreviadas sin cargar a Nominatim con más tráfico.
// Geocodificación inversa (tipo=reversa): coordenadas pegadas → dirección de
// referencia, vía Nominatim /reverse.
// Cada motor tiene su compuerta de 1 req/s, timeout de 12 s y cache de 6 h
// (patrón de CalculoCostosRuta); los HttpClient los crea el controller desde
// los clientes nombrados "nominatim" y "photon" (User-Agent configurado en
// Program.cs). La respuesta se acota a México por partida doble (parámetro
// countrycodes cuando el motor lo soporta y candado sobre el país del
// resultado), con hasta 8 resultados y etiqueta estilo Google; el `viewbox`
// opcional sesga hacia la ubicación del navegador ("Cerca de mí") sin excluir
// el resto del país. Los duplicados —misma coordenada o misma etiqueta
// visible— se descartan. Estado y municipio se extraen de la dirección.
public record GeocodificarResultado(
    string Nombre, double Latitud, double Longitud,
    string? Estado = null, string? Municipio = null);

public static class GeocodificarService
{
    private const string NominatimSearchBase = "https://nominatim.openstreetmap.org/search";
    private const string NominatimReverseBase = "https://nominatim.openstreetmap.org/reverse";
    private const string PhotonBase = "https://photon.komoot.io/api";
    private const int MinCaracteres = 3;
    // Siempre México; el selector pedía 5 resultados y se sube a 8 para dar
    // más opciones manteniendo la misma carga sobre upstream.
    private const int ResultadosMaximos = 8;
    private const int MinSeparacionUpstreamMs = 1000;
    private const string NombreFallback = "Punto sin nombre";
    private static readonly TimeSpan CacheDuracion = TimeSpan.FromHours(6);
    private static readonly TimeSpan TimeoutUpstream = TimeSpan.FromSeconds(12);

    // Compuerta por motor: separa los inicios de request >= 1 s aunque lleguen
    // en ráfaga (política de máximo 1 req/s); contadores independientes para
    // que el refuerzo de Photon no espere el turno de Nominatim.
    private sealed class CompuertaUpstream
    {
        private readonly SemaphoreSlim _gate = new(1, 1);
        private long _ultimoInicioTicks;

        public async Task RespetarTurnoAsync(CancellationToken ct)
        {
            await _gate.WaitAsync(ct);
            try
            {
                var esperaMs = MinSeparacionUpstreamMs - (Environment.TickCount64 - _ultimoInicioTicks);
                if (esperaMs > 0) await Task.Delay(TimeSpan.FromMilliseconds(esperaMs), ct);
                _ultimoInicioTicks = Environment.TickCount64;
            }
            finally
            {
                _gate.Release();
            }
        }
    }

    private static readonly CompuertaUpstream NominatimGate = new();
    private static readonly CompuertaUpstream PhotonGate = new();

    /// <summary>
    /// Busca direcciones o lugares por nombre (tipo=global). Nominatim primero;
    /// si devuelve cero resultados o falla, Photon (tolerante a palabras
    /// parciales) aporta los suyos. Devuelve null solo cuando ningún motor
    /// pudo responder; ArgumentException si la entrada es inválida.
    /// </summary>
    public static async Task<List<GeocodificarResultado>?> GeocodificarAsync(
        HttpClient nominatim, HttpClient photon, IMemoryCache cache,
        string? texto, string? viewbox,
        CancellationToken ct)
    {
        var textoLimpio = (texto ?? string.Empty).Trim();
        if (textoLimpio.Length < MinCaracteres)
            throw new ArgumentException($"texto debe tener al menos {MinCaracteres} caracteres.", nameof(texto));

        var viewboxLimpio = NormalizarViewbox(viewbox);
        var claveCache = $"geocodificar:global:{textoLimpio.ToLowerInvariant()}:{viewboxLimpio}";

        if (cache.TryGetValue(claveCache, out List<GeocodificarResultado>? enCache) && enCache is not null)
            return enCache;

        var nominatimRes = await BuscarNominatimAsync(nominatim, textoLimpio, viewboxLimpio, ct);
        List<GeocodificarResultado>? photonRes = null;
        var photonIntentado = false;
        if (nominatimRes is null || nominatimRes.Count == 0)
        {
            photonIntentado = true;
            photonRes = await BuscarPhotonAsync(photon, textoLimpio, viewboxLimpio, ct);
        }

        List<GeocodificarResultado>? resultados;
        if (nominatimRes is { Count: > 0 }) resultados = nominatimRes;
        else if (photonRes is { Count: > 0 }) resultados = photonRes;
        else if (nominatimRes is not null || photonRes is not null) resultados = [];
        else resultados = null;
        if (resultados is null) return null; // Ningún motor respondió: el controller responde 502.

        // El vacío solo se cachea cuando todos los motores consultados
        // respondieron; así un fallo transitorio no congela un "sin
        // resultados" por 6 h ni oculta lo que Photon pudiera encontrar luego.
        if (resultados.Count > 0 || (nominatimRes is not null && (!photonIntentado || photonRes is not null)))
            cache.Set(claveCache, resultados, CacheDuracion);
        return resultados;
    }

    /// <summary>
    /// Geocodificación inversa (tipo=reversa): coordenadas pegadas → dirección
    /// de referencia en una sola fila, con los mismos campos que la búsqueda.
    /// Devuelve lista vacía si upstream respondió sin dirección y null si no
    /// respondió; ArgumentException si lat/lon faltan o están fuera de rango.
    /// </summary>
    public static async Task<List<GeocodificarResultado>?> RevertirAsync(
        HttpClient http, IMemoryCache cache,
        string? lat, string? lon,
        CancellationToken ct)
    {
        const string formato = "0.#####";
        if (!double.TryParse((lat ?? string.Empty).Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var latitud) ||
            !double.TryParse((lon ?? string.Empty).Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var longitud) ||
            !double.IsFinite(latitud) || !double.IsFinite(longitud) ||
            latitud < -90 || latitud > 90 || longitud < -180 || longitud > 180)
            throw new ArgumentException("lat y lon son obligatorios y deben estar dentro del rango geográfico.", nameof(lat));

        var latTexto = latitud.ToString(formato, CultureInfo.InvariantCulture);
        var lonTexto = longitud.ToString(formato, CultureInfo.InvariantCulture);
        var claveCache = $"geocodificar:reversa:{latTexto},{lonTexto}";
        if (cache.TryGetValue(claveCache, out List<GeocodificarResultado>? enCache) && enCache is not null)
            return enCache;

        var urlUpstream =
            $"{NominatimReverseBase}?format=jsonv2&addressdetails=1&accept-language=es&zoom=18&lat={latTexto}&lon={lonTexto}";
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeoutUpstream);
            var t = cts.Token;
            await NominatimGate.RespetarTurnoAsync(t);
            using var res = await http.GetAsync(urlUpstream, t);
            res.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(t), cancellationToken: t);
            var raiz = doc.RootElement;
            var resultados = new List<GeocodificarResultado>();
            if (raiz.ValueKind == JsonValueKind.Object && !raiz.TryGetProperty("error", out _) && !EsDeOtroPais(raiz))
            {
                // Las coordenadas pegadas mandan: el pin queda exactamente
                // donde se pegó aunque el edificio cercano esté a un lado.
                var (estado, municipio) = LeerEstadoMunicipio(raiz);
                resultados.Add(new GeocodificarResultado(ConstruirNombre(raiz), latitud, longitud, estado, municipio));
            }
            cache.Set(claveCache, resultados, CacheDuracion);
            return resultados;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw; // El cliente se fue: no fabricar un 502.
        }
        catch
        {
            return null; // Upstream falló: el controller responde 502.
        }
    }

    /// <summary>Camino Nominatim de la búsqueda; null = upstream no respondió.</summary>
    private static async Task<List<GeocodificarResultado>?> BuscarNominatimAsync(
        HttpClient http, string textoLimpio, string viewboxLimpio, CancellationToken ct)
    {
        var urlUpstream =
            $"{NominatimSearchBase}?format=jsonv2&countrycodes=mx&addressdetails=1&accept-language=es&limit={ResultadosMaximos}&q={Uri.EscapeDataString(textoLimpio)}";
        if (viewboxLimpio.Length > 0)
            urlUpstream += $"&viewbox={viewboxLimpio}";
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeoutUpstream);
            var t = cts.Token;
            await NominatimGate.RespetarTurnoAsync(t);
            using var res = await http.GetAsync(urlUpstream, t);
            res.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(t), cancellationToken: t);
            var resultados = new List<GeocodificarResultado>();
            var vistos = new HashSet<(double, double)>();
            var etiquetas = new HashSet<string>();
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in doc.RootElement.EnumerateArray())
                {
                    if (!LeerLatLonNominatim(item, out var lat, out var lon)) continue;
                    // Candado país: upstream ya va con countrycodes=mx, pero
                    // cualquier resultado que declare otro país se descarta.
                    if (EsDeOtroPais(item)) continue;
                    var (estado, municipio) = LeerEstadoMunicipio(item);
                    AgregarSiNuevo(resultados, vistos, etiquetas, ConstruirNombre(item), lat, lon, estado, municipio);
                }
            }
            return resultados;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw; // El cliente se fue: no fabricar un 502.
        }
        catch
        {
            return null; // Upstream falló: se intenta Photon.
        }
    }

    /// <summary>Camino Photon de la búsqueda; null = upstream no respondió.</summary>
    private static async Task<List<GeocodificarResultado>?> BuscarPhotonAsync(
        HttpClient http, string textoLimpio, string viewboxLimpio, CancellationToken ct)
    {
        var urlUpstream = $"{PhotonBase}?limit={ResultadosMaximos}&q={Uri.EscapeDataString(textoLimpio)}";
        if (viewboxLimpio.Length > 0)
            urlUpstream += $"&bbox={viewboxLimpio}";
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeoutUpstream);
            var t = cts.Token;
            await PhotonGate.RespetarTurnoAsync(t);
            using var res = await http.GetAsync(urlUpstream, t);
            res.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(t), cancellationToken: t);
            var resultados = new List<GeocodificarResultado>();
            var vistos = new HashSet<(double, double)>();
            var etiquetas = new HashSet<string>();
            if (doc.RootElement.ValueKind == JsonValueKind.Object &&
                doc.RootElement.TryGetProperty("features", out var features) &&
                features.ValueKind == JsonValueKind.Array)
            {
                foreach (var feature in features.EnumerateArray())
                {
                    if (!LeerLugarPhoton(feature, out var props, out var lat, out var lon)) continue;
                    // Candado país: Photon no filtra por país, así que solo se
                    // aceptan resultados que declaren México.
                    if (!string.Equals(TextoDe(props, "countrycode"), "MX", StringComparison.OrdinalIgnoreCase)) continue;
                    var estado = TextoDe(props, "state");
                    var municipio = TextoDe(props, "city") ?? TextoDe(props, "district") ?? TextoDe(props, "county");
                    AgregarSiNuevo(resultados, vistos, etiquetas, ConstruirNombrePhoton(props), lat, lon, estado, municipio);
                }
            }
            return resultados;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw; // El cliente se fue: no fabricar un 502.
        }
        catch
        {
            return null; // Upstream falló: el controller decide (502 si tampoco hubo Nominatim).
        }
    }

    /// <summary>
    /// Agrega solo si no se repitieron la coordenada redondeada ni la etiqueta
    /// visible (OSM repite nodos con la misma dirección). El fallback sin
    /// nombre no cuenta para el dedupe por etiqueta: dos puntos distintos
    /// pueden quedarse sin dirección útil.
    /// </summary>
    private static void AgregarSiNuevo(
        List<GeocodificarResultado> resultados,
        HashSet<(double, double)> vistos, HashSet<string> etiquetas,
        string nombre, double lat, double lon, string? estado, string? municipio)
    {
        if (!vistos.Add((Math.Round(lat, 5), Math.Round(lon, 5)))) return;
        if (nombre != NombreFallback && !etiquetas.Add(NormalizarEtiqueta(nombre))) return;
        resultados.Add(new GeocodificarResultado(nombre, lat, lon, estado, municipio));
    }

    /// <summary>lat/lon de un resultado de Nominatim (llegan como texto).</summary>
    private static bool LeerLatLonNominatim(JsonElement item, out double lat, out double lon)
    {
        lat = 0;
        lon = 0;
        if (!item.TryGetProperty("lat", out var latEl) || !item.TryGetProperty("lon", out var lonEl)) return false;
        if (latEl.ValueKind != JsonValueKind.String || lonEl.ValueKind != JsonValueKind.String) return false;
        return double.TryParse(latEl.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out lat)
            && double.TryParse(lonEl.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out lon);
    }

    /// <summary>Propiedades y geometría de un `feature` de Photon.</summary>
    private static bool LeerLugarPhoton(JsonElement feature, out JsonElement props, out double lat, out double lon)
    {
        props = default;
        lat = 0;
        lon = 0;
        if (!feature.TryGetProperty("properties", out props) || props.ValueKind != JsonValueKind.Object) return false;
        if (!feature.TryGetProperty("geometry", out var geometry) ||
            !geometry.TryGetProperty("coordinates", out var coordenadas) ||
            coordenadas.ValueKind != JsonValueKind.Array || coordenadas.GetArrayLength() < 2) return false;
        // GeoJSON: [longitud, latitud].
        return coordenadas[0].TryGetDouble(out lon) && coordenadas[1].TryGetDouble(out lat);
    }

    /// <summary>
    /// Etiqueta legible estilo Google para resultados de Photon ("Nombre,
    /// Calle Núm, Colonia, Municipio, Estado"), sin repetir segmentos.
    /// </summary>
    private static string ConstruirNombrePhoton(JsonElement props)
    {
        var etiqueta = new Etiqueta();
        etiqueta.Agregar(TextoDe(props, "name"));
        var via = TextoDe(props, "street");
        var numero = TextoDe(props, "housenumber");
        if (via is not null)
            etiqueta.Agregar(numero is null ? via : $"{via} {numero}");
        etiqueta.AgregarPrimero(TextoDe(props, "locality"), TextoDe(props, "district"));
        etiqueta.AgregarPrimero(TextoDe(props, "city"), TextoDe(props, "county"), TextoDe(props, "district"));
        etiqueta.Agregar(TextoDe(props, "state"));
        return etiqueta.HayPartes ? etiqueta.ToString() : NombreFallback;
    }

    /// <summary>
    /// Constructor de etiquetas sin segmentos repetidos (misma regla para
    /// Nominatim y Photon): cada parte entra una sola vez sin distinguir
    /// mayúsculas y el primer grupo agrega solo su primer candidato nuevo.
    /// </summary>
    private sealed class Etiqueta
    {
        private readonly List<string> _partes = [];

        public bool HayPartes => _partes.Count > 0;

        public void Agregar(string? valor)
        {
            var limpio = valor?.Trim();
            if (string.IsNullOrEmpty(limpio)) return;
            if (_partes.Any(p => string.Equals(p, limpio, StringComparison.OrdinalIgnoreCase))) return;
            _partes.Add(limpio);
        }

        public void AgregarPrimero(params string?[] candidatos)
        {
            foreach (var candidato in candidatos)
            {
                var limpio = candidato?.Trim();
                if (string.IsNullOrEmpty(limpio)) continue;
                if (_partes.Any(p => string.Equals(p, limpio, StringComparison.OrdinalIgnoreCase))) continue;
                _partes.Add(limpio);
                return;
            }
        }

        public override string ToString() => string.Join(", ", _partes);
    }

    /// <summary>
    /// Estado y municipio del bloque `address` de Nominatim. El municipio se
    /// busca en las variantes que usa OSM según el tamaño del lugar.
    /// </summary>
    private static (string? Estado, string? Municipio) LeerEstadoMunicipio(JsonElement item)
    {
        if (!item.TryGetProperty("address", out var address) || address.ValueKind != JsonValueKind.Object)
            return (null, null);
        var estado = TextoDe(address, "state");
        var municipio = TextoDe(address, "city")
            ?? TextoDe(address, "town")
            ?? TextoDe(address, "village")
            ?? TextoDe(address, "municipality")
            ?? TextoDe(address, "county");
        return (estado, municipio);
    }

    private static string? TextoDe(JsonElement objeto, string propiedad)
    {
        if (!objeto.TryGetProperty(propiedad, out var valor) || valor.ValueKind != JsonValueKind.String)
            return null;
        var texto = valor.GetString()?.Trim();
        return string.IsNullOrEmpty(texto) ? null : texto;
    }

    /// <summary>
    /// true solo cuando el resultado declara un país distinto de México; sin
    /// bloque `address` no se puede afirmar y se conserva (upstream ya va
    /// acotado con countrycodes=mx cuando el motor lo soporta).
    /// </summary>
    private static bool EsDeOtroPais(JsonElement item)
    {
        if (!item.TryGetProperty("address", out var address) || address.ValueKind != JsonValueKind.Object)
            return false;
        var codigo = TextoDe(address, "country_code");
        return codigo is not null && !string.Equals(codigo, "mx", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Clave de comparación de etiquetas: minúsculas y espacios colapsados,
    /// para que dos textos visiblemente iguales cuenten como el mismo lugar.
    /// </summary>
    private static string NormalizarEtiqueta(string nombre) =>
        string.Join(' ', nombre.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToLowerInvariant();

    /// <summary>
    /// Etiqueta legible estilo Google ("Calle Núm, Colonia, Ciudad, Estado")
    /// armada del bloque `address`, sin repetir segmentos. Si no hay dirección
    /// útil cae al `display_name` de Nominatim.
    /// </summary>
    private static string ConstruirNombre(JsonElement item)
    {
        var display = TextoDe(item, "display_name");
        if (!item.TryGetProperty("address", out var address) || address.ValueKind != JsonValueKind.Object)
            return display ?? NombreFallback;

        var etiqueta = new Etiqueta();
        var via = TextoDe(address, "road") ?? TextoDe(address, "pedestrian") ?? TextoDe(address, "footway");
        var numero = TextoDe(address, "house_number");
        var nombre = TextoDe(item, "name");
        // En nodos de casa `name` repite la vía: si ya hay calle y número, sobra.
        if (nombre is not null && via is not null && string.Equals(nombre, via, StringComparison.OrdinalIgnoreCase))
            nombre = null;
        etiqueta.Agregar(nombre);
        if (via is not null)
            etiqueta.Agregar(numero is null ? via : $"{via} {numero}");
        etiqueta.AgregarPrimero(
            TextoDe(address, "suburb"), TextoDe(address, "neighbourhood"), TextoDe(address, "quarter"),
            TextoDe(address, "hamlet"), TextoDe(address, "locality"));
        etiqueta.AgregarPrimero(
            TextoDe(address, "city"), TextoDe(address, "town"), TextoDe(address, "village"),
            TextoDe(address, "municipality"), TextoDe(address, "county"));
        etiqueta.Agregar(TextoDe(address, "state"));

        return etiqueta.HayPartes ? etiqueta.ToString() : display ?? NombreFallback;
    }

    /// <summary>
    /// Valida y normaliza el viewbox de sesgo (esquina suroeste y noreste, con
    /// longitud antes de latitud, como Nominatim). Vacío/null => sin sesgo.
    /// </summary>
    private static string NormalizarViewbox(string? viewbox)
    {
        var crudo = (viewbox ?? string.Empty).Trim();
        if (crudo.Length == 0) return string.Empty;
        var partes = crudo.Split(',');
        if (partes.Length != 4 ||
            !double.TryParse(partes[0], NumberStyles.Float, CultureInfo.InvariantCulture, out var lon1) ||
            !double.TryParse(partes[1], NumberStyles.Float, CultureInfo.InvariantCulture, out var lat1) ||
            !double.TryParse(partes[2], NumberStyles.Float, CultureInfo.InvariantCulture, out var lon2) ||
            !double.TryParse(partes[3], NumberStyles.Float, CultureInfo.InvariantCulture, out var lat2) ||
            !double.IsFinite(lon1) || !double.IsFinite(lat1) || !double.IsFinite(lon2) || !double.IsFinite(lat2))
            throw new ArgumentException("viewbox debe ser cuatro números separados por comas.", nameof(viewbox));
        var minLon = Math.Min(lon1, lon2);
        var maxLon = Math.Max(lon1, lon2);
        var minLat = Math.Min(lat1, lat2);
        var maxLat = Math.Max(lat1, lat2);
        if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90)
            throw new ArgumentException("viewbox fuera de rango geográfico.", nameof(viewbox));
        static string Formato(double valor) => valor.ToString("0.####", CultureInfo.InvariantCulture);
        return $"{Formato(minLon)},{Formato(minLat)},{Formato(maxLon)},{Formato(maxLat)}";
    }
}
