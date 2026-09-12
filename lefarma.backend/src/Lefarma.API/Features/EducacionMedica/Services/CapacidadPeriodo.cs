using System.Globalization;

namespace Lefarma.API.Features.EducacionMedica.Services;

public static class CapacidadPeriodo
{
    public const int MaxVisitasPorDia = 3;
    public const int MaxVisitasPorSemana = 8;

    public static int Calcular(DateOnly inicio, DateOnly fin, int maxPorDia, int maxPorSemana)
    {
        if (fin < inicio)
        {
            return 0;
        }

        var porSemana = new Dictionary<(int Anio, int Semana), int>();

        for (var fecha = inicio; fecha <= fin; fecha = fecha.AddDays(1))
        {
            if (fecha.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            {
                continue;
            }

            var clave = (ISOWeek.GetYear(fecha.ToDateTime(TimeOnly.MinValue)), ISOWeek.GetWeekOfYear(fecha.ToDateTime(TimeOnly.MinValue)));
            porSemana[clave] = porSemana.GetValueOrDefault(clave) + 1;
        }

        var capacidad = 0;
        foreach (var diasLaborales in porSemana.Values)
        {
            capacidad += Math.Min(maxPorSemana, diasLaborales * maxPorDia);
        }

        return capacidad;
    }
}
