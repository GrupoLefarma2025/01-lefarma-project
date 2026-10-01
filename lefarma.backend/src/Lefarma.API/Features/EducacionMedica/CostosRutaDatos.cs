using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

public static class CostosRutaGeo
{
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
}

// Seeds MXN aprox (2025-2026), siempre etiquetados con su `fuente`.
public static class CostosRutaSeeds
{
    public static readonly Dictionary<string, (string Nombre, double Lat, double Lon, string? Iata)> Ciudades = new()
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

    public static readonly Dictionary<string, double> CasetasIda = new()
    {
        ["CDMX-GDL"] = 950, ["CDMX-MTY"] = 1180, ["CDMX-QRO"] = 330, ["CDMX-PUE"] = 180,
        ["GDL-MTY"] = 900, ["CDMX-CUN"] = 1450, ["GDL-CUN"] = 1250,
    };

    public static readonly Dictionary<string, (double Base, double PorKm)> Taxi = new()
    {
        ["CDMX"] = (30, 11), ["GDL"] = (28, 10), ["MTY"] = (30, 12), ["QRO"] = (25, 10),
        ["PUE"] = (27, 10), ["CUN"] = (35, 13), ["TIJ"] = (32, 12),
        ["XAL"] = (27, 10), ["BJX"] = (28, 10),
    };

    public static readonly Dictionary<string, (double ComidaDia, double HospedajeNoche)> Viaticos = new()
    {
        ["CDMX"] = (811, 3533), ["GDL"] = (653, 2006), ["MTY"] = (674, 2353), ["QRO"] = (596, 1700),
        ["PUE"] = (546, 1500), ["CUN"] = (627, 2300), ["TIJ"] = (640, 2100),
        ["XAL"] = (546, 1500), ["BJX"] = (596, 1700),
    };

    public const double CasetaPorKm = 1.4;
    public const double ComidaDiaEstandar = 600;
    public const int BufferMin = 30;
    public const double SnapKm = 25.0;
    public const string CapufeUrl = "https://www.capufe.gob.mx/#/tarifas";
    public const string UberEstimateUrl = "https://www.uber.com/mx/es/price-estimate/";
    public const string DidiUrl = "https://web.didiglobal.com/mx/pasajero/";

    public static (string? Key, double Dist) SnapCiudad(double lat, double lon)
    {
        string? mejor = null;
        var md = double.MaxValue;
        foreach (var (k, c) in Ciudades)
        {
            var d = CostosRutaGeo.HaversineKm(lat, lon, c.Lat, c.Lon);
            if (d < md) { md = d; mejor = k; }
        }
        return md <= SnapKm ? (mejor, md) : (null, md);
    }

    public static List<ViajeBus> ViajesBusSeed(DateOnly fecha, double km, string fuente)
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
            return new ViajeBus(l.Item1, sal, arr, Math.Round(fare * 0.88, 2), Math.Round(fare * 1.15, 2),
                null, fuente, l.Item6, l.Item7);
        }).ToList();
    }
}
