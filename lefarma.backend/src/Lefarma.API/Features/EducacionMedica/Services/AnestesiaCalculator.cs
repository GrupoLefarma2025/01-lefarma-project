using Lefarma.API.Domain.Entities.EducacionMedica;

namespace Lefarma.API.Features.EducacionMedica.Services;

public static class AnestesiaCalculator
{
    public static void Calcular(HospitalExtension extension, IReadOnlyDictionary<string, decimal> factores)
    {
        var nq = extension.NumeroQuirofanos;
        if (!nq.HasValue || nq.Value <= 0)
        {
            extension.AnestesiasTotales = null;
            extension.AnestesiasGenerales = null;
            extension.AnestesiasRegionales = null;
            extension.AnestesiasEpidurales = null;
            extension.AnestesiasSubdurales = null;
            extension.AnestesiasMixtasObesos = null;
            extension.AnestesiasMixtasNoObesos = null;
            return;
        }

        var cirugiasDia = GetFactor(factores, "factor_cirugias_dia");
        var diasAnio = GetFactor(factores, "dias_laborables_anio");

        var at = nq.Value * cirugiasDia * diasAnio;
        extension.AnestesiasTotales = Round(at);

        extension.AnestesiasGenerales = Round(at * GetFactor(factores, "pct_generales"));
        extension.AnestesiasRegionales = Round(at * GetFactor(factores, "pct_regionales"));

        var ar = extension.AnestesiasRegionales ?? 0m;
        extension.AnestesiasEpidurales = Round(ar * GetFactor(factores, "pct_epidurales"));
        extension.AnestesiasSubdurales = Round(ar * GetFactor(factores, "pct_subdurales"));
        extension.AnestesiasMixtasObesos = Round(ar * GetFactor(factores, "pct_mixtas_obesos"));
        extension.AnestesiasMixtasNoObesos = Round(ar * GetFactor(factores, "pct_mixtas_no_obesos"));
    }

    private static decimal GetFactor(IReadOnlyDictionary<string, decimal> factores, string clave)
    {
        if (!factores.TryGetValue(clave, out var valor))
        {
            throw new InvalidOperationException($"No se encontro el factor '{clave}' en los parametros de anestesias activos.");
        }

        return valor;
    }

    private static decimal Round(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
}
