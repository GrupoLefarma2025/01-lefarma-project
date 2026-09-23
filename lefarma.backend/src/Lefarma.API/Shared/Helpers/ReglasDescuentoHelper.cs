using System.Globalization;
using Lefarma.API.Domain.Entities.Rh;

namespace Lefarma.API.Shared.Helpers;

public static class ReglasDescuentoHelper
{
    public static string FormatearTexto(IEnumerable<IncidenciaChecadoConfig> reglas)
    {
        var textos = reglas
            .OrderByDescending(r => r.Prioridad)
            .Select(r =>
            {
                var periodo = r.Periodo?.ToLowerInvariant() switch
                {
                    PeriodoHelper.Quincena => "la quincena",
                    PeriodoHelper.Semana => "la semana",
                    _ => "el mes"
                };

                return r.CantidadAcumulada > 1
                    ? $"cada {r.CantidadAcumulada} \"{r.Nombre}\" en {periodo} generan 1 descuento"
                    : $"cada \"{r.Nombre}\" genera 1 descuento";
            })
            .ToList();

        if (textos.Count == 0)
            return string.Empty;

        textos[0] = char.ToUpper(textos[0][0], CultureInfo.InvariantCulture) + textos[0][1..];
        return string.Join("; ", textos) + ".";
    }
}
