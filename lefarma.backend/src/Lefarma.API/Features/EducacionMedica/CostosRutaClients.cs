using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Xml;
using Microsoft.Extensions.Caching.Memory;

namespace Lefarma.API.Features.EducacionMedica;

// Conectores fase 1: HttpClient vía IHttpClientFactory, timeouts explícitos,
// try/catch con fallback a seed y `fuente` siempre declarada.

public record RutaCarretera(double Km, double Horas, string Fuente);
public record PreciosGasolina(double Magna, double Premium, string Fuente);
public record HotelCercano(string Nombre, double DistKm);
public record ViajeBus(string Linea, DateTime Salida, DateTime Llegada, double PrecioDesde, double PrecioHasta, int? Asientos, string Fuente, string Url, string Nota);
public record ViajeVuelo(string Linea, DateTime Salida, DateTime Llegada, double PrecioDesde, double PrecioHasta, string Fuente, string Url, string Nota);

public interface IOsrmClient
{
    Task<RutaCarretera?> ObtenerRutaAsync(double latO, double lonO, double latD, double lonD, CancellationToken ct);
}

public interface IGasolinaClient
{
    Task<PreciosGasolina> ObtenerPreciosAsync(CancellationToken ct);
}

public interface IHotelesClient
{
    Task<List<HotelCercano>> BuscarCercanosAsync(double lat, double lon, CancellationToken ct);
}

public interface IClickBusClient
{
    Task<List<ViajeBus>> BuscarAsync(string origen, string destino, DateOnly fecha, double km, CancellationToken ct);
}

public interface IDistribusionClient
{
    /// <summary>retailerPartnerNumber=343401 solo como default documentado (sin credencial real en fase 1).</summary>
    Task<List<ViajeBus>> BuscarAsync(string origen, string destino, DateOnly fecha, double km, CancellationToken ct);
}

/// <summary>Fase 1: estimados etiquetados. Interfaz lista para un proveedor con llave.</summary>
public interface IVuelosClient
{
    Task<List<ViajeVuelo>> BuscarAsync(double kmAerea, string origen, string destino, DateOnly fecha, CancellationToken ct);
}

public class OsrmClient(IHttpClientFactory http) : IOsrmClient
{
    public async Task<RutaCarretera?> ObtenerRutaAsync(double latO, double lonO, double latD, double lonD, CancellationToken ct)
    {
        try
        {
            var client = http.CreateClient("costos-osrm");
            var url = $"https://router.project-osrm.org/route/v1/driving/{lonO},{latO};{lonD},{latD}?overview=false";
            using var res = await client.GetAsync(url, ct);
            res.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            var route = doc.RootElement.GetProperty("routes")[0];
            var km = route.GetProperty("distance").GetDouble() / 1000.0;
            var hrs = route.GetProperty("duration").GetDouble() / 3600.0;
            return new RutaCarretera(km, hrs, "OSRM/OpenStreetMap (en vivo)");
        }
        catch
        {
            return null;
        }
    }
}

public class CneGasolinaClient(IHttpClientFactory http, IMemoryCache cache) : IGasolinaClient
{
    private const string Url = "https://publicacionexterna.azurewebsites.net/publicaciones/prices";

    public async Task<PreciosGasolina> ObtenerPreciosAsync(CancellationToken ct)
    {
        if (cache.TryGetValue("costos-gasolina", out PreciosGasolina? cached) && cached is not null)
            return cached;
        try
        {
            var client = http.CreateClient("costos-cne");
            using var res = await client.GetAsync(Url, ct);
            res.EnsureSuccessStatusCode();
            var xml = await res.Content.ReadAsStringAsync(ct);
            var doc = new XmlDocument();
            doc.LoadXml(xml);
            var vals = new Dictionary<string, List<double>>
            {
                ["regular"] = [], ["premium"] = [], ["diesel"] = []
            };
            foreach (XmlNode n in doc.GetElementsByTagName("gas_price"))
            {
                var t = n.Attributes?["type"]?.Value;
                if (t is null || !vals.ContainsKey(t)) continue;
                if (double.TryParse(n.InnerText, System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture, out var v) && v > 0.5)
                    vals[t].Add(v);
            }
            if (vals.Values.Any(v => v.Count == 0)) throw new InvalidOperationException("CNE sin datos");
            var magna = vals["regular"].Average();
            var premium = vals["premium"].Average();
            var result = new PreciosGasolina(magna, premium, $"CNE oficial (prom. nacional {vals["regular"].Count} estaciones)");
            cache.Set("costos-gasolina", result, TimeSpan.FromHours(1));
            return result;
        }
        catch
        {
            return new PreciosGasolina(23.5, 25.5, "seed gasolina (CNE no respondió)");
        }
    }
}

public class OverpassHotelesClient(IHttpClientFactory http, IMemoryCache cache) : IHotelesClient
{
    public async Task<List<HotelCercano>> BuscarCercanosAsync(double lat, double lon, CancellationToken ct)
    {
        var key = $"costos-hoteles:{Math.Round(lat, 3)},{Math.Round(lon, 3)}";
        if (cache.TryGetValue(key, out List<HotelCercano>? cached) && cached is not null)
            return cached;
        try
        {
            var client = http.CreateClient("costos-overpass");
            var q = $"[out:json][timeout:12];(node(around:9000,{lat},{lon})[\"tourism\"=\"hotel\"];);out 8;";
            using var res = await client.PostAsync("https://overpass-api.de/api/interpreter",
                new StringContent("data=" + Uri.EscapeDataString(q), Encoding.UTF8, "application/x-www-form-urlencoded"), ct);
            res.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            var out_ = new List<HotelCercano>();
            foreach (var el in doc.RootElement.GetProperty("elements").EnumerateArray())
            {
                var hlat = el.GetProperty("lat").GetDouble();
                var hlon = el.GetProperty("lon").GetDouble();
                var nombre = el.TryGetProperty("tags", out var tags) && tags.TryGetProperty("name", out var nm)
                    ? nm.GetString() ?? "Hotel" : "Hotel";
                out_.Add(new HotelCercano(nombre, CostosRutaGeo.HaversineKm(lat, lon, hlat, hlon)));
            }
            var ordered = out_.OrderBy(h => h.DistKm).Take(5).ToList();
            cache.Set(key, ordered, TimeSpan.FromHours(6));
            return ordered;
        }
        catch
        {
            return [];
        }
    }
}

public class ClickBusClient(IHttpClientFactory http) : IClickBusClient
{
    public async Task<List<ViajeBus>> BuscarAsync(string origen, string destino, DateOnly fecha, double km, CancellationToken ct)
    {
        try
        {
            var client = http.CreateClient("costos-clickbus");
            using var res = await client.PostAsJsonAsync("https://adapter.clickbus.com.mx/api/trips/search",
                new { origin = origen, destination = destino, date = fecha.ToString("yyyy-MM-dd") }, ct);
            res.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            var viajes = new List<ViajeBus>();
            if (doc.RootElement.TryGetProperty("trips", out var trips))
            {
                foreach (var t in trips.EnumerateArray())
                {
                    var sal = t.GetProperty("departure").GetDateTime();
                    var arr = t.GetProperty("arrival").GetDateTime();
                    var precio = t.GetProperty("price").GetDouble();
                    int? asientos = t.TryGetProperty("seats", out var s) ? s.GetInt32() : null;
                    var linea = t.TryGetProperty("company", out var c) ? c.GetString() ?? "ClickBus" : "ClickBus";
                    viajes.Add(new ViajeBus(linea, sal, arr, precio, Math.Round(precio * 1.15, 2), asientos,
                        "ClickBus adapter (en vivo)",
                        $"https://www.clickbus.com.mx/trips?departure_date={fecha:yyyy-MM-dd}",
                        "horarios + precios + asientos del adapter"));
                }
            }
            if (viajes.Count > 0) return viajes;
            throw new InvalidOperationException("ClickBus sin viajes");
        }
        catch
        {
            return CostosRutaSeeds.ViajesBusSeed(fecha, km, "seed bus (ClickBus no respondió)");
        }
    }
}

public class DistribusionClient(IHttpClientFactory http) : IDistribusionClient
{
    private const string RetailerPartnerNumber = "343401";

    public async Task<List<ViajeBus>> BuscarAsync(string origen, string destino, DateOnly fecha, double km, CancellationToken ct)
    {
        try
        {
            var client = http.CreateClient("costos-distribusion");
            var url = $"https://book.api.distribusion.com/connections?retailerPartnerNumber={RetailerPartnerNumber}"
                + $"&origin={Uri.EscapeDataString(origen)}&destination={Uri.EscapeDataString(destino)}&date={fecha:yyyy-MM-dd}";
            using var res = await client.GetAsync(url, ct);
            res.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            var viajes = new List<ViajeBus>();
            if (doc.RootElement.TryGetProperty("connections", out var conns))
            {
                foreach (var c in conns.EnumerateArray())
                {
                    var sal = c.GetProperty("departure").GetDateTime();
                    var arr = c.GetProperty("arrival").GetDateTime();
                    var barato = c.TryGetProperty("cheapest_price", out var p) ? p.GetDouble() : 300;
                    int? asientos = c.TryGetProperty("seats_available", out var s) ? s.GetInt32() : null;
                    viajes.Add(new ViajeBus("Distribusion · red asociada", sal, arr, barato, Math.Round(barato * 1.15, 2),
                        asientos, "Distribusion (en vivo)",
                        "https://book.api.distribusion.com", "connections + seats + cheapest_prices"));
                }
            }
            if (viajes.Count > 0) return viajes;
            throw new InvalidOperationException("Distribusion sin conexiones");
        }
        catch
        {
            return CostosRutaSeeds.ViajesBusSeed(fecha, km, "seed bus (Distribusion no respondió; retailerPartnerNumber=343401 default sin credencial)")
                .Select(v => v with { Linea = v.Linea + " · vía Distribusion" }).ToList();
        }
    }
}

public class EstimadoVuelosClient : IVuelosClient
{
    public Task<List<ViajeVuelo>> BuscarAsync(double kmAerea, string origen, string destino, DateOnly fecha, CancellationToken ct)
    {
        var ft = 0.5 + kmAerea / 760.0;
        var base_ = 690 + kmAerea * 1.45;
        var lineas = new[]
        {
            ("VivaAerobus", 0.82, 6, 25, "ultra bajo costo", "https://www.vivaaerobus.com/es-mx"),
            ("Volaris", 0.90, 11, 5, "bajo costo", "https://www.volaris.com/"),
            ("Aeroméxico", 1.32, 17, 40, "servicio completo", "https://www.aeromexico.com/es-mx"),
        };
        var out_ = lineas.Select((l, ix) =>
        {
            var sal = fecha.ToDateTime(new TimeOnly(l.Item3, l.Item4));
            var arr = sal.AddHours(ft);
            var fare = base_ * l.Item2;
            return new ViajeVuelo(l.Item1, sal, arr, Math.Round(fare * 0.85, 2), Math.Round(fare * 1.18, 2),
                "estimado fase 1 (sin proveedor; interfaz IVuelosClient lista)",
                l.Item6, $"{l.Item5} · vuelo estimado {(1000 + (int)kmAerea % 900) + ix}");
        }).ToList();
        return Task.FromResult(out_);
    }
}
