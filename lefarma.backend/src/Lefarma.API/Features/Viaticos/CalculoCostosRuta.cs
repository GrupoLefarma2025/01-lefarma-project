using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Xml;
using Lefarma.API.Features.Viaticos.DTOs;
using Microsoft.Extensions.Caching.Memory;

namespace Lefarma.API.Features.Viaticos;

// Fase 1 (demo aislada): cálculo de itinerarios/costos. Stateless, sin BD.
// Una sola clase estática: normalización, cálculo, seeds y conectores HTTP
// viven aquí como métodos. Cero interfaces, cero servicios instanciables.
// El controller le pasa HttpClient (vía IHttpClientFactory) e IMemoryCache
// como parámetros; los timeouts por proveedor se aplican por llamada.
// Conectores: try/catch con fallback a seed y `fuente` siempre declarada.

public record RutaCarretera(double Km, double Horas, string Fuente, List<(double Lat, double Lon)>? Grafica = null);
public record PreciosGasolina(double Magna, double Premium, string Fuente);
public record ViajeBus(string Linea, DateTime Salida, DateTime Llegada, double PrecioDesde, double PrecioHasta, int? Asientos, string Fuente, string Url, string Nota,
    CostosRutaTerminal? TerminalOrigen = null, CostosRutaTerminal? TerminalDestino = null);
public record ViajeVuelo(string Linea, DateTime Salida, DateTime Llegada, double PrecioDesde, double PrecioHasta, string Fuente, string Url, string Nota);

public static class CalculoCostosRuta
{
    // RENDIMIENTO FIJO 12 km/L (fase 1: se ignora rendimiento_km_l de la entrada).
    public const double RendimientoKmL = 12.0;

    // Seeds MXN aprox (2025-2026), siempre etiquetados con su `fuente`.
    private static readonly Dictionary<string, (string Nombre, double Lat, double Lon, string? Iata)> Ciudades = new()
    {
        ["CDMX"] = ("Ciudad de México", 19.4326, -99.1332, "MEX"),
        ["GDL"] = ("Guadalajara", 20.6597, -103.3496, "GDL"),
        ["MTY"] = ("Monterrey", 25.6866, -100.3161, "MTY"),
        ["QRO"] = ("Querétaro", 20.5888, -100.3899, "QRO"),
        ["PUE"] = ("Puebla", 19.0414, -98.2063, "PBC"),
        ["CUN"] = ("Cancún", 21.1619, -86.8515, "CUN"),
        ["TIJ"] = ("Tijuana", 32.5149, -117.0382, "TIJ"),
        ["XAL"] = ("Xalapa", 19.5438, -96.9102, null),
        ["BJX"] = ("León", 21.1214, -101.6830, "BJX"),
    };

    /// <summary>
    /// Aeropuertos de las ciudades sembradas, con su coordenada real. Es la
    /// terminal a la que el viajero se traslada en taxi antes de volar y desde
    /// la que sale al llegar; el mapa del resumen dibuja ese traslado.
    /// </summary>
    private static readonly Dictionary<string, (string Nombre, double Lat, double Lon)> Aeropuertos = new()
    {
        ["MEX"] = ("Aeropuerto Internacional Benito Juárez (MEX)", 19.4361, -99.0719),
        ["GDL"] = ("Aeropuerto Internacional de Guadalajara (GDL)", 20.5218, -103.3111),
        ["MTY"] = ("Aeropuerto Internacional de Monterrey (MTY)", 25.7785, -100.1064),
        ["QRO"] = ("Aeropuerto Intercontinental de Querétaro (QRO)", 20.6173, -100.1857),
        ["PBC"] = ("Aeropuerto Internacional de Puebla (PBC)", 19.1581, -98.3716),
        ["CUN"] = ("Aeropuerto Internacional de Cancún (CUN)", 21.0365, -86.8771),
        ["TIJ"] = ("Aeropuerto Internacional de Tijuana (TIJ)", 32.5411, -116.9700),
        ["BJX"] = ("Aeropuerto Internacional del Bajío (BJX)", 20.9935, -101.4808),
    };

    /// <summary>
    /// Central de autobuses principal de cada ciudad sembrada. Una ciudad puede
    /// tener varias terminales: se usa la central de referencia y el resumen la
    /// etiqueta como terminal, no como dirección exacta de ventanilla.
    /// </summary>
    private static readonly Dictionary<string, (string Nombre, double Lat, double Lon)> Centrales = new()
    {
        ["CDMX"] = ("Central de Autobuses del Norte (CDMX)", 19.4789, -99.1383),
        ["GDL"] = ("Central Nueva de Autobuses (Guadalajara)", 20.6226, -103.3290),
        ["MTY"] = ("Central de Autobuses de Monterrey", 25.6866, -100.2980),
        ["QRO"] = ("Terminal de Autobuses de Querétaro", 20.5960, -100.4040),
        ["PUE"] = ("CAPU, Central de Autobuses de Puebla", 19.0700, -98.2460),
        ["CUN"] = ("Terminal de Autobuses de Cancún", 21.1619, -86.8515),
        ["TIJ"] = ("Central de Autobuses de Tijuana", 32.5149, -117.0382),
        ["XAL"] = ("Terminal de Autobuses de Xalapa (CAXA)", 19.5438, -96.9102),
        ["BJX"] = ("Terminal de Autobuses de León", 21.1214, -101.6830),
    };

    private static readonly Dictionary<string, double> CasetasIda = new()    {
        ["CDMX-GDL"] = 950, ["CDMX-MTY"] = 1180, ["CDMX-QRO"] = 330, ["CDMX-PUE"] = 180,
        ["GDL-MTY"] = 900, ["CDMX-CUN"] = 1450, ["GDL-CUN"] = 1250,
    };

    private static readonly Dictionary<string, (double Base, double PorKm)> Taxi = new()
    {
        ["CDMX"] = (30, 11), ["GDL"] = (28, 10), ["MTY"] = (30, 12), ["QRO"] = (25, 10),
        ["PUE"] = (27, 10), ["CUN"] = (35, 13), ["TIJ"] = (32, 12),
        ["XAL"] = (27, 10), ["BJX"] = (28, 10),
    };

    private static readonly Dictionary<string, (double ComidaDia, double HospedajeNoche)> Viaticos = new()
    {
        ["CDMX"] = (811, 3533), ["GDL"] = (653, 2006), ["MTY"] = (674, 2353), ["QRO"] = (596, 1700),
        ["PUE"] = (546, 1500), ["CUN"] = (627, 2300), ["TIJ"] = (640, 2100),
        ["XAL"] = (546, 1500), ["BJX"] = (596, 1700),
    };

    // Fuente de la unica entrada valuada de un pernocte (tarifa tabulador).
    // Las alternativas de Overpass no traen precio propio: son un menu.
    private const string FuenteTabuladorHotel = "seed tabulador SHCP";

    private const double CasetaPorKm = 1.4;
    // Instancias de Overpass: la pública se cae o se satura seguido, se prueban en orden.
    private static readonly string[] OverpassInstancias =
    [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.private.coffee/api/interpreter",
    ];
    private const double ComidaDiaEstandar = 600;

    // ---------- Configuración (tabla viaticos.config_parametros) ----------
    // Los valores por defecto viven aquí; la tabla de configuración los
    // sobreescribe sin tocar el código.

    private static double RendimientoEfectivo() => ConfiguracionViaticos.Double("costos.rendimiento_km_l", RendimientoKmL);
    private static double CasetaPorKmEfectivo() => ConfiguracionViaticos.Double("costos.caseta_por_km", CasetaPorKm);
    private static double ComidaDiaEfectiva() => (double)ConfiguracionViaticos.Decimal("costos.comida_dia", 600m);

    private static (double Base, double Km) TarifaTaxi(string ciudad)
    {
        var (base_, km) = Taxi.GetValueOrDefault(ciudad, (30, 11));
        return (
            ConfiguracionViaticos.Double($"costos.taxi_base.{ciudad}", base_),
            ConfiguracionViaticos.Double($"costos.taxi_km.{ciudad}", km));
    }
    private const int BufferMin = 30;
    private const double SnapKm = 25.0;
    private const string UberEstimateUrl = "https://www.uber.com/mx/es/price-estimate/";
    private const string DidiUrl = "https://web.didiglobal.com/mx/pasajero/";
    private const string PreciosCneUrl = "https://publicacionexterna.azurewebsites.net/publicaciones/prices";
    // retailerPartnerNumber=343401 solo como default documentado (sin credencial real en fase 1).
    private const string RetailerPartnerNumber = "343401";

    private static readonly string[] CategoriasSalida =
        ["aviones", "autobuses", "hoteles", "autos", "renta_autos", "taxis_uber", "trenes", "ferris", "transporte_publico"];

    private static readonly Dictionary<string, string> CatDeModo = new()
    {
        ["avion"] = "aviones", ["bus"] = "autobuses", ["auto"] = "autos",
        ["renta"] = "renta_autos", ["uber"] = "taxis_uber",
        // "publico" es el transporte urbano (metro, metrobús, tren ligero o
        // camión). "metro" se conserva porque hay cálculos ya guardados con esa
        // clave: el modo se llamaba así cuando solo existía CDMX.
        ["publico"] = "transporte_publico", ["metro"] = "transporte_publico",
    };

    private sealed record LugarNorm(int Orden, string Tipo, string Nombre, double Lat, double Lon,
        DateTime? Salida, DateTime? Llegada, DateTime? Deadline, DateTime? Fin, DateTime? FinActividad, bool Propuesto,
        string Municipio, string Estado);

    private sealed record PersonaNorm(string Nombre, bool CarroPropio, string Gasolina, bool Draft,
        TimeOnly HIn, TimeOnly HOut, int DIn, int DOut, List<LugarNorm> Lugares);

    private sealed record OpCalc(string Modo, string Linea, string Codigo, DateTime Salida, DateTime Llegada,
        double PuertaH, int OverheadMin, double Lo, double Hi, double CostoGrupo, bool PorPersona,
        double? Litros, double? PrecioLitro, double? CasetasVal, double? TarifaDia,
        bool Late, bool SaleAntes, int LateMin, string Fuente, bool Estimado, string Nota,
        string Url, string Sitio, string Accion, string Objetivo, string Badge,
        // Terminal real que informa el proveedor (ClickBus). Null = usar la sembrada.
        CostosRutaTerminal? TerminalOrigenDato = null, CostosRutaTerminal? TerminalDestinoDato = null);

    private sealed record TramoCalc(string From, string To, double Km, double Hrs, List<OpCalc> Opciones,
        List<(double Lat, double Lon)>? Grafica = null);
    private sealed record ComparteInfo(int N, string? Conductor);

    // ---------- Geo ----------

    public static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        var la1 = double.DegreesToRadians(lat1);
        var lo1 = double.DegreesToRadians(lon1);
        var la2 = double.DegreesToRadians(lat2);
        var lo2 = double.DegreesToRadians(lon2);
        var h = Math.Pow(Math.Sin((la2 - la1) / 2), 2)
            + Math.Cos(la1) * Math.Cos(la2) * Math.Pow(Math.Sin((lo2 - lo1) / 2), 2);
        return 2 * 6371.0 * Math.Asin(Math.Sqrt(h));
    }

    // ---------- Seeds ----------

    private static (string? Key, double Dist) SnapCiudad(double lat, double lon)
    {
        string? mejor = null;
        var md = double.MaxValue;
        foreach (var (k, c) in Ciudades)
        {
            var d = HaversineKm(lat, lon, c.Lat, c.Lon);
            if (d < md) { md = d; mejor = k; }
        }
        return md <= SnapKm ? (mejor, md) : (null, md);
    }

    private static List<ViajeBus> ViajesBusSeed(DateOnly fecha, double km, string fuente)
    {
        var base_ = 250 + km * 1.05;
        var lineas = new[]
        {
            ("ETN Turistar", 1.30, 0.92, 22, 30, "https://etn.com.mx", "nocturno, directo"),
            ("ADO Gl / Platino", 1.25, 1.00, 8, 0, "https://www.ado.com.mx", "matutino"),
            ("Primera Plus", 1.10, 1.02, 14, 30, "https://www.primeraplus.com.mx", "vespertino"),
        };
        return lineas.Select(l =>
        {
            var dur = km / 72.0 + 0.5;
            dur *= l.Item3;
            var sal = fecha.ToDateTime(new TimeOnly(l.Item4, l.Item5));
            var arr = sal.AddHours(dur);
            var fare = base_ * l.Item2;
            // Precio unico tambien en el estimado: el rango deja de existir como
            // formato. La etiqueta "Estimado" es la que advierte que no es cotizacion.
            var precio = Math.Round(fare, 2);
            return new ViajeBus(l.Item1, sal, arr, precio, precio, null, fuente, l.Item6, l.Item7);
        }).ToList();
    }

    // ---------- Clientes HTTP ----------

    public static async Task<RutaCarretera?> ObtenerRutaOsrmAsync(HttpClient http,
        double latO, double lonO, double latD, double lonD, CancellationToken ct)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(8));
            var t = cts.Token;
            var url = $"https://router.project-osrm.org/route/v1/driving/{lonO},{latO};{lonD},{latD}?overview=full&geometries=geojson";
            using var res = await http.GetAsync(url, t);
            res.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(t), cancellationToken: t);
            var route = doc.RootElement.GetProperty("routes")[0];
            var km = route.GetProperty("distance").GetDouble() / 1000.0;
            var hrs = route.GetProperty("duration").GetDouble() / 3600.0;
            // Trazado de la carretera (para el mapa): se simplifica a 300 puntos.
            var grafica = new List<(double Lat, double Lon)>();
            if (route.TryGetProperty("geometry", out var geo) && geo.TryGetProperty("coordinates", out var coords)
                && coords.ValueKind == JsonValueKind.Array)
            {
                var total = coords.GetArrayLength();
                var paso = Math.Max(1, total / 300);
                for (var i = 0; i < total; i++)
                {
                    if (i % paso != 0 && i != total - 1) continue;
                    var par = coords[i];
                    grafica.Add((par[1].GetDouble(), par[0].GetDouble()));
                }
            }
            return new RutaCarretera(km, hrs, "OSRM/OpenStreetMap (en vivo)", grafica);
        }
        catch
        {
            return null;
        }
    }

    public static async Task<PreciosGasolina> ObtenerPreciosGasolinaAsync(HttpClient http, IMemoryCache cache, CancellationToken ct)
    {
        if (cache.TryGetValue("costos-gasolina", out PreciosGasolina? cached) && cached is not null)
            return cached;
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(15));
            var t = cts.Token;
            using var res = await http.GetAsync(PreciosCneUrl, t);
            res.EnsureSuccessStatusCode();
            var xml = await res.Content.ReadAsStringAsync(t);
            var doc = new XmlDocument();
            doc.LoadXml(xml);
            var vals = new Dictionary<string, List<double>>
            {
                ["regular"] = [], ["premium"] = [], ["diesel"] = []
            };
            foreach (XmlNode n in doc.GetElementsByTagName("gas_price"))
            {
                var type = n.Attributes?["type"]?.Value;
                if (type is null || !vals.ContainsKey(type)) continue;
                if (double.TryParse(n.InnerText, System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture, out var v) && v > 0.5)
                    vals[type].Add(v);
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

    public static async Task<List<HotelCercano>> BuscarHotelesCercanosAsync(HttpClient http, IMemoryCache cache,
        double lat, double lon, CancellationToken ct)
    {
        // 1) Google Places (hoteles locales reales) si hay llave configurada.
        var deGoogle = await GooglePlacesService.BuscarHotelesAsync(http, cache, lat, lon, ct);
        if (deGoogle is not null && deGoogle.Count > 0) return deGoogle;

        var key = $"costos-hoteles-v5:{Math.Round(lat, 3)},{Math.Round(lon, 3)}";
        if (cache.TryGetValue(key, out List<HotelCercano>? cached) && cached is not null)
            return cached;

        // Nominatim responde rápido y trae el nombre del hotel; Overpass queda como respaldo.
        var porNominatim = await BuscarHotelesNominatimAsync(http, lat, lon, ct);
        if (porNominatim.Count > 0)
        {
            cache.Set(key, porNominatim, TimeSpan.FromHours(6));
            return porNominatim;
        }

        var q = $"[out:json][timeout:10];(nwr(around:5000,{lat},{lon})[\"tourism\"=\"hotel\"];);out center 8;";
        // Overpass público se cae o se satura seguido: se prueban instancias alternas.
        foreach (var instancia in OverpassInstancias)
        {
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(TimeSpan.FromSeconds(8));
                var t = cts.Token;
                var url = instancia + "?data=" + Uri.EscapeDataString(q);
                using var res = await http.GetAsync(url, t);
                if (!res.IsSuccessStatusCode) continue;
                using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(t), cancellationToken: t);
                var out_ = new List<HotelCercano>();
                foreach (var el in doc.RootElement.GetProperty("elements").EnumerateArray())
                {
                    var hlat = Coordenada(el, "lat");
                    var hlon = Coordenada(el, "lon");
                    if (double.IsNaN(hlat) || double.IsNaN(hlon))
                    {
                        if (!el.TryGetProperty("center", out var center)) continue;
                        hlat = Coordenada(center, "lat");
                        hlon = Coordenada(center, "lon");
                        if (double.IsNaN(hlat) || double.IsNaN(hlon)) continue;
                    }
                    var nombre = el.TryGetProperty("tags", out var tags) && tags.TryGetProperty("name", out var nm)
                        ? nm.GetString() ?? "Hotel" : "Hotel";
                    out_.Add(new HotelCercano(nombre, HaversineKm(lat, lon, hlat, hlon), "OpenStreetMap/Overpass", null, null, null, null, hlat, hlon));
                }
                var ordered = out_.OrderBy(h => h.DistKm).Take(5).ToList();
                cache.Set(key, ordered, TimeSpan.FromHours(6));
                return ordered;
            }
            catch
            {
                // intenta la siguiente instancia
            }
        }
        return [];
    }

    /// <summary>Hoteles cercanos vía Nominatim (rápido); devuelve nombre y distancia al punto.</summary>
    private static async Task<List<HotelCercano>> BuscarHotelesNominatimAsync(HttpClient http,
        double lat, double lon, CancellationToken ct)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(6));
            var t = cts.Token;
            var dLat = 0.05;
            var dLon = 0.05;
            var viewbox = $"{lon - dLon},{lat + dLat},{lon + dLon},{lat - dLat}";
            var url = $"https://nominatim.openstreetmap.org/search?q=hotel&format=jsonv2&limit=10" +
                      $"&countrycodes=mx&viewbox={viewbox}&bounded=1&addressdetails=0";
            using var res = await http.GetAsync(url, t);
            if (!res.IsSuccessStatusCode) return [];
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(t), cancellationToken: t);
            var out_ = new List<HotelCercano>();
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                var esHotel = (el.TryGetProperty("type", out var tEl) && tEl.GetString() == "hotel")
                    || (el.TryGetProperty("category", out var cEl) && cEl.GetString() == "hotel");
                if (!esHotel) continue;
                // Nominatim devuelve lat/lon como texto.
                var hlat = Coordenada(el, "lat");
                var hlon = Coordenada(el, "lon");
                if (double.IsNaN(hlat) || double.IsNaN(hlon)) continue;
                var nombre = el.TryGetProperty("name", out var nEl) && !string.IsNullOrWhiteSpace(nEl.GetString())
                    ? nEl.GetString()!
                    : el.TryGetProperty("display_name", out var dEl) ? dEl.GetString() ?? "Hotel" : "Hotel";
                out_.Add(new HotelCercano(nombre, HaversineKm(lat, lon, hlat, hlon), "OpenStreetMap/Nominatim", null, null, null, null, hlat, hlon));
            }
            return out_.OrderBy(h => h.DistKm).Take(5).ToList();
        }
        catch
        {
            return [];
        }
    }

    /// <summary>Lee una coordenada que puede venir como número o como texto (jsonv2 de Nominatim).</summary>
    private static double Coordenada(JsonElement el, string propiedad)
    {
        if (!el.TryGetProperty(propiedad, out var v)) return double.NaN;
        if (v.ValueKind == JsonValueKind.Number) return v.GetDouble();
        return double.TryParse(v.GetString(), System.Globalization.CultureInfo.InvariantCulture, out var d)
            ? d
            : double.NaN;
    }

    // El adapter de ClickBus expone su propio catalogo de lugares (1,642 destinos).
    private const string ClickBusAdapterBase = "https://adapter.clickbus.com.mx/api";

    /// <summary>Lugar del catalogo de ClickBus (`places/get-all`).</summary>
    private sealed record LugarClickBus(string Slug, string Nombre, string Ciudad, string Tipo, string Estado);

    /// <summary>
    /// Viajes reales de autobus desde el adapter de ClickBus.
    ///
    /// Firma real del endpoint, descubierta leyendo el bundle del sitio (la que
    /// usaba antes este metodo — POST con origin/destination/date — respondia
    /// 405 con POST y 422/500 con GET):
    /// <c>GET {base}/trips/search?from={slug}&amp;to={slug}&amp;departure=YYYY-MM-DD&amp;currency=MXN&amp;return=</c>
    /// <c>return</c> tiene que ir presente aunque vaya vacio: sin el, el adapter
    /// responde 500. El precio viaja en centavos como texto dentro de
    /// <c>trips.going[].parts[]</c> (<c>offer</c> con descuento manda sobre <c>price</c>).
    ///
    /// Si la ruta no existe en el catalogo (caso real: Xicotlan) o el adapter
    /// falla, devuelve lista vacia. El respaldo a estimado vive en
    /// <see cref="CalcularTramoAsync"/>, que solo estima cuando NINGUN proveedor
    /// cotizo: asi el estimado nunca aparece como una fila mas al lado de un
    /// precio real.
    /// </summary>
    public static async Task<List<ViajeBus>> BuscarBusesClickBusAsync(HttpClient http,
        string origen, string destino, DateOnly fecha, IMemoryCache cache, CancellationToken ct,
        string? estadoOrigen = null, string? estadoDestino = null)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(12));
            var t = cts.Token;

            var lugares = await ObtenerLugaresClickBusAsync(http, cache, t);
            var slugOrigen = ResolverSlugClickBus(lugares, origen, estadoOrigen);
            var slugDestino = ResolverSlugClickBus(lugares, destino, estadoDestino);
            if (slugOrigen is null || slugDestino is null)
                throw new InvalidOperationException($"ClickBus no tiene {origen} → {destino} en su catalogo");

            var url = $"{ClickBusAdapterBase}/trips/search?from={slugOrigen}&to={slugDestino}"
                + $"&departure={fecha:yyyy-MM-dd}&currency=MXN&return=";
            // Enlace publico de resultados con la misma ruta y fecha. Es el que
            // se usa para "ver costo del boleto" y para la captura de pantalla:
            // los parametros reales del sitio son departure_place/arrival_place
            // (no origin/destination).
            var urlCompra = $"https://www.clickbus.com.mx/trips?departure_place={slugOrigen}"
                + $"&arrival_place={slugDestino}&departure_date={fecha:yyyy-MM-dd}&minPrice=0&maxPrice=5000";
            using var res = await http.GetAsync(url, t);
            res.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(t), cancellationToken: t);

            if (!doc.RootElement.TryGetProperty("trips", out var trips)
                || trips.ValueKind != JsonValueKind.Object
                || !trips.TryGetProperty("going", out var going)
                || going.ValueKind != JsonValueKind.Array)
            {
                throw new InvalidOperationException("ClickBus sin viajes");
            }

            var viajes = new List<ViajeBus>();
            foreach (var trip in going.EnumerateArray())
            {
                if (!trip.TryGetProperty("parts", out var parts)
                    || parts.ValueKind != JsonValueKind.Array
                    || parts.GetArrayLength() == 0) continue;

                DateTime? salida = null;
                DateTime? llegada = null;
                var precio = 0.0;
                var linea = "ClickBus";
                int? asientos = null;
                string? estacionOrigen = null;
                string? estacionDestino = null;

                foreach (var part in parts.EnumerateArray())
                {
                    if (part.TryGetProperty("departure", out var dep))
                    {
                        precio += PrecioClickBus(dep);
                        salida ??= FechaHoraClickBus(dep);
                        estacionOrigen ??= NombreEstacionClickBus(dep);
                    }
                    if (part.TryGetProperty("arrival", out var arr))
                    {
                        llegada = FechaHoraClickBus(arr) ?? llegada;
                        estacionDestino = NombreEstacionClickBus(arr) ?? estacionDestino;
                    }
                    if (part.TryGetProperty("busCompany", out var empresa)
                        && empresa.TryGetProperty("name", out var nombreEmpresa))
                        linea = nombreEmpresa.GetString() ?? linea;
                    if (part.TryGetProperty("availableSeats", out var asientosParte)
                        && asientosParte.ValueKind == JsonValueKind.Number)
                        asientos = asientosParte.GetInt32();
                }

                if (salida is null || llegada is null || precio <= 0) continue;

                // Terminal real del proveedor, con coordenadas geocodificadas
                // (cache 24 h). Si no se puede geocodificar, el nombre se
                // conserva y la coordenada queda en 0.
                var terminalOrigen = await TerminalGeocodificadaAsync(http, cache, estacionOrigen, ct);
                var terminalDestino = await TerminalGeocodificadaAsync(http, cache, estacionDestino, ct);

                // Precio unico: el cotizado es el que se cobra. Nunca se le suma un
                // margen ni se convierte en rango (regla: solo precios reales).
                var total = Math.Round(precio, 2);
                viajes.Add(new ViajeBus(linea, salida.Value, llegada.Value, total, total, asientos,
                    "ClickBus (en vivo)", urlCompra,
                    "precio y horario del adapter de ClickBus",
                    terminalOrigen, terminalDestino));
            }

            return viajes;
        }
        catch
        {
            return new List<ViajeBus>();
        }
    }

    /// <summary>
    /// Catalogo de lugares de ClickBus (slug + nombre + ciudad + tipo de terminal).
    /// Se cachea 12 h: son 1,642 destinos y cambia poco.
    /// </summary>
    private static async Task<List<LugarClickBus>> ObtenerLugaresClickBusAsync(
        HttpClient http, IMemoryCache cache, CancellationToken ct)
    {
        const string clave = "costos:clickbus:places";
        if (cache.TryGetValue(clave, out List<LugarClickBus>? cacheados) && cacheados is not null)
            return cacheados;

        var lugares = new List<LugarClickBus>();
        try
        {
            using var res = await http.GetAsync($"{ClickBusAdapterBase}/places/get-all", ct);
            res.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            if (doc.RootElement.TryGetProperty("places", out var places) && places.ValueKind == JsonValueKind.Array)
            {
                foreach (var p in places.EnumerateArray())
                {
                    var slug = p.TryGetProperty("slug", out var s) ? s.GetString() ?? "" : "";
                    if (slug.Length == 0) continue;
                    lugares.Add(new LugarClickBus(
                        slug,
                        p.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "",
                        p.TryGetProperty("city", out var c) ? c.GetString() ?? "" : "",
                        p.TryGetProperty("terminal_type", out var tt) ? tt.GetString() ?? "" : "",
                        p.TryGetProperty("place", out var place)
                            && place.TryGetProperty("state", out var state)
                            && state.TryGetProperty("name", out var nombreEstado)
                            && nombreEstado.ValueKind == JsonValueKind.String
                                ? nombreEstado.GetString() ?? ""
                                : ""));
                }
            }
        }
        catch
        {
            return lugares; // sin catalogo: el llamador cae al respaldo
        }

        if (lugares.Count > 0) cache.Set(clave, lugares, TimeSpan.FromHours(12));
        return lugares;
    }

    /// <summary>
    /// Nombre de ciudad del viaje -> slug de ClickBus. La comparacion ignora
    /// acentos y mayusculas y prefiere la entrada "Todas las Terminales".
    /// Devuelve null cuando el destino no existe en el catalogo (caso real:
    /// Xicotlan no esta entre los 1,642 destinos de ClickBus).
    /// </summary>
    private static string? ResolverSlugClickBus(List<LugarClickBus> lugares, string nombre, string? estado = null)
    {
        if (lugares.Count == 0) return null;
        var buscado = NormalizarTexto(nombre);
        if (buscado.Length == 0) return null;
        var estadoBuscado = NormalizarTexto(estado ?? "");

        static bool EsGrupo(LugarClickBus l) =>
            l.Tipo.Contains("Todas las Terminales", StringComparison.OrdinalIgnoreCase);

        var todos = lugares
            .Where(l => !string.IsNullOrWhiteSpace(l.Ciudad))
            .Select(l => new
            {
                Lugar = l,
                Ciudad = NormalizarTexto(l.Ciudad),
                Nombre = NormalizarTexto(l.Nombre),
                Estado = NormalizarTexto(l.Estado),
            })
            .ToList();

        // El estado del viaje desambigua: "Victoria de Durango" (Durango) no es
        // la "Victoria" de Texas, ni "Ciudad Victoria" (Tamaulipas) es esa misma.
        var candidatos = estadoBuscado.Length > 0
            ? todos.Where(x => x.Estado.Length > 0
                && (x.Estado == estadoBuscado
                    || x.Estado.Contains(estadoBuscado, StringComparison.Ordinal)
                    || estadoBuscado.Contains(x.Estado, StringComparison.Ordinal))).ToList()
            : todos;
        if (candidatos.Count == 0) candidatos = todos;

        var coincidencias = candidatos.Where(x => x.Ciudad == buscado).ToList();
        if (coincidencias.Count == 0)
            coincidencias = candidatos
                .Where(x => x.Ciudad.StartsWith(buscado, StringComparison.Ordinal)
                         || buscado.StartsWith(x.Ciudad, StringComparison.Ordinal)).ToList();
        if (coincidencias.Count == 0)
            // El municipio contiene el nombre de la ciudad ("Victoria de Durango"
            // contiene "Durango"): gana la coincidencia mas larga.
            coincidencias = candidatos
                .Where(x => buscado.Contains(x.Ciudad, StringComparison.Ordinal))
                .OrderByDescending(x => x.Ciudad.Length)
                .ToList();
        if (coincidencias.Count == 0)
            coincidencias = candidatos.Where(x => x.Nombre.Contains(buscado, StringComparison.Ordinal)).ToList();
        if (coincidencias.Count == 0) return null;

        return coincidencias
            .OrderByDescending(x => EsGrupo(x.Lugar))
            .ThenBy(x => x.Lugar.Nombre.Length)
            .First().Lugar.Slug;
    }

    /// <summary>Minusculas, sin acentos y sin espacios sobrantes, para comparar nombres de lugar.</summary>
    private static string NormalizarTexto(string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "";
        var descompuesto = s.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(descompuesto.Length);
        foreach (var ch in descompuesto)
        {
            if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(ch)
                == System.Globalization.UnicodeCategory.NonSpacingMark) continue;
            sb.Append(ch);
        }
        return sb.ToString().Trim().ToLowerInvariant();
    }

    /// <summary>
    /// Precio del adapter en pesos. Llega en centavos como texto; `offer` (con
    /// descuento) manda sobre `price` (tarifa de lista).
    /// </summary>
    private static double PrecioClickBus(JsonElement nodo)
    {
        foreach (var propiedad in new[] { "offer", "price" })
        {
            if (!nodo.TryGetProperty(propiedad, out var v)) continue;
            var texto = v.ValueKind == JsonValueKind.String ? v.GetString() : v.ToString();
            if (double.TryParse(texto, System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var centavos) && centavos > 0)
                return centavos / 100.0;
        }
        return 0;
    }

    /// <summary>Fecha y hora naive del adapter (`date` y `time` vienen separados).</summary>
    private static DateTime? FechaHoraClickBus(JsonElement nodo)
    {
        if (!nodo.TryGetProperty("waypoint", out var wp)
            || !wp.TryGetProperty("schedule", out var schedule)) return null;
        var fecha = schedule.TryGetProperty("date", out var d) ? d.GetString() : null;
        var hora = schedule.TryGetProperty("time", out var h) ? h.GetString() : null;
        if (string.IsNullOrWhiteSpace(fecha) || string.IsNullOrWhiteSpace(hora)) return null;
        return DateTime.TryParse($"{fecha}T{hora}", System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.None, out var dt) ? dt : null;
    }

    /// <summary>
    /// Nombre de la estacion (terminal) que informa ClickBus para un extremo del
    /// viaje: `waypoint.place.station.current.name`; si no viene, la ciudad.
    /// </summary>
    private static string? NombreEstacionClickBus(JsonElement nodo)
    {
        if (!nodo.TryGetProperty("waypoint", out var wp)
            || !wp.TryGetProperty("place", out var place)) return null;

        if (place.TryGetProperty("station", out var station)
            && station.TryGetProperty("current", out var actual)
            && actual.TryGetProperty("name", out var nombre)
            && nombre.ValueKind == JsonValueKind.String
            && !string.IsNullOrWhiteSpace(nombre.GetString()))
            return nombre.GetString();

        return place.TryGetProperty("city", out var ciudad) && ciudad.ValueKind == JsonValueKind.String
            ? ciudad.GetString()
            : null;
    }

    /// <summary>
    /// Nombre de terminal -> terminal con coordenadas. Geocodifica con Nominatim
    /// una sola vez por nombre (cache 24 h, incluidos los fallos) porque las
    /// terminales de ClickBus no traen latitud/longitud en su API.
    /// </summary>
    private static async Task<CostosRutaTerminal?> TerminalGeocodificadaAsync(
        HttpClient http, IMemoryCache cache, string? nombre, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(nombre)) return null;
        var limpio = nombre.Trim();
        var clave = "terminal-geo:" + limpio.ToLowerInvariant();
        if (cache.TryGetValue(clave, out CostosRutaTerminal? guardada)) return guardada;

        try
        {
            var url = $"https://nominatim.openstreetmap.org/search?q={Uri.EscapeDataString(limpio)}"
                + "&format=jsonv2&limit=1&countrycodes=mx";
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.UserAgent.ParseAdd("LefarmaViaticos/1.0 (sistemas@grupolefarma.com.mx)");
            using var res = await http.SendAsync(req, ct);
            res.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            if (doc.RootElement.ValueKind != JsonValueKind.Array || doc.RootElement.GetArrayLength() == 0)
            {
                // Sin resultado del geocoder se conserva el nombre real de la
                // terminal: perderlo por una coordenada faltante seria peor.
                var sinPunto = new CostosRutaTerminal { Nombre = limpio };
                cache.Set(clave, sinPunto, TimeSpan.FromHours(24));
                return sinPunto;
            }

            var el = doc.RootElement[0];
            if (!double.TryParse(el.GetProperty("lat").GetString(), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var lat)
                || !double.TryParse(el.GetProperty("lon").GetString(), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var lon))
            {
                var sinPunto = new CostosRutaTerminal { Nombre = limpio };
                cache.Set(clave, sinPunto, TimeSpan.FromHours(24));
                return sinPunto;
            }

            var terminal = new CostosRutaTerminal { Nombre = limpio, Latitud = lat, Longitud = lon };
            cache.Set(clave, terminal, TimeSpan.FromHours(24));
            return terminal;
        }
        catch
        {
            // Nominatim caido o lento: nombre si, coordenadas no.
            var sinPunto = new CostosRutaTerminal { Nombre = limpio };
            cache.Set(clave, sinPunto, TimeSpan.FromHours(1));
            return sinPunto;
        }
    }

    public static async Task<List<ViajeBus>> BuscarBusesDistribusionAsync(HttpClient http,
        string origen, string destino, DateOnly fecha, CancellationToken ct)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(10));
            var t = cts.Token;
            var url = $"https://book.api.distribusion.com/connections?retailerPartnerNumber={RetailerPartnerNumber}"
                + $"&origin={Uri.EscapeDataString(origen)}&destination={Uri.EscapeDataString(destino)}&date={fecha:yyyy-MM-dd}";
            using var res = await http.GetAsync(url, t);
            res.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(t), cancellationToken: t);
            var viajes = new List<ViajeBus>();
            if (doc.RootElement.TryGetProperty("connections", out var conns))
            {
                foreach (var c in conns.EnumerateArray())
                {
                    var sal = c.GetProperty("departure").GetDateTime();
                    var arr = c.GetProperty("arrival").GetDateTime();
                    var barato = c.TryGetProperty("cheapest_price", out var p) ? p.GetDouble() : 300;
                    int? asientos = c.TryGetProperty("seats_available", out var s) ? s.GetInt32() : null;
                    // Precio unico: sin margen ni rango (regla: solo precios reales).
                    viajes.Add(new ViajeBus("Distribusion · red asociada", sal, arr, barato, barato,
                        asientos, "Distribusion (en vivo)",
                        "https://book.api.distribusion.com", "connections + seats + cheapest_prices"));
                }
            }
            return viajes;
        }
        catch
        {
            // Sin cotizacion no hay precio: el respaldo a estimado lo decide
            // CalcularTramoAsync solo cuando NINGUN proveedor respondio.
            return new List<ViajeBus>();
        }
    }

    /// <summary>Fase 1: estimados etiquetados. Método listo para cambiarse por un proveedor con llave.</summary>
    public static Task<List<ViajeVuelo>> BuscarVuelosEstimadosAsync(double kmAerea, string origen, string destino, DateOnly fecha, CancellationToken ct)
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

    // ---------- Cálculo ----------

    public static async Task<CostosRutaResponse> CalcularAsync(CostosRutaRequest request, HttpClient http, IMemoryCache cache, CancellationToken ct = default)
    {
        if (request.Personas is null || request.Personas.Count == 0)
            throw new ArgumentException("Manda 'personas' con al menos 1 persona.");
        if (request.Personas.Count > 9)
            throw new ArgumentException("Máximo 9 personas por llamada.");
        var opciones = request.Opciones ?? new CostosRutaOpcionesInput();

        var normas = new List<PersonaNorm>();
        for (var i = 0; i < request.Personas.Count; i++)
            normas.Add(await NormalizarAsync(request.Personas[i], i, http, ct));

        var grupos = DetectarCompartidos(normas);
        var precios = await ObtenerPreciosGasolinaAsync(http, cache, ct);

        var resp = new CostosRutaResponse
        {
            Categorias = CategoriasSalida.ToDictionary(c => c, _ => new List<CostosRutaOferta>()),
        };

        for (var i = 0; i < normas.Count; i++)
        {
            var norm = normas[i];
            var (prop, razones) = await DraftAsync(norm, http, ct);
            var tramos = new List<TramoCalc>();
            for (var t = 0; t < prop.Count - 1; t++)
            {
                ComparteInfo? ci = null;
                if (opciones.CompartirViaje && grupos.TryGetValue(i, out var gd))
                    gd.TryGetValue(t, out ci);
                var intermedio = t > 0 && t < prop.Count - 2;
                tramos.Add(await CalcularTramoAsync(norm, i, t, prop[t], prop[t + 1],
                    ci, !opciones.CalcularViajesIntermedios && intermedio, precios, http, cache, ct));
            }

            var casetas = norm.CarroPropio
                ? await CasetasAsync(prop, tramos, http, cache, ct)
                : new List<CostosRutaCaseta>();

            var incumplimientos = new List<string>();
            if (opciones.RespetarHorarioLaboral)
                incumplimientos.AddRange(AvisosLaborales(norm));
            if (tramos.Any(t => t.Opciones.Count > 0 && t.Opciones.All(o => o.Late || o.SaleAntes)))
                incumplimientos.Add("Con tu horario, algún tramo no tiene alternativa viable (todas llegan tarde o salen antes de que puedas tomarlas).");

            var hoteles = await HotelesAsync(norm, i, prop, tramos, opciones.CalcularHoteles, http, cache, ct, incumplimientos);
            var resultado = new CostosRutaResultado
            {
                Nombre = norm.Nombre,
                Gasolina = norm.Gasolina,
                Propuesta = new CostosRutaPropuestaDraft { Razones = razones, Lugares = prop.Select(LugarOut).ToList() },
                Tramos = tramos.Select((t, ti) => new CostosRutaTramo
                {
                    From = t.From, To = t.To, Km = Math.Round(t.Km, 1),
                    Opciones = t.Opciones.Select((o, oi) => OfertaDe(o, norm.Nombre, i, ti + 1, oi, t.From, t.To,
                        ti < prop.Count ? prop[ti] : null, ti + 1 < prop.Count ? prop[ti + 1] : null)).ToList(),
                }).ToList(),
                RutaArmada = RutaArmada(prop, tramos, precios),
                HotelesPropuestos = hoteles,
                Incumplimientos = incumplimientos,
                Casetas = casetas,
            };
            resp.Resultados.Add(resultado);

            foreach (var (t, ti) in tramos.Select((t, ti) => (t, ti)))
                foreach (var (o, oi) in t.Opciones.Select((o, oi) => (o, oi)))
                {
                    var of = OfertaDe(o, norm.Nombre, i, ti + 1, oi, t.From, t.To,
                        ti < prop.Count ? prop[ti] : null, ti + 1 < prop.Count ? prop[ti + 1] : null);
                    resp.Categorias[CatDeModo[o.Modo]].Add(of);
                }
            foreach (var h in hoteles)
                resp.Categorias["hoteles"].Add(new CostosRutaOferta
                {
                    Id = $"p{i}-h-{h.Lugar}", Modo = "hotel", Linea = h.Lugar, Servicio = h.Motivo,
                    Persona = norm.Nombre, A = h.Lugar, LlegadaTxt = h.CheckIn, SalidaTxt = h.CheckOut,
                    Duracion = $"{h.Noches} noche(s)", PrecioTxt = h.Motivo, Nota = h.Motivo,
                    Fuente = h.Fuente, Estimado = true,
                    Comprar = new CostosRutaCompra { Url = h.Link, Sitio = "Booking.com", Accion = "reservar hotel", Objetivo = h.Lugar, Fecha = h.CheckIn },
                });

            var propuestas = ArmarPropuestas(norm, prop, tramos, hoteles, incumplimientos);
            resp.Propuestas.AddRange(propuestas);

            for (var ti = 0; ti < tramos.Count; ti++)
            {
                var viables = tramos[ti].Opciones.Where(o => !o.Late && !o.SaleAntes).ToList();
                var pool = viables.Count > 0 ? viables : tramos[ti].Opciones;
                if (pool.Count == 0) continue;
                var mejor = pool.MinBy(o => o.CostoGrupo)!;
                // El id de la oferta incluye su posición dentro del tramo (varios
                // modos se repiten: 6 taxis "uber" en un tramo corto). La mejor
                // oferta se marca por esa misma posición, no por patrón modo.
                var ixMejor = tramos[ti].Opciones.FindIndex(o => ReferenceEquals(o, mejor));
                resp.Recomendaciones.Add(new CostosRutaRecomendacion
                {
                    Persona = norm.Nombre, Tramo = ti + 1, De = tramos[ti].From, A = tramos[ti].To,
                    Km = Math.Round(tramos[ti].Km, 1),
                    Razon = $"Prioridad del motor: 1º llegar a tiempo, 2º precio, 3º tiempo puerta a puerta. «{mejor.Linea}» encabeza este tramo.",
                    MejorOfertaId = $"p{i}-t{ti + 1}-{ixMejor}-{mejor.Modo}",
                });
            }
        }

        resp.Compartidos = CompartidosResumen(normas, grupos, opciones.CompartirViaje);
        return resp;
    }

    // ---------- Normalización ----------

    private static async Task<PersonaNorm> NormalizarAsync(CostosRutaPersonaInput p, int i, HttpClient http, CancellationToken ct)
    {
        var tag = $"Persona {i + 1} ({p.Nombre ?? $"persona_{i + 1}"})";
        var nombre = string.IsNullOrWhiteSpace(p.Nombre) ? $"persona_{i + 1}" : p.Nombre.Trim();
        var gas = string.IsNullOrWhiteSpace(p.Gasolina) ? "magna" : p.Gasolina.Trim().ToLowerInvariant();
        if (gas is not ("magna" or "premium" or "diesel"))
            throw new ArgumentException($"{tag}: gasolina inválida ({p.Gasolina}), usa magna|premium|diesel.");
        var tr = p.Trabajo ?? new CostosRutaTrabajoInput();
        if (!TimeOnly.TryParse(tr.HoraEntrada, out var hIn) || !TimeOnly.TryParse(tr.HoraSalida, out var hOut))
            throw new ArgumentException($"{tag}: horario laboral inválido (usa HH:mm).");
        if (tr.PrimerDiaLaboral is < 1 or > 7 || tr.UltimoDiaLaboral is < 1 or > 7 || tr.PrimerDiaLaboral > tr.UltimoDiaLaboral)
            throw new ArgumentException($"{tag}: días laborales fuera de 1-7 o invertidos.");

        var raw = p.Lugares ?? [];
        if (raw.Count < 2) throw new ArgumentException($"{tag}: necesita al menos 2 lugares.");
        var ordenados = raw.OrderBy(l => l.Orden).ToList();
        if (ordenados.Select(l => l.Orden).SequenceEqual(Enumerable.Range(1, raw.Count)) is false)
            throw new ArgumentException($"{tag}: 'orden' debe ser 1..{raw.Count} sin saltos ni repetidos.");
        if (ordenados[0].Tipo != "salida")
            throw new ArgumentException($"{tag}: el lugar 1 debe ser tipo 'salida'.");

        var tipos = new[] { "salida", "punto", "taller", "hotel" };
        var lugares = new List<LugarNorm>();
        foreach (var l in ordenados)
        {
            var q = $"{tag} lugar {l.Orden}";
            if (!tipos.Contains(l.Tipo))
                throw new ArgumentException($"{q}: tipo inválido ({l.Tipo}), usa salida|punto|taller|hotel.");
            var nombreL = string.IsNullOrWhiteSpace(l.Nombre) ? $"lugar {l.Orden}" : l.Nombre.Trim();
            if (l.Tipo == "salida")
            {
                DateTime? sal = null;
                if (l.FechaSalida is not null || l.HoraSalida is not null)
                {
                    if (l.FechaSalida is null || l.HoraSalida is null)
                        throw new ArgumentException($"{q}: manda fecha Y hora de salida, o ninguna (se calcula).");
                    sal = Dt(l.FechaSalida, l.HoraSalida, q + " salida");
                }
                lugares.Add(new LugarNorm(l.Orden, l.Tipo, nombreL, l.Latitud, l.Longitud, sal, null, null, null, null, false,
                    l.Municipio?.Trim() ?? "", l.Estado?.Trim() ?? ""));
            }
            else if (l.Tipo == "hotel")
            {
                var llegada = DtReq(l.FechaLlegada, l.HoraLlegada, q + " check-in");
                var salida = DtReq(l.FechaSalida, l.HoraSalida, q + " check-out");
                lugares.Add(new LugarNorm(l.Orden, l.Tipo, nombreL, l.Latitud, l.Longitud, salida, llegada, llegada, null, null, false,
                    l.Municipio?.Trim() ?? "", l.Estado?.Trim() ?? ""));
            }
            else
            {
                string? fiD, fiH;
                if (l.Tipo == "taller")
                {
                    fiD = l.FechaInicioActividad; fiH = l.HoraInicioActividad;
                    if (fiD is null || fiH is null)
                        throw new ArgumentException($"{q}: el taller necesita fecha/hora de inicio.");
                }
                else
                {
                    fiD = l.FechaLimiteLlegada; fiH = l.HoraLimiteLlegada;
                    if (fiD is null || fiH is null)
                        throw new ArgumentException($"{q}: el punto necesita fecha/hora límite de llegada.");
                    fiD = l.FechaInicioActividad ?? fiD; fiH = l.HoraInicioActividad ?? fiH;
                }
                var deadline = DtReq(l.Tipo == "taller" ? fiD : l.FechaLimiteLlegada,
                    l.Tipo == "taller" ? fiH : l.HoraLimiteLlegada, q + " inicio");
                var fin = DtReq(fiD, fiH, q + " inicio actividad");
                var finAct = l.HoraFinActividad is not null
                    ? DtReq(l.FechaFinActividad ?? fiD, l.HoraFinActividad, q + " fin actividad")
                    : fin.AddHours(1);
                DateTime salida = l.FechaSalida is not null
                    ? DtReq(l.FechaSalida, l.HoraSalida ?? throw new ArgumentException($"{q}: hora de salida requerida."), q + " salida")
                    : finAct.AddHours(2);
                if (!(deadline <= fin && fin <= finAct && finAct <= salida))
                    throw new ArgumentException($"{q}: cadena inválida (llegada <= inicio <= fin <= salida).");
                lugares.Add(new LugarNorm(l.Orden, l.Tipo, nombreL, l.Latitud, l.Longitud, salida, null, deadline, fin, finAct, false,
                    l.Municipio?.Trim() ?? "", l.Estado?.Trim() ?? ""));
            }
        }

        if (lugares[0].Salida is null)
        {
            var p1 = lugares[1];
            if (p1.Deadline is null) throw new ArgumentException($"{tag}: para calcular la salida, el lugar 2 necesita fecha límite.");
            var hrs = await HorasManejoAsync(http, lugares[0].Lat, lugares[0].Lon, p1.Lat, p1.Lon, ct);
            lugares[0] = lugares[0] with { Salida = p1.Deadline.Value.AddHours(-hrs).AddMinutes(-BufferMin) };
        }
        return new PersonaNorm(nombre, p.CarroPropio, gas, p.Draft, hIn, hOut, tr.PrimerDiaLaboral, tr.UltimoDiaLaboral, lugares);
    }

    private static DateTime DtReq(string? fecha, string? hora, string quien)
    {
        if (fecha is null || hora is null) throw new ArgumentException($"{quien}: fecha y hora requeridas.");
        return Dt(fecha, hora, quien);
    }

    private static DateTime Dt(string fecha, string hora, string quien)
    {
        if (!DateOnly.TryParseExact(fecha, "yyyy-MM-dd", out var d))
            throw new ArgumentException($"{quien}: fecha inválida ({fecha}), usa yyyy-MM-dd.");
        if (!TimeOnly.TryParse(hora, out var t))
            throw new ArgumentException($"{quien}: hora inválida ({hora}), usa HH:mm.");
        return d.ToDateTime(t);
    }

    private static Dictionary<string, object?> LugarOut(LugarNorm nl)
    {
        var o = new Dictionary<string, object?>
        {
            ["orden"] = nl.Orden, ["tipo"] = nl.Tipo, ["nombre"] = nl.Nombre,
            ["latitud"] = nl.Lat, ["longitud"] = nl.Lon,
        };
        if (nl.Propuesto) o["propuesto"] = true;
        if (nl.Tipo == "salida") { o["fecha_salida"] = F(nl.Salida!.Value); o["hora_salida"] = H(nl.Salida!.Value); }
        else if (nl.Tipo == "hotel")
        {
            o["fecha_llegada"] = F(nl.Llegada!.Value); o["hora_llegada"] = H(nl.Llegada!.Value);
            o["fecha_salida"] = F(nl.Salida!.Value); o["hora_salida"] = H(nl.Salida!.Value);
        }
        else
        {
            o["fecha_limite_llegada"] = F(nl.Deadline!.Value); o["hora_limite_llegada"] = H(nl.Deadline!.Value);
            o["fecha_inicio_actividad"] = F(nl.Fin!.Value); o["hora_inicio_actividad"] = H(nl.Fin!.Value);
            o["fecha_fin_actividad"] = F(nl.FinActividad!.Value); o["hora_fin_actividad"] = H(nl.FinActividad!.Value);
            o["fecha_salida"] = F(nl.Salida!.Value); o["hora_salida"] = H(nl.Salida!.Value);
        }
        return o;
        static string F(DateTime x) => x.ToString("yyyy-MM-dd");
        static string H(DateTime x) => x.ToString("HH:mm");
    }

    // ---------- Draft ----------

    private static async Task<(List<LugarNorm> Prop, List<string> Razones)> DraftAsync(PersonaNorm norm, HttpClient http, CancellationToken ct)
    {
        var lugares = norm.Lugares.Select(l => l).ToList();
        var razones = new List<string>();
        if (!norm.Draft) return (lugares, razones);
        var origen = lugares[0];
        var last = lugares[^1];
        var finUlt = last.Tipo is "punto" or "taller" ? last.FinActividad!.Value : last.Salida!.Value;
        var drive = await HorasManejoAsync(http, last.Lat, last.Lon, origen.Lat, origen.Lon, ct);
        var llegada = finUlt.AddHours(drive);
        var limite = llegada.Date.Add(norm.HOut.ToTimeSpan()).AddHours(4);
        var inviable = llegada > limite || (drive > 3 && llegada.Hour >= 22);
        if (last.Tipo != "hotel" && inviable)
        {
            var checkin = finUlt.AddHours(1);
            var checkout = checkin.AddDays(1).Date.AddHours(7);
            if (checkout <= checkin) checkout = checkout.AddDays(1);
            var (key, _) = SnapCiudad(last.Lat, last.Lon);
            var ciudad = key is not null ? Ciudades[key].Nombre : "la zona";
            lugares.Add(new LugarNorm(lugares.Count + 1, "hotel", $"Hotel propuesto — {ciudad}",
                last.Lat, last.Lon, checkout, checkin, checkin, null, null, true, last.Municipio, last.Estado));
            razones.Add($"Regresar esa noche llegaría {llegada:dd/MM HH:mm} (manejo ~{drive:F1} h), fuera de tu jornada -> hotel en {ciudad}.");
            finUlt = checkout;
        }
        var regresoHora = finUlt.AddHours(drive + 0.5);
        lugares.Add(new LugarNorm(lugares.Count + 1, "punto", $"Regreso — {origen.Nombre}",
            origen.Lat, origen.Lon, regresoHora, null, regresoHora, regresoHora, regresoHora, true, origen.Municipio, origen.Estado));
        razones.Add($"Regreso propuesto a {origen.Nombre}: {regresoHora:dd/MM HH:mm}.");
        return (lugares, razones);
    }

    private static List<string> AvisosLaborales(PersonaNorm norm)
    {
        var avisos = new List<string>();
        foreach (var nl in norm.Lugares)
        {
            if (nl.Tipo != "punto" || nl.Propuesto || nl.Deadline is null) continue;
            var d = nl.Deadline.Value;
            if (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday
                && (norm.DIn > (int)d.DayOfWeek || (int)d.DayOfWeek > norm.DOut))
                continue;
            var dow = (int)d.DayOfWeek == 0 ? 7 : (int)d.DayOfWeek;
            if (dow < norm.DIn || dow > norm.DOut) continue;
            var ini = d.Date.Add(norm.HIn.ToTimeSpan());
            var fin = d.Date.Add(norm.HOut.ToTimeSpan());
            if (nl.Fin < fin && nl.FinActividad > ini)
                avisos.Add($"⚠️ {nl.Nombre} ({d:dd/MM HH:mm}) cae en tu horario laboral ({norm.HIn:HH:mm}-{norm.HOut:HH:mm}).");
        }
        return avisos;
    }

    // ---------- Tramos ----------

    private static async Task<double> HorasManejoAsync(HttpClient http, double latO, double lonO, double latD, double lonD, CancellationToken ct)
    {
        var r = await ObtenerRutaOsrmAsync(http, latO, lonO, latD, lonD, ct);
        return r is not null ? r.Horas : HaversineKm(latO, lonO, latD, lonD) / 70.0;
    }

    private static async Task<TramoCalc> CalcularTramoAsync(PersonaNorm norm, int ixP, int ti,
        LugarNorm a, LugarNorm b, ComparteInfo? comparte, bool intermedioSimple, PreciosGasolina precios,
        HttpClient http, IMemoryCache cache, CancellationToken ct)
    {
        var deadline = b.Deadline ?? b.Llegada ?? b.Salida ?? throw new ArgumentException($"Tramo {ti + 1}: sin hora de referencia.");
        var salidaPrevia = a.Salida;
        var ruta = await ObtenerRutaOsrmAsync(http, a.Lat, a.Lon, b.Lat, b.Lon, ct);
        double km, hrs;
        string srcRuta;
        if (ruta is not null) { km = ruta.Km; hrs = ruta.Horas; srcRuta = ruta.Fuente; }
        else
        {
            km = HaversineKm(a.Lat, a.Lon, b.Lat, b.Lon) * 1.25;
            hrs = km / 70.0;
            srcRuta = "seed de distancia (OSRM no respondió)";
        }
        var air = HaversineKm(a.Lat, a.Lon, b.Lat, b.Lon);
        var (keyO, _) = SnapCiudad(a.Lat, a.Lon);
        var (keyD, _) = SnapCiudad(b.Lat, b.Lon);
        var cas = Casetas(keyO, keyD, km);
        var gas = km / RendimientoEfectivo() * precios.Magna;
        var osm = $"https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route={a.Lat}%2C{a.Lon}%3B{b.Lat}%2C{b.Lon}";
        var opts = new List<OpCalc>();
        var sinAuto = !norm.CarroPropio && comparte?.Conductor is null;
        var nSh = comparte?.N;

        string NotaSh() => nSh is > 1 ? $" · compartido entre {nSh}" + (comparte!.Conductor is not null ? $" (maneja {comparte.Conductor})" : " (renta compartida)") : "";

        if (!sinAuto)
        {
            foreach (var (nombre, casetas, factorT) in new[] { ("Auto (cuota)", cas.Costo, 1.0), ("Auto (libre)", 0.0, 1.15) })
            {
                var dur = hrs * factorT;
                var sal = salidaPrevia ?? deadline.AddHours(-dur).AddMinutes(-BufferMin);
                var arr = sal.AddHours(dur);
                var parte = (gas + casetas) / (nSh is > 1 ? nSh.Value : 1);
                opts.Add(new OpCalc("auto", nombre + NotaSh(), $"{km:F0} km carretera", sal, arr, dur, 0,
                    parte, parte * 1.1, parte, false, km / RendimientoEfectivo(), precios.Magna, casetas, null,
                    arr > deadline, false, arr > deadline ? (int)(arr - deadline).TotalMinutes : 0,
                    $"OSRM + CNE ({srcRuta}; {precios.Fuente})", false,
                    salidaPrevia is not null ? $"casetas + gasolina CNE · sales {sal:dd/MM HH:mm} (tu hora){NotaSh()}" : $"casetas + gasolina CNE · sale {sal:dd/MM HH:mm} para llegar {BufferMin} min antes{NotaSh()}",
                    osm, "OSRM + OpenStreetMap", "ver ruta", $"ruta de manejo {a.Nombre} → {b.Nombre}", ""));
            }
        }

        foreach (var (nombre, tarifa, notaR) in new[] { ("Renta económica", 650.0, "auto compacto"), ("Renta SUV", 1150.0, "camioneta familiar") })
        {
            var sal = salidaPrevia ?? deadline.AddHours(-hrs).AddMinutes(-BufferMin);
            var arr = sal.AddHours(hrs);
            var total = (tarifa + gas + cas.Costo) / (nSh is > 1 ? nSh.Value : 1);
            opts.Add(new OpCalc("renta", nombre + NotaSh(), $"{km:F0} km carretera", sal, arr, hrs, 0,
                total, total * 1.12, total, false, km / RendimientoEfectivo(), precios.Magna, cas.Costo, tarifa,
                arr > deadline, false, arr > deadline ? (int)(arr - deadline).TotalMinutes : 0,
                "seed renta", true, $"{notaR} · tarifa/día ${tarifa:F0}{NotaSh()}",
                $"https://www.google.com/search?q=renta de autos {b.Nombre} por día", "Google", "cotizar renta", $"renta en {b.Nombre}", ""));
        }

        if (!intermedioSimple)
        {
            var fechas = new[] { deadline.Date, deadline.Date.AddDays(-1) };
            var candidatos = new List<ViajeBus>();
            // ClickBus busca por ciudad, no por direccion: el municipio es el dato
            // que empata con su catalogo (el nombre del lugar suele ser una calle).
            var ciudadOrigen = string.IsNullOrWhiteSpace(a.Municipio) ? a.Nombre : a.Municipio;
            var ciudadDestino = string.IsNullOrWhiteSpace(b.Municipio) ? b.Nombre : b.Municipio;
            foreach (var f in fechas)
            {
                candidatos.AddRange(await BuscarBusesClickBusAsync(http, ciudadOrigen, ciudadDestino, DateOnly.FromDateTime(f), cache, ct, a.Estado, b.Estado));
                candidatos.AddRange(await BuscarBusesDistribusionAsync(http, a.Nombre, b.Nombre, DateOnly.FromDateTime(f), ct));
            }
            // El estimado es el ultimo recurso: solo aparece cuando ningun
            // proveedor cotizo. Con precio real, la tabla no mezcla estimados.
            var busEstimado = candidatos.Count == 0;
            if (busEstimado)
                candidatos = ViajesBusSeed(DateOnly.FromDateTime(deadline), km, "estimado: sin proveedor de autobuses");
            foreach (var g in candidatos.GroupBy(v => v.Linea))
            {
                var mejor = MejorHorario(g.ToList(), salidaPrevia, 30, deadline,
                    v => v.Salida, v => v.Llegada, out var saleAntes);
                var durB = (mejor.Llegada - mejor.Salida).TotalHours;
                opts.Add(new OpCalc("bus", mejor.Linea, busEstimado ? "Estimado" : "Directo", mejor.Salida, mejor.Llegada, durB + 0.5, 30,
                    mejor.PrecioDesde, mejor.PrecioHasta, (mejor.PrecioDesde + mejor.PrecioHasta) / 2, true,
                    null, null, null, null, mejor.Llegada > deadline, saleAntes,
                    mejor.Llegada > deadline ? (int)(mejor.Llegada - deadline).TotalMinutes : 0,
                    mejor.Fuente, busEstimado, $"{mejor.Nota} · cotiza en el sitio/app oficial",
                    mejor.Url, "ClickBus",
                    "ver costo del boleto", $"boleto {mejor.Linea} {a.Nombre} → {b.Nombre}", "",
                    mejor.TerminalOrigen, mejor.TerminalDestino));
            }

            var (iataO, iataD) = (keyO is not null ? Ciudades[keyO].Iata : null,
                keyD is not null ? Ciudades[keyD].Iata : null);
            if (air >= 300 || (iataO is not null && iataD is not null))
            {
                var cands = new List<ViajeVuelo>();
                foreach (var f in fechas)
                    cands.AddRange(await BuscarVuelosEstimadosAsync(air, iataO ?? a.Nombre, iataD ?? b.Nombre, DateOnly.FromDateTime(f), ct));
                foreach (var g in cands.GroupBy(v => v.Linea))
                {
                    var mejor = MejorHorario(g.ToList(), salidaPrevia, 120, deadline,
                        v => v.Salida, v => v.Llegada, out var saleAntes);
                    var puerta = (mejor.Llegada - mejor.Salida).TotalHours + 2.5;
                    opts.Add(new OpCalc("avion", mejor.Linea, "estimado", mejor.Salida, mejor.Llegada, puerta, 120,
                        mejor.PrecioDesde, mejor.PrecioHasta, (mejor.PrecioDesde + mejor.PrecioHasta) / 2, true,
                        null, null, null, null, mejor.Llegada > deadline, saleAntes,
                        mejor.Llegada > deadline ? (int)(mejor.Llegada - deadline).TotalMinutes : 0,
                        mejor.Fuente, true, $"{mejor.Nota} · llegar al aeropuerto + 120 min antes · cotiza en el sitio oficial",
                        mejor.Url, mejor.Linea, "ver costo del vuelo", $"vuelo {mejor.Linea} {iataO} → {iataD}", ""));
                }
            }

            if (km <= 80)
                opts.AddRange(TaxiUber(a, b, km, hrs, keyD ?? keyO, salidaPrevia, deadline, osm));
            if (km <= 40)
                opts.Add(TransportePublico(a, b, km, hrs, keyD ?? keyO, salidaPrevia, deadline, osm));
        }
        else if (km <= 80)
        {
            // Viaje intermedio sin conectores: solo referencia de manejo.
            opts.Add(new OpCalc("uber", "Taxi (referencia intermedia)", $"{km:F0} km", salidaPrevia ?? deadline.AddHours(-hrs),
                (salidaPrevia ?? deadline.AddHours(-hrs)).AddHours(hrs), hrs, 0, 0, 0, 0, false,
                null, null, null, null, false, false, 0, "seed", true,
                "viaje intermedio sin conectores (opción desactivada)", osm, "OSRM", "ver ruta", "referencia", ""));
        }

        for (var bi = 0; bi < opts.Count; bi++)
            opts[bi] = opts[bi] with { Badge = "" };
        if (opts.Count > 0)
        {
            var iBar = opts.Index().MinBy(p => p.Item.CostoGrupo).Index;
            var iRap = opts.Index().MinBy(p => p.Item.PuertaH).Index;
            opts[iBar] = opts[iBar] with { Badge = iRap == iBar ? "más barato y rápido" : "más barato" };
            if (iRap != iBar) opts[iRap] = opts[iRap] with { Badge = "más rápido" };
        }
        return new TramoCalc(a.Nombre, b.Nombre, km, hrs, opts.OrderBy(o => o.CostoGrupo).ToList(), ruta?.Grafica);
    }

    private static T MejorHorario<T>(List<T> cands, DateTime? salidaPrevia, int overheadMin, DateTime deadline,
        Func<T, DateTime> sal, Func<T, DateTime> arr, out bool saleAntes)
    {
        var limite = salidaPrevia?.AddMinutes(overheadMin);
        var tomables = limite is null ? cands : cands.Where(c => sal(c) >= limite).ToList();
        var pool = tomables.Count > 0 ? tomables : cands;
        var puntuales = pool.Where(c => arr(c) <= deadline).ToList();
        saleAntes = salidaPrevia is not null && tomables.Count == 0;
        return puntuales.Count > 0 ? puntuales.MaxBy(c => sal(c))! : pool.MinBy(c => arr(c))!;
    }

    private static (double Costo, string Fuente) Casetas(string? keyO, string? keyD, double km)
    {
        foreach (var par in new[] { $"{keyO}-{keyD}", $"{keyD}-{keyO}" })
            if (CasetasIda.TryGetValue(par, out var v))
                return (v, $"seed de corredor {par} (estilo CAPUFE)");
        return (Math.Round(km * CasetaPorKmEfectivo()), "seed ~$1.4/km (estilo CAPUFE)");
    }

    private static List<OpCalc> TaxiUber(LugarNorm a, LugarNorm b, double km, double hrs,
        string? ciudadKey, DateTime? salidaPrevia, DateTime deadline, string osm)
    {
        var list = new List<OpCalc>();
        var ciudad = ciudadKey ?? "CDMX";
        var esNoche = (salidaPrevia ?? deadline).Hour is >= 22 or < 6;
        var recargo = esNoche ? " · noche +20%" : "";
        void Add(string linea, double costo, string nota, string fuente, string url, string sitio)
        {
            var dur = hrs * 1.3;
            var sal = salidaPrevia ?? deadline.AddHours(-dur).AddMinutes(-BufferMin);
            var arr = sal.AddHours(dur);
            list.Add(new OpCalc("uber", linea, $"{km:F0} km · por auto (hasta 4 pax)", sal, arr, dur, 0,
                costo, costo * 1.25, costo, false, null, null, null, null,
                arr > deadline, false, arr > deadline ? (int)(arr - deadline).TotalMinutes : 0,
                fuente, true, salidaPrevia is not null ? $"{nota} · sales {sal:dd/MM HH:mm} (tu hora)" : $"{nota}{recargo}",
                url, sitio, "cotizar viaje", $"viaje {linea} {a.Nombre} → {b.Nombre}", ""));
        }
        if (ciudad == "CDMX")
        {
            var f = esNoche ? 1.2 : 1.0;
            var libreBase = ConfiguracionViaticos.Double("costos.taxi.cdmx.libre_base", 8.74);
            var libreKm = ConfiguracionViaticos.Double("costos.taxi.cdmx.libre_km", 4.28);
            var sitioBase = ConfiguracionViaticos.Double("costos.taxi.cdmx.sitio_base", 13.10);
            var sitioKm = ConfiguracionViaticos.Double("costos.taxi.cdmx.sitio_km", 5.20);
            var radioBase = ConfiguracionViaticos.Double("costos.taxi.cdmx.radio_base", 27.30);
            var radioKm = ConfiguracionViaticos.Double("costos.taxi.cdmx.radio_km", 7.36);
            Add("Taxi libre CDMX", (libreBase + libreKm * km) * f, $"SEMOVI libre ${libreBase:0.00} + ${libreKm:0.00}/km", "SEMOVI CDMX (oficial)", osm, "OSRM");
            Add("Taxi sitio CDMX", (sitioBase + sitioKm * km) * f, $"SEMOVI sitio ${sitioBase:0.00} + ${sitioKm:0.00}/km", "SEMOVI CDMX (oficial)", osm, "OSRM");
            Add("Radio taxi CDMX", (radioBase + radioKm * km) * f, $"SEMOVI radio ${radioBase:0.00} + ${radioKm:0.00}/km", "SEMOVI CDMX (oficial)", osm, "OSRM");
        }
        else if (ciudad == "XAL")
        {
            var perimetro = ConfiguracionViaticos.Double("costos.taxi.xal.perimetro", 38.5);
            var fueraBase = ConfiguracionViaticos.Double("costos.taxi.xal.fuera_base", 50);
            var fueraKm = ConfiguracionViaticos.Double("costos.taxi.xal.fuera_km", 10);
            if (km <= 8) Add("Taxi Xalapa (perímetro)", perimetro, "perímetro Xalapa $27–$50", "seed Veracruz por perímetros", osm, "OSRM");
            else Add("Taxi Xalapa (fuera de perímetro)", fueraBase + fueraKm * km, "fuera de perímetro → tarifa a convenir; valida con el operador", "seed Veracruz (a convenir)", osm, "OSRM");
        }
        else
        {
            var (tb, tk) = TarifaTaxi(ciudad);
            Add($"Taxi {ciudad}", tb + tk * km, $"seed tarifa base ${tb} + ${tk}/km", "seed taxi", osm, "OSRM");
        }
        var (bb, bk) = TarifaTaxi(ciudad);
        var baseKm = bb + bk * km;
        Add("UberX", baseKm, "uber económico · cotiza en la app", "seed apps", UberEstimateUrl, "Uber");
        Add("Uber Comfort", baseKm * 1.35, "uber confort · cotiza en la app", "seed apps", UberEstimateUrl, "Uber");
        Add("DiDi Taxi", baseKm * 1.15, "taxi vía DiDi · verifica disponibilidad en tu ciudad", "seed apps", DidiUrl, "DiDi");
        return list;
    }

    private static OpCalc TransportePublico(LugarNorm a, LugarNorm b, double km, double hrs,
        string? ciudadKey, DateTime? salidaPrevia, DateTime deadline, string osm)
    {
        var (sist, tarifa) = (ciudadKey ?? "") switch
        {
            "CDMX" => ("Metro / Metrobús", 6.0),
            "GDL" => ("Mi Tren / Macro", 10.0),
            "MTY" => ("Metrorrey", 9.0),
            _ => ("Camión urbano", 14.0),
        };
        var dur = hrs * 2.2 + 0.3;
        var sal = salidaPrevia ?? deadline.AddHours(-dur).AddMinutes(-BufferMin);
        var arr = sal.AddHours(dur);
        return new OpCalc("publico", $"Transporte público ({sist})", $"{km:F0} km · tarifa plana", sal, arr, dur + 0.33, 20,
            tarifa, tarifa * 1.3, tarifa, true, null, null, null, null,
            arr > deadline, false, arr > deadline ? (int)(arr - deadline).TotalMinutes : 0,
            "seed transporte público", true, $"tarifa plana ~${tarifa:F0}",
            $"https://www.google.com/search?q={Uri.EscapeDataString(sist + " " + b.Nombre + " tarifa")}", "Google",
            "ver tarifa", "transporte público", "");
    }

    // ---------- Hoteles ----------

    private static async Task<List<CostosRutaHotel>> HotelesAsync(PersonaNorm norm, int ixP, List<LugarNorm> prop,
        List<TramoCalc> tramos, bool calcular, HttpClient http, IMemoryCache cache, CancellationToken ct,
        List<string> incumplimientos)
    {
        var propuestos = new List<CostosRutaHotel>();
        for (var idx = 0; idx < prop.Count; idx++)
        {
            var nl = prop[idx];
            if (nl.Tipo == "punto" && nl.Propuesto) continue; // regreso: solo marca llegada
            if (nl.Salida is null) continue;
            DateTime llegada;
            string modo;
            if (nl.Tipo == "hotel") { llegada = nl.Llegada!.Value; modo = "hotel"; }
            else
            {
                if (idx == 0 || nl.Deadline is null) continue;
                var viables = tramos[idx - 1].Opciones.Where(o => !o.Late && !o.SaleAntes).ToList();
                var rep = (viables.Count > 0 ? viables : tramos[idx - 1].Opciones).MinBy(o => o.CostoGrupo);
                if (rep is null) continue;
                llegada = rep.Llegada; modo = rep.Modo;
            }
            var noches = NochesEstadia(llegada, modo, nl.Salida.Value);
            if (noches < 1) continue;
            if (!calcular)
            {
                incumplimientos.Add($"{nl.Nombre}: requiere hospedaje no calculado (pernocte de {noches} noche(s)).");
                continue;
            }
            var (key, _) = SnapCiudad(nl.Lat, nl.Lon);
            var ciudad = key is not null
                ? Ciudades[key].Nombre
                : nl.Nombre.StartsWith("Hotel cerca de ", StringComparison.OrdinalIgnoreCase)
                    ? nl.Nombre["Hotel cerca de ".Length..]
                    : nl.Nombre;
            var tarifa = Viaticos.GetValueOrDefault(key ?? "CDMX", (600, 2000)).HospedajeNoche;
            var ci = llegada.Date.ToString("yyyy-MM-dd");
            var co = nl.Salida.Value.Date.ToString("yyyy-MM-dd");
            var link = (string n) => $"https://www.booking.com/searchresults.es.html?ss={Uri.EscapeDataString(n)}&checkin={ci}&checkout={co}&group_adults=1&no_rooms=1";
            propuestos.Add(new CostosRutaHotel
            {
                Lugar = nl.Nombre, Nombre = $"Hotel en {ciudad} (referencia)",
                Ciudad = ciudad, CheckIn = ci, CheckOut = co, Noches = noches, Habitaciones = 1,
                DistanciaKm = 0, PrecioNoche = tarifa, PrecioTotal = tarifa * noches,
                Motivo = $"Tarifa tabulador · {noches} noche(s) × 1 hab",
                Fuente = FuenteTabuladorHotel, Link = link(ciudad),
            });
            var reales = await BuscarHotelesCercanosAsync(http, cache, nl.Lat, nl.Lon, ct);
            foreach (var h in reales.Take(5))
                propuestos.Add(new CostosRutaHotel
                {
                    Lugar = nl.Nombre, Nombre = h.Nombre,
                    Ciudad = ciudad, CheckIn = ci, CheckOut = co, Noches = noches, Habitaciones = 1,
                    DistanciaKm = h.DistKm, PrecioNoche = tarifa, PrecioTotal = tarifa * noches,
                    Rating = h.Rating, RatingCount = h.RatingCount, Direccion = h.Direccion,
                    Latitud = h.Latitud, Longitud = h.Longitud,
                    Motivo = h.Rating is null
                        ? "Precio estimado con tarifa tabulador"
                        : $"Precio estimado con tarifa tabulador · ★{h.Rating:0.0} ({h.RatingCount ?? 0} reseñas)",
                    Fuente = h.Fuente,
                    Link = h.Link ?? link(h.Nombre),
                });
        }
        return propuestos;
    }

    private static int NochesEstadia(DateTime llegada, string modo, DateTime salida)
    {
        if (salida <= llegada) return 0;
        var n = (salida.Date - llegada.Date).Days;
        if (n == 0 && llegada.Hour < 6 && modo is "auto" or "uber" or "renta" && (salida - llegada).TotalHours >= 4)
            n = 1;
        return Math.Max(0, n);
    }

    /// <summary>
    /// Casetas de la ruta según la SCT (Rutas Punto a Punto): plaza, km desde
    /// el origen, carretera y tarifa de automóvil. Se cachea un día porque el
    /// catálogo oficial cambia poco.
    /// </summary>
    private static async Task<List<CostosRutaCaseta>> CasetasAsync(
        List<LugarNorm> lugares, List<TramoCalc> tramos, HttpClient http, IMemoryCache cache, CancellationToken ct)
    {
        var salida = new List<CostosRutaCaseta>();
        for (var t = 0; t < tramos.Count && t + 1 < lugares.Count; t++)
        {
            var origen = lugares[t];
            var destino = lugares[t + 1];
            if (string.IsNullOrWhiteSpace(origen.Municipio) || string.IsNullOrWhiteSpace(destino.Municipio))
                continue;

            var clave = $"casetas-sct:{origen.Municipio}|{origen.Estado}|{destino.Municipio}|{destino.Estado}";
            ResultadoCasetasRuta? info;
            if (cache.TryGetValue(clave, out ResultadoCasetasRuta? guardada) && guardada is not null)
            {
                info = guardada;
            }
            else
            {
                try
                {
                    info = await CasetasRutaService.ConsultarAsync(
                        http, origen.Municipio, origen.Estado, destino.Municipio, destino.Estado, ct);
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    Serilog.Log.Warning("SCT: falló la consulta de casetas {Origen} → {Destino}: {Error}",
                        origen.Municipio, destino.Municipio, ex.Message);
                    info = null;
                }
                if (info is not null) cache.Set(clave, info, TimeSpan.FromHours(24));
            }
            if (info is null) continue;

            foreach (var caseta in info.Casetas)
            {
                salida.Add(new CostosRutaCaseta
                {
                    Tramo = t + 1,
                    DeMunicipio = origen.Municipio,
                    AMunicipio = destino.Municipio,
                    Nombre = caseta.Nombre,
                    Carretera = caseta.Carretera,
                    Km = caseta.KmDesdeOrigen,
                    Tarifa = caseta.TarifaAuto,
                    Direccion = caseta.Direccion,
                    Fuente = info.Fuente,
                });
            }
        }
        return salida;
    }

    // ---------- Propuestas (6) ----------

    private static List<CostosRutaPropuesta> ArmarPropuestas(PersonaNorm norm, List<LugarNorm> prop,
        List<TramoCalc> tramos, List<CostosRutaHotel> hoteles, List<string> incumplimientosBase)
    {
        var defs = new[]
        {
            ("barata", "💰 Más barato", "menor costo total estimado", null as string),
            ("rapida", "⚡ Más rápido", "menor tiempo total puerta a puerta", null),
            ("equilibrada", "⚖️ Equilibrado", "compromiso costo/tiempo por tramo", null),
            ("tipo1-carro", "🚗 Tipo 1 · Carro", "prioriza auto propio", "auto"),
            ("tipo2-bus", "🚌 Tipo 2 · Bus", "prioriza autobús", "bus"),
            ("tipo3-avion", "✈️ Tipo 3 · Avión", "prioriza avión", "avion"),
        };
        var totalRoadH = tramos.Sum(t => t.Hrs);
        var diasComidas = Math.Max(1, (int)Math.Ceiling(totalRoadH * 2 / 24));
        var comidas = diasComidas * ComidaDiaEfectiva();
        var out_ = new List<CostosRutaPropuesta>();
        foreach (var (clave, titulo, razon, modoPref) in defs)
        {
            var elegidas = new List<OpCalc?>();
            var inc = new List<string>(incumplimientosBase);
            for (var ti = 0; ti < tramos.Count; ti++)
            {
                var pool = Viables(tramos[ti]);
                OpCalc? pick = (clave, modoPref) switch
                {
                    ("barata", _) => pool.MinBy(o => o.CostoGrupo),
                    ("rapida", _) => pool.MinBy(o => o.PuertaH),
                    ("equilibrada", _) => Equilibrada(pool),
                    (_, string m) => pool.Where(o => o.Modo == m).MinBy(o => o.CostoGrupo) ?? pool.MinBy(o => o.CostoGrupo),
                    _ => pool.MinBy(o => o.CostoGrupo),
                };
                if (modoPref is not null && (pick is null || pick.Modo != modoPref))
                    inc.Add($"Tramo {ti + 1} ({tramos[ti].From} → {tramos[ti].To}): sin oferta {modoPref} viable.");
                if (pick is null) inc.Add($"Tramo {ti + 1}: sin opciones.");
                elegidas.Add(pick);
            }
            var validas = elegidas.Where(o => o is not null).Cast<OpCalc>().ToList();
            var transporte = validas.Sum(o => o.CostoGrupo);
            var taxiExtra = validas
                .Select((o, ti) => o.Modo is "bus" or "avion" ? MillaExtra(prop[ti], prop[ti + 1]) : 0)
                .Sum();
            // Cada pernocte se cuenta UNA vez: la entrada valuada con tarifa
            // tabulador es la representante; los hoteles de Overpass son
            // alternativas sin precio propio (menu, no reservas simultaneas).
            // Se agrupa por estancia (lugar + check-in + check-out) para no
            // depender del orden de la lista ni de la primera posicion.
            var hosp = hoteles
                .GroupBy(h => (h.Lugar, h.CheckIn, h.CheckOut))
                .Sum(g =>
                {
                    var rep = g.FirstOrDefault(h => h.Fuente == FuenteTabuladorHotel) ?? g.First();
                    return rep.Noches * 1 * TarifaHotel(rep.Ciudad);
                });
            var total = transporte + taxiExtra + hosp + comidas;
            var margenes = new List<int>();
            for (var ti = 0; ti < validas.Count; ti++)
            {
                var dl = prop[ti + 1].Deadline ?? prop[ti + 1].Llegada ?? prop[ti + 1].Salida;
                if (dl is not null) margenes.Add((int)(dl.Value - validas[ti].Llegada).TotalMinutes);
            }
            var cumple = validas.Count == tramos.Count
                && validas.All(o => !o.Late && !o.SaleAntes)
                && !inc.Any(m => m.Contains("hospedaje no calculado"));
            out_.Add(new CostosRutaPropuesta
            {
                Persona = norm.Nombre, Clave = clave, Titulo = $"{titulo} — {razon}",
                CumpleTodos = cumple,
                SalidaOrigen = prop[0].Salida?.ToString("dd/MM HH:mm") ?? "",
                LlegadaFinal = validas.Count > 0 ? validas[^1].Llegada.ToString("dd/MM HH:mm") : "",
                MargenMinimoMinutos = margenes.Count > 0 ? margenes.Min() : 0,
                CostoTotalMxn = Math.Round(total, 2),
                // Mismos locales ya sumados en `total`; solo se redondean para
                // presentacion, nunca se recalculan.
                Comida = Math.Round(comidas, 2),
                Taxi = Math.Round(taxiExtra, 2),
                Hospedaje = Math.Round(hosp, 2),
                Tramos = validas.Select((o, ti) => new CostosRutaPropuestaTramo
                {
                    Tramo = ti + 1, De = tramos[ti].From, A = tramos[ti].To, Modo = o.Modo, Linea = o.Linea,
                    Salida = o.Salida.ToString("dd/MM HH:mm"), Llegada = o.Llegada.ToString("dd/MM HH:mm"),
                    Costo = Math.Round(o.CostoGrupo, 2),
                }).ToList(),
                HotelesPropuestos = hoteles,
                Incumplimientos = inc.Distinct().ToList(),
                Fuentes = validas.Select(o => o.Fuente).Distinct().ToList(),
            });
        }
        return out_;
    }

    private static List<OpCalc> Viables(TramoCalc t)
    {
        var v = t.Opciones.Where(o => !o.Late && !o.SaleAntes).ToList();
        return v.Count > 0 ? v : t.Opciones.ToList();
    }

    private static OpCalc? Equilibrada(List<OpCalc> pool)
    {
        if (pool.Count == 0) return null;
        var cs = pool.Select(o => o.CostoGrupo).ToList();
        var ts = pool.Select(o => o.PuertaH).ToList();
        double Rango(List<double> v) => (v.Max() - v.Min()) is var r && r > 0 ? r : 1.0;
        var rc = Rango(cs); var rt = Rango(ts);
        return pool.MinBy(o => 0.5 * (o.CostoGrupo - cs.Min()) / rc + 0.5 * (o.PuertaH - ts.Min()) / rt);
    }

    /// <summary>
    /// Minutos estimados de UN traslado en taxi entre un punto y su terminal
    /// (bus o avión), a la velocidad urbana de <c>costos.taxi_km_h</c>. Si la
    /// ciudad no tiene terminal en el catálogo se cae al centro de la ciudad,
    /// que es lo que ya se usa para costear el taxi. El tramo tiene dos: del
    /// punto de salida a su terminal y de la terminal de llegada al punto.
    /// </summary>
    private static int MinutosTaxiPuntoTerminal(
        LugarNorm? punto,
        (string Nombre, double Lat, double Lon)? terminal)
    {
        if (punto is null) return 0;
        var km = terminal is { } t
            ? HaversineKm(punto.Lat, punto.Lon, t.Lat, t.Lon)
            : DistanciaAlCentroKm(punto);
        if (km <= 0) return 0;
        var velocidad = ConfiguracionViaticos.Double("costos.taxi_km_h", 25);
        if (velocidad <= 0) velocidad = 25;
        return (int)Math.Round(km / velocidad * 60);
    }

    /// <summary>
    /// Terminal de una oferta según su modo: el aeropuerto de la ciudad para
    /// volar y su central de autobuses para el bus. Los modos que no usan
    /// terminal (auto, renta, uber, metro) devuelven <c>null</c>.
    /// </summary>
    private static (string Nombre, double Lat, double Lon)? TerminalDe(string modo, LugarNorm? lugar)
    {
        if (lugar is null || modo is not ("bus" or "avion")) return null;
        var (key, _) = SnapCiudad(lugar.Lat, lugar.Lon);
        if (key is null) return null;
        if (modo == "avion")
        {
            var iata = Ciudades[key].Iata;
            return iata is not null && Aeropuertos.TryGetValue(iata, out var aeropuerto) ? aeropuerto : null;
        }
        return Centrales.TryGetValue(key, out var central) ? central : null;
    }

    private static CostosRutaTerminal? TerminalDto((string Nombre, double Lat, double Lon)? terminal)
        => terminal is { } t
            ? new CostosRutaTerminal { Nombre = t.Nombre, Latitud = t.Lat, Longitud = t.Lon }
            : null;

    /// <summary>
    /// Terminal de respaldo cuando el proveedor no la informa y la ciudad no
    /// esta en el catalogo sembrado: usa el municipio del lugar con sus
    /// coordenadas y la marca "por confirmar", para no inventar una terminal
    /// que no conocemos. Solo aplica a bus y avion; en auto, renta, taxi o
    /// transporte publico no hay terminal.
    /// </summary>
    private static CostosRutaTerminal? TerminalDeRespaldo(LugarNorm? lugar, string modo)
    {
        if (lugar is null || modo is not ("bus" or "avion")) return null;

        var nombre = string.IsNullOrWhiteSpace(lugar.Municipio) ? lugar.Nombre : lugar.Municipio;
        if (!string.IsNullOrWhiteSpace(lugar.Estado)
            && !nombre.Contains(lugar.Estado, StringComparison.OrdinalIgnoreCase))
            nombre += ", " + lugar.Estado;

        var sufijo = modo == "avion" ? "(aeropuerto por confirmar)" : "(terminal por confirmar)";
        return new CostosRutaTerminal
        {
            Nombre = $"{nombre} {sufijo}",
            Latitud = lugar.Lat,
            Longitud = lugar.Lon,
        };
    }

    /// <summary>Distancia del punto al centro de su ciudad; 0 si está dentro (≤ 3 km).</summary>
    private static double DistanciaAlCentroKm(LugarNorm lugar)
    {
        var (key, _) = SnapCiudad(lugar.Lat, lugar.Lon);
        if (key is null) return 0;
        var c = Ciudades[key];
        var d = HaversineKm(lugar.Lat, lugar.Lon, c.Lat, c.Lon);
        return d <= 3 ? 0 : d;
    }

    private static double MillaExtra(LugarNorm a, LugarNorm b)
    {
        double extra = 0;
        foreach (var s in new[] { a, b })
        {
            var (key, _) = SnapCiudad(s.Lat, s.Lon);
            if (key is null) continue;
            var c = Ciudades[key];
            var d = HaversineKm(s.Lat, s.Lon, c.Lat, c.Lon);
            if (d <= 3) continue;
            var (tb, tk) = Taxi.GetValueOrDefault(key, (30, 11));
            extra += tb + tk * d;
        }
        return extra;
    }

    private static double TarifaHotel(string ciudad)
    {
        var kv = Ciudades.FirstOrDefault(kv => kv.Value.Nombre == ciudad);
        var clave = kv.Key ?? "CDMX";
        var porDefecto = Viaticos.GetValueOrDefault(clave, (600, 2000)).HospedajeNoche;
        return ConfiguracionViaticos.Double($"costos.hospedaje_noche.{clave}", porDefecto);
    }

    // ---------- Ruta armada / ofertas ----------

    private static CostosRutaRutaArmada RutaArmada(List<LugarNorm> prop, List<TramoCalc> tramos, PreciosGasolina precios)
    {
        var armada = new CostosRutaRutaArmada();
        for (var ti = 0; ti < tramos.Count; ti++)
        {
            var t = tramos[ti];
            var litros = t.Km / RendimientoKmL;
            var (keyO, _) = SnapCiudad(prop[ti].Lat, prop[ti].Lon);
            var (keyD, _) = SnapCiudad(prop[ti + 1].Lat, prop[ti + 1].Lon);
            var cas = Casetas(keyO, keyD, t.Km);
            var cm = litros * precios.Magna;
            var cp = litros * precios.Premium;
            armada.Tramos.Add(new CostosRutaRutaTramo
            {
                De = t.From, A = t.To, Km = Math.Round(t.Km, 1), Litros = Math.Round(litros, 2),
                Gasolina = new CostosRutaGasolinaDetalle
                {
                    Magna = new CostosRutaPrecioCombustible { PrecioL = precios.Magna, Costo = Math.Round(cm, 2), Fuente = precios.Fuente },
                    Premium = new CostosRutaPrecioCombustible { PrecioL = precios.Premium, Costo = Math.Round(cp, 2), Fuente = precios.Fuente },
                },
                Casetas = new CostosRutaCasetasDetalle { Costo = cas.Costo, Fuente = cas.Fuente },
                SubtotalMagna = Math.Round(cm + cas.Costo, 2),
                SubtotalPremium = Math.Round(cp + cas.Costo, 2),
                Grafica = t.Grafica?.Select(g => new[] { g.Lat, g.Lon }).ToList(),
            });
        }
        armada.Totales = new CostosRutaRutaTotales
        {
            Km = Math.Round(armada.Tramos.Sum(t => t.Km), 1),
            Litros = Math.Round(armada.Tramos.Sum(t => t.Litros), 2),
            Casetas = Math.Round(armada.Tramos.Sum(t => t.Casetas.Costo), 2),
            SubtotalMagna = Math.Round(armada.Tramos.Sum(t => t.SubtotalMagna), 2),
            SubtotalPremium = Math.Round(armada.Tramos.Sum(t => t.SubtotalPremium), 2),
        };
        return armada;
    }

    private static CostosRutaOferta OfertaDe(OpCalc o, string persona, int ixP, int tramo, int ixOferta, string de, string a,
        LugarNorm? lugarOrigen = null, LugarNorm? lugarDestino = null)
    {
        var mid = (o.Lo + o.Hi) / 2;
        // El tiempo puerta a puerta ya incluye los minutos de antes/después
        // (aeropuerto, maletas, abordaje); aquí se separan para mostrarlos.
        var minutosExtra = Math.Max(0, (int)Math.Round(o.PuertaH * 60 - (o.Llegada - o.Salida).TotalMinutes));
        var minutosAntes = Math.Min(o.OverheadMin, minutosExtra);
        var minutosDespues = Math.Max(0, minutosExtra - minutosAntes);
        // Terminal real (aeropuerto o central) a la que hay que llegar en taxi.
        var terminalOrigen = TerminalDe(o.Modo, lugarOrigen);
        var terminalDestino = TerminalDe(o.Modo, lugarDestino);
        // El traslado a la terminal son DOS taxis: el del punto de salida a su
        // terminal y el de la terminal de llegada al punto final. Auto propio,
        // renta y taxi urbano no pagan traslado a terminal.
        var usaTerminal = o.Modo is "bus" or "avion";
        var minutosTaxiOrigen = usaTerminal ? MinutosTaxiPuntoTerminal(lugarOrigen, terminalOrigen) : 0;
        var minutosTaxiDestino = usaTerminal ? MinutosTaxiPuntoTerminal(lugarDestino, terminalDestino) : 0;
        return new CostosRutaOferta
        {
            // ixOferta es la posición del modo dentro del tramo: modo solo no
            // basta porque un tramo puede traer varias ofertas del mismo modo.
            Id = $"p{ixP}-t{tramo}-{ixOferta}-{o.Modo}",
            Modo = o.Modo, Linea = o.Linea, Servicio = o.Codigo, Persona = persona,
            Tramo = tramo, De = de, A = a,
            Salida = o.Salida.ToString("yyyy-MM-ddTHH:mm"), Llegada = o.Llegada.ToString("yyyy-MM-ddTHH:mm"),
            SalidaTxt = o.Salida.ToString("dd/MM HH:mm"), LlegadaTxt = o.Llegada.ToString("dd/MM HH:mm"),
            Duracion = $"{(int)o.PuertaH}h {((int)Math.Round(o.PuertaH % 1 * 60)):D2}m",
            PuertaAPuertaH = Math.Round(o.PuertaH, 2),
            MinutosAntes = minutosAntes,
            MinutosDespues = minutosDespues,
            MinutosTaxi = minutosTaxiOrigen + minutosTaxiDestino,
            MinutosTaxiOrigen = minutosTaxiOrigen,
            MinutosTaxiDestino = minutosTaxiDestino,
            TerminalOrigen = o.TerminalOrigenDato
                ?? TerminalDto(terminalOrigen)
                ?? TerminalDeRespaldo(lugarOrigen, o.Modo),
            TerminalDestino = o.TerminalDestinoDato
                ?? TerminalDto(terminalDestino)
                ?? TerminalDeRespaldo(lugarDestino, o.Modo),
            // Un precio cotizado es un numero, no un rango: si Lo y Hi coinciden
            // (proveedor real) se muestra una sola cifra. El rango solo sobrevive
            // en la tarifa estimada, que se etiqueta como tal.
            PrecioTxt = Math.Abs(o.Hi - o.Lo) < 0.01
                ? (o.PorPersona ? $"${o.Lo:F0} MXN /persona" : $"${o.Lo:F0} MXN total")
                : (o.PorPersona ? $"${o.Lo:F0}–${o.Hi:F0} MXN /persona" : $"${o.Lo:F0}–${o.Hi:F0} MXN total"),
            PorPersona = o.PorPersona, PrecioDesde = Math.Round(o.Lo, 2), PrecioHasta = Math.Round(o.Hi, 2),
            CostoGrupo = Math.Round(o.CostoGrupo, 2), CostoPorPersona = Math.Round(mid, 2),
            ATiempo = !o.Late && !o.SaleAntes, LlegaTarde = o.Late, MinutosTarde = o.LateMin, NoTomable = o.SaleAntes,
            Badge = o.Badge, Nota = o.Nota, Fuente = o.Fuente, Estimado = o.Estimado,
            Comprar = new CostosRutaCompra { Url = o.Url, Sitio = o.Sitio, Accion = o.Accion, Objetivo = o.Objetivo, Fecha = o.Salida.ToString("yyyy-MM-dd") },
        };
    }

    // ---------- Compartidos ----------

    private static Dictionary<int, Dictionary<int, ComparteInfo>> DetectarCompartidos(List<PersonaNorm> normas)
    {
        var legGroups = new Dictionary<int, Dictionary<int, ComparteInfo>>();
        var maxLegs = normas.Count > 0 ? normas.Max(n => n.Lugares.Count - 1) : 0;
        for (var j = 0; j < maxLegs; j++)
        {
            var grupos = new Dictionary<(double, double, double, double), List<int>>();
            for (var i = 0; i < normas.Count; i++)
            {
                var n = normas[i];
                if (j + 1 >= n.Lugares.Count) continue;
                var a = n.Lugares[j]; var b = n.Lugares[j + 1];
                var key = (Math.Round(a.Lat, 3), Math.Round(a.Lon, 3), Math.Round(b.Lat, 3), Math.Round(b.Lon, 3));
                if (!grupos.TryGetValue(key, out var g)) grupos[key] = g = [];
                g.Add(i);
            }
            foreach (var miembros in grupos.Values)
            {
                if (miembros.Count is < 2 or > 4) continue;
                var driver = miembros.Select(m => normas[m]).FirstOrDefault(n => n.CarroPropio)?.Nombre;
                foreach (var m in miembros)
                {
                    if (!legGroups.TryGetValue(m, out var d)) legGroups[m] = d = new();
                    d[j] = new ComparteInfo(miembros.Count, driver);
                }
            }
        }
        return legGroups;
    }

    private static List<CostosRutaCompartido> CompartidosResumen(List<PersonaNorm> normas,
        Dictionary<int, Dictionary<int, ComparteInfo>> grupos, bool compartirActivo)
    {
        var vistos = new HashSet<string>();
        var out_ = new List<CostosRutaCompartido>();
        foreach (var (i, legs) in grupos)
            foreach (var (j, info) in legs)
            {
                var n = normas[i];
                if (j + 1 >= n.Lugares.Count) continue;
                var a = n.Lugares[j]; var b = n.Lugares[j + 1];
                var miembros = grupos.Where(kv => kv.Value.TryGetValue(j, out var ci)
                        && Math.Round(normas[kv.Key].Lugares[j].Lat, 3) == Math.Round(a.Lat, 3)
                        && Math.Round(normas[kv.Key].Lugares[j + 1].Lat, 3) == Math.Round(b.Lat, 3))
                    .Select(kv => normas[kv.Key].Nombre).Distinct().OrderBy(x => x).ToList();
                var clave = $"{a.Nombre}|{b.Nombre}|{string.Join(",", miembros)}";
                if (!vistos.Add(clave)) continue;
                var km = HaversineKm(a.Lat, a.Lon, b.Lat, b.Lon) * 1.25;
                var indiv = km / RendimientoEfectivo() * 23.5 + Math.Round(km * CasetaPorKmEfectivo());
                var ahorro = Math.Round(indiv * (1 - 1.0 / info.N), 2);
                out_.Add(new CostosRutaCompartido
                {
                    De = a.Nombre, A = b.Nombre, Personas = miembros, Conductor = info.Conductor,
                    AhorroEstimadoMxn = ahorro,
                    Nota = compartirActivo
                        ? $"auto compartido entre {info.N}" + (info.Conductor is not null ? $" (maneja {info.Conductor})" : " (renta compartida)")
                        : $"ahorro potencial si comparten (~${ahorro:F0} por persona con seed magna/casetas)",
                });
            }
        return out_;
    }
}
