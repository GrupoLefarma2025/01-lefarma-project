namespace Lefarma.API.Features.EducacionMedica.Services;

public static class Haversine
{
    private const double RadioTierraKm = 6371.0;

    public static double DistanciaKm(double latitud1, double longitud1, double latitud2, double longitud2)
    {
        var lat1Rad = GradosARadianes(latitud1);
        var lat2Rad = GradosARadianes(latitud2);
        var deltaLat = GradosARadianes(latitud2 - latitud1);
        var deltaLon = GradosARadianes(longitud2 - longitud1);

        var a = Math.Sin(deltaLat / 2) * Math.Sin(deltaLat / 2)
                + Math.Cos(lat1Rad) * Math.Cos(lat2Rad) * Math.Sin(deltaLon / 2) * Math.Sin(deltaLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

        return RadioTierraKm * c;
    }

    private static double GradosARadianes(double grados) => grados * Math.PI / 180.0;
}
