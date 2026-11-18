namespace Lefarma.API.Features.Viaticos;

/// <summary>
/// Aeropuertos mexicanos con servicio programado (OurAirports, 2026), con
/// coordenadas para resolver el aeropuerto mas cercano cuando el punto no
/// tiene IATA propio. Se usa solo como hub: el traslado punto-hub se cobra
/// como taxi en el motor.
/// </summary>
internal static class AeropuertosCatalogo
{
    internal sealed record Aeropuerto(string Iata, string Nombre, string Ciudad, double Lat, double Lon);

    private static readonly Dictionary<string, Aeropuerto> _porIata = new(StringComparer.OrdinalIgnoreCase)
    {
        ["ACA"] = new Aeropuerto("ACA", "General Juan N. Álvarez International Airport", "Acapulco", 16.757126, -99.753113),
        ["AGU"] = new Aeropuerto("AGU", "Aguascalientes International Airport", "Aguascalientes", 21.699589, -102.318372),
        ["BJX"] = new Aeropuerto("BJX", "Aeropuerto Internacional del Bajío", "Silao", 20.992695, -101.480284),
        ["CEN"] = new Aeropuerto("CEN", "Ciudad Obregón International Airport", "Ciudad Obregón", 27.39259910583496, -109.83300018310547),
        ["CJS"] = new Aeropuerto("CJS", "Abraham González International Airport", "Ciudad Juárez", 31.636673, -106.428533),
        ["CLQ"] = new Aeropuerto("CLQ", "Licenciado Miguel de la Madrid International Airport", "Colima", 19.277, -103.577002),
        ["CME"] = new Aeropuerto("CME", "Ciudad del Carmen International Airport", "Ciudad del Carmen", 18.651516, -91.799355),
        ["CPE"] = new Aeropuerto("CPE", "Ingeniero Alberto Acuña Ongay International Airport", "Campeche", 19.815969, -90.500125),
        ["CSW"] = new Aeropuerto("CSW", "Cabo San Lucas International Airport", "Cabo San Lucas", 22.949072, -109.939479),
        ["CTM"] = new Aeropuerto("CTM", "Chetumal International Airport", "Chetumal", 18.504985, -88.328018),
        ["CUL"] = new Aeropuerto("CUL", "Bachigualato Federal International Airport", "Culiacán", 24.76504, -107.475228),
        ["CUN"] = new Aeropuerto("CUN", "Aeropuerto Internacional de Cancún", "Cancún", 21.040817, -86.87347),
        ["CUU"] = new Aeropuerto("CUU", "General Roberto Fierro Villalobos International Airport", "Chihuahua", 28.702649, -105.963764),
        ["CVM"] = new Aeropuerto("CVM", "General Pedro Jose Mendez International Airport", "Ciudad Victoria", 23.7033, -98.956497),
        ["CZM"] = new Aeropuerto("CZM", "Cozumel International Airport", "Cozumel", 20.514922, -86.928538),
        ["DGO"] = new Aeropuerto("DGO", "General Guadalupe Victoria International Airport", "Durango", 24.125468, -104.527938),
        ["GDL"] = new Aeropuerto("GDL", "Aeropuerto Internacional de Guadalajara", "Guadalajara", 20.523342, -103.310108),
        ["GYM"] = new Aeropuerto("GYM", "General José María Yáñez International Airport", "Guaymas", 27.9689998626709, -110.92500305175781),
        ["HMO"] = new Aeropuerto("HMO", "General Ignacio L. Pesqueira International Airport", "Hermosillo", 29.092811, -111.053015),
        ["HUX"] = new Aeropuerto("HUX", "Bahías de Huatulco International Airport", "Huatulco", 15.775437, -96.260456),
        ["IZT"] = new Aeropuerto("IZT", "General Antonio Cárdenas Rodríguez National Airport / Ixtepec Air Base", "Ixtepec", 16.445961, -95.093708),
        ["LAP"] = new Aeropuerto("LAP", "Manuel Márquez de León International Airport", "La Paz", 24.072331, -110.362662),
        ["LMM"] = new Aeropuerto("LMM", "Valle del Fuerte International Airport", "Los Mochis", 25.685503, -109.081159),
        ["LTO"] = new Aeropuerto("LTO", "Loreto International Airport", "Loreto", 25.989549, -111.348408),
        ["MAM"] = new Aeropuerto("MAM", "General Servando Canales International Airport", "Matamoros", 25.7698993683, -97.5252990723),
        ["MEX"] = new Aeropuerto("MEX", "Aeropuerto Internacional Benito Juárez", "Ciudad de México", 19.435822, -99.07033),
        ["MID"] = new Aeropuerto("MID", "Manuel Crescencio Rejón International Airport", "Mérida", 20.930485, -89.645462),
        ["MLM"] = new Aeropuerto("MLM", "General Francisco J. Mujica International Airport", "Morelia", 19.849899, -101.025002),
        ["MTT"] = new Aeropuerto("MTT", "Minatitlán/Coatzacoalcos International Airport", "Cosoleacaque", 18.103399, -94.580704),
        ["MTY"] = new Aeropuerto("MTY", "Aeropuerto Internacional de Monterrey", "Monterrey", 25.778521, -100.106989),
        ["MXL"] = new Aeropuerto("MXL", "General Rodolfo Sánchez Taboada International Airport", "Mexicali", 32.630629, -115.242805),
        ["MZT"] = new Aeropuerto("MZT", "General Rafael Buelna International Airport", "Mazatlàn", 23.162823, -106.264517),
        ["NLD"] = new Aeropuerto("NLD", "Quetzalcóatl International Airport", "Nuevo Laredo", 27.443899, -99.570503),
        ["NLU"] = new Aeropuerto("NLU", "Felipe Ángeles International Airport", "Mexico City", 19.743824, -99.01507),
        ["OAX"] = new Aeropuerto("OAX", "Xoxocotlán International Airport", "Oaxaca", 16.998773, -96.726092),
        ["PAZ"] = new Aeropuerto("PAZ", "El Tajín National Airport", "Poza Rica", 20.6026992798, -97.46080017090001),
        ["PBC"] = new Aeropuerto("PBC", "Aeropuerto Internacional de Puebla", "Puebla", 19.158465, -98.371582),
        ["PDS"] = new Aeropuerto("PDS", "Piedras Negras International Airport", "Piedras Negras", 28.627873, -100.53524),
        ["PVR"] = new Aeropuerto("PVR", "Puerto Vallarta International Airport", "Puerto Vallarta", 20.679913, -105.254391),
        ["PXM"] = new Aeropuerto("PXM", "Puerto Escondido International Airport", "Puerto Escondido", 15.876808, -97.0891),
        ["QRO"] = new Aeropuerto("QRO", "Aeropuerto Intercontinental de Querétaro", "Querétaro", 20.618779, -100.186449),
        ["REX"] = new Aeropuerto("REX", "General Lucio Blanco International Airport", "Reynosa", 26.0089, -98.2285),
        ["SJD"] = new Aeropuerto("SJD", "Los Cabos International Airport", "San José del Cabo", 23.151919, -109.720731),
        ["SLP"] = new Aeropuerto("SLP", "Ponciano Arriaga International Airport", "San Luis Potosí", 22.262026, -100.935692),
        ["SLW"] = new Aeropuerto("SLW", "Plan de Guadalupe International Airport", "Saltillo", 25.53786, -100.928346),
        ["TAM"] = new Aeropuerto("TAM", "General Francisco Javier Mina International Airport", "Ciudad Madero", 22.292622, -97.867058),
        ["TAP"] = new Aeropuerto("TAP", "Tapachula International Airport", "Tapachula", 14.794549, -92.369871),
        ["TGZ"] = new Aeropuerto("TGZ", "Angel Albino Corzo International Airport", "Tuxtla Gutiérrez", 16.561611, -93.025731),
        ["TIJ"] = new Aeropuerto("TIJ", "Aeropuerto Internacional de Tijuana", "Tijuana", 32.541043, -116.969976),
        ["TLC"] = new Aeropuerto("TLC", "Adolfo López Mateos International Airport", "Toluca", 19.3369, -99.56583),
        ["TPQ"] = new Aeropuerto("TPQ", "Amado Nervo National Airport", "Tepic", 21.419833, -104.842472),
        ["TQO"] = new Aeropuerto("TQO", "Felipe Carrillo Puerto International Airport Tulum", "Tulum", 20.172098, -87.660272),
        ["TRC"] = new Aeropuerto("TRC", "Francisco Sarabia Tinoco International Airport", "Torreón", 25.562265, -103.404608),
        ["UPN"] = new Aeropuerto("UPN", "Uruapan - Licenciado y General Ignacio Lopez Rayon International Airport", "Uruapan", 19.3967, -102.039001),
        ["VER"] = new Aeropuerto("VER", "General Heriberto Jara International Airport", "Veracruz", 19.139589, -96.188602),
        ["VSA"] = new Aeropuerto("VSA", "Carlos Rovirosa Pérez International Airport", "Villahermosa", 17.994283, -92.818199),
        ["ZCL"] = new Aeropuerto("ZCL", "General Leobardo C. Ruiz International Airport", "Zacatecas", 22.894942, -102.687154),
        ["ZIH"] = new Aeropuerto("ZIH", "Ixtapa-Zihuatanejo International Airport", "Ixtapa", 17.601771, -101.460629),
        ["ZLO"] = new Aeropuerto("ZLO", "Playa de Oro International Airport", "Manzanillo", 19.1448, -104.558998),
        // JAL no aparece con servicio programado en OurAirports; se conserva
        // porque el motor ya lo usa para Xalapa.
        ["JAL"] = new Aeropuerto("JAL", "Aeropuerto Nacional El Lencero", "Xalapa", 19.4751, -96.7973),
    };

    internal static Aeropuerto? Obtener(string? iata)
        => string.IsNullOrWhiteSpace(iata) ? null : _porIata.GetValueOrDefault(iata);

    internal static Aeropuerto? MasCercano(double lat, double lon, double maxKm)
    {
        if (!double.IsFinite(lat) || !double.IsFinite(lon) || (lat == 0 && lon == 0)) return null;

        Aeropuerto? mejor = null;
        var mejorKm = double.MaxValue;
        foreach (var aeropuerto in _porIata.Values)
        {
            var km = HaversineKm(lat, lon, aeropuerto.Lat, aeropuerto.Lon);
            if (km >= mejorKm) continue;
            mejorKm = km;
            mejor = aeropuerto;
        }
        return mejorKm <= maxKm ? mejor : null;
    }

    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double radioTierraKm = 6371.0;
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
            + Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0)
            * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 2 * radioTierraKm * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }
}