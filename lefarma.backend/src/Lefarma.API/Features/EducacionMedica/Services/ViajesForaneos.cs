namespace Lefarma.API.Features.EducacionMedica.Services;

public static class ViajesForaneos
{
    public static int Contar(IEnumerable<(DateOnly Fecha, bool EsForanea, int? IdRegion)> visitas)
    {
        var foraneas = visitas
            .Where(v => v.EsForanea)
            .Select(v => (v.Fecha, IdRegion: v.IdRegion))
            .Distinct()
            .OrderBy(v => v.Fecha)
            .ThenBy(v => v.IdRegion)
            .ToList();

        if (foraneas.Count == 0)
        {
            return 0;
        }

        var viajes = 1;
        for (var i = 1; i < foraneas.Count; i++)
        {
            var (fecha, idRegion) = foraneas[i];
            var (fechaAnterior, regionAnterior) = foraneas[i - 1];

            var diaConsecutivo = fecha.DayNumber == fechaAnterior.DayNumber + 1;
            var mismaRegion = Nullable.Equals(idRegion, regionAnterior);

            if (!diaConsecutivo || !mismaRegion)
            {
                viajes++;
            }
        }

        return viajes;
    }
}
