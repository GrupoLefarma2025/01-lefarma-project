using FluentAssertions;
using Lefarma.API.Features.EducacionMedica.Services;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class RankingScoreEngineTests
{
    private static RankingConfig ConfigV1(decimal? agrupabilidad = null) => new()
    {
        PesoAnestesias = 40m,
        PesoQuirofanos = 15m,
        PesoRecencia = 25m,
        PesoAgrupabilidad = agrupabilidad ?? 20m,
    };

    [Fact]
    public void ComputeRanking_BasicRanking_ReturnsOrderedByScore()
    {
        var candidatos = new List<HospitalCandidato>
        {
            new() { IdHospital = 1, AnestesiasTotales = 100, NumeroQuirofanos = 2, MesesDesdeUltimaSeleccion = 0 },
            new() { IdHospital = 2, AnestesiasTotales = 200, NumeroQuirofanos = 4, MesesDesdeUltimaSeleccion = 6 },
            new() { IdHospital = 3, AnestesiasTotales = 300, NumeroQuirofanos = 6, MesesDesdeUltimaSeleccion = 12 },
        };

        var resultado = RankingScoreEngine.ComputeRanking(candidatos, ConfigV1());

        resultado.Hospitales.Should().HaveCount(3);
        resultado.Hospitales.Select(h => h.IdHospital).Should().ContainInOrder(3, 2, 1);
        resultado.PesosEfectivos.Values.Sum().Should().Be(100m);
    }

    [Fact]
    public void ComputeRanking_NullValues_GetNeutral50AndExcludedFromPercentile()
    {
        var candidatos = new List<HospitalCandidato>
        {
            new() { IdHospital = 1, AnestesiasTotales = 100, NumeroQuirofanos = 2 },
            new() { IdHospital = 2, AnestesiasTotales = null, NumeroQuirofanos = 4 },
            new() { IdHospital = 3, AnestesiasTotales = 300, NumeroQuirofanos = 6 },
        };

        var resultado = RankingScoreEngine.ComputeRanking(candidatos, ConfigV1());

        var factorH2 = resultado.Hospitales
            .Single(h => h.IdHospital == 2)
            .Factores.Single(f => f.Clave == "anestesias_totales");

        factorH2.ScoreFactor.Should().Be(50m);
        factorH2.DatoDisponible.Should().BeFalse();

        resultado.Hospitales.Should().HaveCount(3);
    }

    [Fact]
    public void ComputeRanking_ConstantFactor_RedistributesWeightToRemainingFactors()
    {
        var candidatos = new List<HospitalCandidato>
        {
            new() { IdHospital = 1, AnestesiasTotales = 100, NumeroQuirofanos = 2, MesesDesdeUltimaSeleccion = 0 },
            new() { IdHospital = 2, AnestesiasTotales = 100, NumeroQuirofanos = 4, MesesDesdeUltimaSeleccion = 6 },
            new() { IdHospital = 3, AnestesiasTotales = 100, NumeroQuirofanos = 6, MesesDesdeUltimaSeleccion = 12 },
        };

        var config = ConfigV1(0m); // aislar agrupabilidad para simplificar
        var resultado = RankingScoreEngine.ComputeRanking(candidatos, config);

        var anestesias = resultado.Hospitales.First().Factores.Single(f => f.Clave == "anestesias_totales");
        anestesias.PesoEfectivo.Should().Be(0m);

        resultado.PesosEfectivos["recencia_seleccion"].Should().BeApproximately(62.5m, 0.01m);
        resultado.PesosEfectivos["numero_quirofanos"].Should().BeApproximately(37.5m, 0.01m);
        resultado.PesosEfectivos.Values.Sum().Should().Be(100m);
    }

    [Theory]
    [InlineData(null, 100)]
    [InlineData(0, 10)]
    [InlineData(2, 10)]
    [InlineData(3, 40)]
    [InlineData(5, 40)]
    [InlineData(6, 70)]
    [InlineData(11, 70)]
    [InlineData(12, 90)]
    [InlineData(24, 90)]
    public void ComputeRanking_RecenciaScoring_UsesCorrectBuckets(int? meses, decimal esperado)
    {
        var candidatos = new List<HospitalCandidato>
        {
            new() { IdHospital = 1, MesesDesdeUltimaSeleccion = meses },
        };

        var config = new RankingConfig
        {
            PesoAnestesias = 0m,
            PesoQuirofanos = 0m,
            PesoRecencia = 100m,
            PesoAgrupabilidad = 0m,
        };

        var resultado = RankingScoreEngine.ComputeRanking(candidatos, config);

        resultado.Hospitales.Single().Factores
            .Single(f => f.Clave == "recencia_seleccion").ScoreFactor
            .Should().Be(esperado);
    }

    [Fact]
    public void ComputeRanking_AgrupabilidadForaneo_ScoresByNeighborBuckets()
    {
        // Puntos a 5 km de distancia para tener vecinos controlados
        var baseLat = 19.43;
        var baseLon = -99.13;
        var candidatos = new List<HospitalCandidato>
        {
            new() { IdHospital = 1, Latitud = baseLat, Longitud = baseLon, EsZonaMetropolitana = false },
            new() { IdHospital = 2, Latitud = baseLat + 0.01, Longitud = baseLon + 0.01, EsZonaMetropolitana = false }, // ~1.5 km
            new() { IdHospital = 3, Latitud = baseLat + 0.02, Longitud = baseLon + 0.02, EsZonaMetropolitana = false }, // ~3.1 km
            new() { IdHospital = 4, Latitud = baseLat + 0.03, Longitud = baseLon + 0.03, EsZonaMetropolitana = false }, // ~4.7 km
            new() { IdHospital = 5, Latitud = baseLat + 0.08, Longitud = baseLon + 0.08, EsZonaMetropolitana = false }, // ~12.5 km
        };

        var config = new RankingConfig
        {
            PesoAnestesias = 0m,
            PesoQuirofanos = 0m,
            PesoRecencia = 0m,
            PesoAgrupabilidad = 100m,
            RadioAgrupabilidadKm = 5,
        };

        var resultado = RankingScoreEngine.ComputeRanking(candidatos, config);

        var h1 = resultado.Hospitales.Single(h => h.IdHospital == 1);
        h1.Factores.Single(f => f.Clave == "agrupabilidad_geografica").ScoreFactor.Should().Be(100m); // 3 vecinos

        var h5 = resultado.Hospitales.Single(h => h.IdHospital == 5);
        h5.Factores.Single(f => f.Clave == "agrupabilidad_geografica").ScoreFactor.Should().Be(0m); // 0 vecinos
    }

    [Fact]
    public void ComputeRanking_SinCoordenadas_GetsNeutral50()
    {
        var candidatos = new List<HospitalCandidato>
        {
            new() { IdHospital = 1, Latitud = 19.43, Longitud = -99.13, EsZonaMetropolitana = false },
            new() { IdHospital = 2 },
        };

        var config = new RankingConfig
        {
            PesoAnestesias = 0m,
            PesoQuirofanos = 0m,
            PesoRecencia = 0m,
            PesoAgrupabilidad = 100m,
        };

        var resultado = RankingScoreEngine.ComputeRanking(candidatos, config);

        var h2 = resultado.Hospitales.Single(h => h.IdHospital == 2);
        var factor = h2.Factores.Single(f => f.Clave == "agrupabilidad_geografica");
        factor.ScoreFactor.Should().Be(50m);
        factor.DatoDisponible.Should().BeFalse();
    }

    [Fact]
    public void ComputeRanking_SingleCandidate_PercentilIs100()
    {
        var candidatos = new List<HospitalCandidato>
        {
            new() { IdHospital = 1, AnestesiasTotales = 50, NumeroQuirofanos = 1, MesesDesdeUltimaSeleccion = 6 },
        };

        var config = ConfigV1(0m);
        var resultado = RankingScoreEngine.ComputeRanking(candidatos, config);

        var h = resultado.Hospitales.Single();
        h.Factores.Single(f => f.Clave == "anestesias_totales").ScoreFactor.Should().Be(100m);
        h.Factores.Single(f => f.Clave == "numero_quirofanos").ScoreFactor.Should().Be(100m);
    }

    [Theory]
    [InlineData(CoberturaTallerEstado.Nunca, 100)]
    [InlineData(CoberturaTallerEstado.Pendiente, 90)]
    [InlineData(CoberturaTallerEstado.Realizado, 10)]
    public void ComputeRanking_CoberturaTallerScoring_UsesCorrectScores(
        CoberturaTallerEstado estado,
        decimal esperado)
    {
        var candidatos = new List<HospitalCandidato>
        {
            new() { IdHospital = 1, EstadoCoberturaTaller = estado },
        };

        var config = new RankingConfig
        {
            PesoAnestesias = 0m,
            PesoQuirofanos = 0m,
            PesoRecencia = 0m,
            PesoAgrupabilidad = 0m,
            PesoCoberturaTaller = 100m,
        };

        var resultado = RankingScoreEngine.ComputeRanking(candidatos, config);

        resultado.Hospitales.Single().Factores
            .Single(f => f.Clave == "cobertura_taller").ScoreFactor
            .Should().Be(esperado);
    }

    [Fact]
    public void ComputeRanking_CoberturaTallerConstante_RedistribuyePesoALosDemasFactores()
    {
        var candidatos = new List<HospitalCandidato>
        {
            new() { IdHospital = 1, AnestesiasTotales = 100, EstadoCoberturaTaller = CoberturaTallerEstado.Realizado },
            new() { IdHospital = 2, AnestesiasTotales = 200, EstadoCoberturaTaller = CoberturaTallerEstado.Realizado },
        };

        var config = new RankingConfig
        {
            PesoAnestesias = 85m,
            PesoQuirofanos = 0m,
            PesoRecencia = 0m,
            PesoAgrupabilidad = 0m,
            PesoCoberturaTaller = 15m,
        };

        var resultado = RankingScoreEngine.ComputeRanking(candidatos, config);

        var cobertura = resultado.Hospitales.First().Factores.Single(f => f.Clave == "cobertura_taller");
        cobertura.PesoEfectivo.Should().Be(0m);
        cobertura.Aplicado.Should().BeFalse();
        cobertura.MotivoNoAplicado.Should().Be("sin_variabilidad");

        resultado.PesosEfectivos["anestesias_totales"].Should().Be(100m);
        resultado.PesosEfectivos.Values.Sum().Should().Be(100m);
    }

    [Fact]
    public void ComputeRanking_TramosRecenciaCustom_UsaLosValoresConfigurados()
    {
        var candidatos = new List<HospitalCandidato>
        {
            new() { IdHospital = 1, MesesDesdeUltimaSeleccion = 2 },
            new() { IdHospital = 2, MesesDesdeUltimaSeleccion = 4 },
        };

        var config = new RankingConfig
        {
            PesoAnestesias = 0m,
            PesoQuirofanos = 0m,
            PesoRecencia = 100m,
            PesoAgrupabilidad = 0m,
            ScoreRecenciaReciente = 55m,
            TramosRecencia = [new RecenciaTramo { MesesMin = 3, Score = 80 }],
        };

        var resultado = RankingScoreEngine.ComputeRanking(candidatos, config);

        resultado.Hospitales.Single(h => h.IdHospital == 1).Factores
            .Single(f => f.Clave == "recencia_seleccion").ScoreFactor.Should().Be(55m);
        resultado.Hospitales.Single(h => h.IdHospital == 2).Factores
            .Single(f => f.Clave == "recencia_seleccion").ScoreFactor.Should().Be(80m);
    }

    [Fact]
    public void ComputeRanking_CoberturaTallerCustom_UsaLosValoresConfigurados()
    {
        var candidatos = new List<HospitalCandidato>
        {
            new() { IdHospital = 1, EstadoCoberturaTaller = CoberturaTallerEstado.Realizado },
        };

        var config = new RankingConfig
        {
            PesoAnestesias = 0m,
            PesoQuirofanos = 0m,
            PesoRecencia = 0m,
            PesoAgrupabilidad = 0m,
            PesoCoberturaTaller = 100m,
            ScoreCoberturaRealizado = 25m,
        };

        var resultado = RankingScoreEngine.ComputeRanking(candidatos, config);

        resultado.Hospitales.Single().Factores
            .Single(f => f.Clave == "cobertura_taller").ScoreFactor.Should().Be(25m);
    }

    [Fact]
    public void ComputeRanking_EmptyList_ReturnsEmptyResult()
    {
        var resultado = RankingScoreEngine.ComputeRanking([], ConfigV1());

        resultado.Hospitales.Should().BeEmpty();
        resultado.CantidadCandidatos.Should().Be(0);
    }
}
