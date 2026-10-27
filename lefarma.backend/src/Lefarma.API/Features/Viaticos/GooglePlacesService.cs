using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Lefarma.API.Features.Viaticos;

/// <summary>Hotel devuelto por una búsqueda (Google Places u OpenStreetMap).</summary>
public record HotelCercano(
    string Nombre,
    double DistKm,
    string Fuente = "OpenStreetMap/Nominatim",
    string? Link = null,
    double? Rating = null,
    int? RatingCount = null,
    string? Direccion = null,
    double Latitud = 0,
    double Longitud = 0);

/// <summary>
/// Búsqueda de hoteles en Google Places (Text Search) para que la lista sea de
/// hoteles locales reales. La configuración (habilitada, llave y radio) vive en
/// la tabla <c>viaticos.config_parametros</c>; sin llave el motor sigue con
/// OpenStreetMap.
/// </summary>
public static class GooglePlacesService
{
    private const string Endpoint = "https://places.googleapis.com/v1/places:searchText";

    /// <summary>
    /// Hoteles alrededor de un punto. Devuelve null si no hay llave o la API no
    /// responde, para que el motor caiga a OpenStreetMap.
    /// </summary>
    public static async Task<List<HotelCercano>?> BuscarHotelesAsync(
        HttpClient http, IMemoryCache cache, double lat, double lon, CancellationToken ct)
    {
        var habilitado = ConfiguracionViaticos.Booleano("google_places.habilitado", false);
        var apiKey = ConfiguracionViaticos.Texto("google_places.llave", string.Empty);
        if (!habilitado || string.IsNullOrWhiteSpace(apiKey)) return null;

        var radio = Math.Clamp(ConfiguracionViaticos.Double("google_places.radio_km", 8), 1, 50);
        var key = $"google-places:{Math.Round(lat, 3)},{Math.Round(lon, 3)}";
        if (cache.TryGetValue(key, out List<HotelCercano>? guardados) && guardados is not null)
            return guardados;

        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, Endpoint)
            {
                Content = JsonContent.Create(new
                {
                    textQuery = "hotel",
                    languageCode = "es",
                    regionCode = "MX",
                    maxResultCount = 10,
                    locationBias = new
                    {
                        circle = new
                        {
                            center = new { latitude = lat, longitude = lon },
                            radius = radio * 1000,
                        },
                    },
                }),
            };
            req.Headers.Add("X-Goog-Api-Key", apiKey);
            req.Headers.Add("X-Goog-FieldMask",
                "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri");

            using var res = await http.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode)
            {
                Serilog.Log.Warning("Google Places: {Status} al buscar hoteles cerca de {Lat},{Lon}", (int)res.StatusCode, lat, lon);
                return null;
            }
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            if (!doc.RootElement.TryGetProperty("places", out var places) || places.ValueKind != JsonValueKind.Array)
                return null;

            var salida = new List<HotelCercano>();
            foreach (var place in places.EnumerateArray())
            {
                var nombre = place.TryGetProperty("displayName", out var dn) && dn.TryGetProperty("text", out var txt)
                    ? txt.GetString() ?? "Hotel" : "Hotel";
                if (!place.TryGetProperty("location", out var loc)
                    || !loc.TryGetProperty("latitude", out var latEl)
                    || !loc.TryGetProperty("longitude", out var lonEl)) continue;
                var plat = latEl.GetDouble();
                var plon = lonEl.GetDouble();
                var rating = place.TryGetProperty("rating", out var rEl) && rEl.ValueKind == JsonValueKind.Number
                    ? rEl.GetDouble() : (double?)null;
                var conteo = place.TryGetProperty("userRatingCount", out var cEl) && cEl.ValueKind == JsonValueKind.Number
                    ? cEl.GetInt32() : (int?)null;
                var link = place.TryGetProperty("googleMapsUri", out var gEl) && gEl.ValueKind == JsonValueKind.String
                    ? gEl.GetString() : null;
                var direccion = place.TryGetProperty("formattedAddress", out var fEl) && fEl.ValueKind == JsonValueKind.String
                    ? fEl.GetString() : null;
                salida.Add(new HotelCercano(nombre, HaversineKm(lat, lon, plat, plon), "Google Places", link, rating, conteo, direccion, plat, plon));
            }

            var ordenados = salida.OrderBy(h => h.DistKm).Take(5).ToList();
            cache.Set(key, ordenados, TimeSpan.FromHours(6));
            return ordenados;
        }
        catch (Exception ex)
        {
            Serilog.Log.Warning("Google Places: falló la búsqueda cerca de {Lat},{Lon}: {Error}", lat, lon, ex.Message);
            return null;
        }
    }

    internal static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double radio = 6371.0;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
            + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180)
            * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 2 * radio * Math.Asin(Math.Sqrt(a));
    }
}
