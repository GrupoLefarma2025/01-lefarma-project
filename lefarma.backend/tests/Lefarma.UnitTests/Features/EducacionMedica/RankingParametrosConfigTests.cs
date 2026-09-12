using FluentAssertions;
using Lefarma.API.Features.EducacionMedica.Services;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class RankingParametrosConfigTests
{
    private static RankingConfig ConfigDefaults() => new()
    {
        PesoAnestesias = 35m,
        PesoQuirofanos = 10m,
        PesoRecencia = 20m,
        PesoAgrupabilidad = 20m,
        PesoCoberturaTaller = 15m,
    };

    [Fact]
    public void AplicarParametrosFactor_NullOVacio_MantieneDefaults()
    {
        var config = ConfigDefaults();

        RankingHospitalesService.AplicarParametrosFactor(config, "recencia_seleccion", null);
        RankingHospitalesService.AplicarParametrosFactor(config, "cobertura_taller", "  ");

        config.ScoreRecenciaNunca.Should().Be(100m);
        config.ScoreRecenciaReciente.Should().Be(10m);
        config.TramosRecencia.Should().HaveCount(3);
        config.ScoreCoberturaNunca.Should().Be(100m);
        config.ScoreCoberturaPendiente.Should().Be(90m);
        config.ScoreCoberturaRealizado.Should().Be(10m);
    }

    [Fact]
    public void AplicarParametrosFactor_JsonMalformado_MantieneDefaults()
    {
        var config = ConfigDefaults();

        RankingHospitalesService.AplicarParametrosFactor(config, "recencia_seleccion", "{no-es-json");

        config.ScoreRecenciaNunca.Should().Be(100m);
        config.TramosRecencia.Should().HaveCount(3);
        config.TramosRecencia[0].MesesMin.Should().Be(12);
    }

    [Fact]
    public void AplicarParametrosFactor_RecenciaValida_AplicaTramosYScores()
    {
        var config = ConfigDefaults();
        var json = """
            {"nunca":95,"reciente":15,"tramos":[{"meses_min":9,"score":85},{"meses_min":4,"score":50}]}
            """;

        RankingHospitalesService.AplicarParametrosFactor(config, "recencia_seleccion", json);

        config.ScoreRecenciaNunca.Should().Be(95m);
        config.ScoreRecenciaReciente.Should().Be(15m);
        config.TramosRecencia.Should().HaveCount(2);
        config.TramosRecencia[0].MesesMin.Should().Be(9);
        config.TramosRecencia[0].Score.Should().Be(85m);
        config.TramosRecencia[1].MesesMin.Should().Be(4);
        config.TramosRecencia[1].Score.Should().Be(50m);
    }

    [Fact]
    public void AplicarParametrosFactor_CoberturaValida_AplicaScores()
    {
        var config = ConfigDefaults();
        var json = """{"nunca":90,"pendiente":80,"realizado":20}""";

        RankingHospitalesService.AplicarParametrosFactor(config, "cobertura_taller", json);

        config.ScoreCoberturaNunca.Should().Be(90m);
        config.ScoreCoberturaPendiente.Should().Be(80m);
        config.ScoreCoberturaRealizado.Should().Be(20m);
    }

    [Fact]
    public void AplicarParametrosFactor_RadioValido_AplicaRadio()
    {
        var config = ConfigDefaults();
        var json = """{"radio_km":25}""";

        RankingHospitalesService.AplicarParametrosFactor(config, "agrupabilidad_geografica", json);

        config.RadioAgrupabilidadKm.Should().Be(25);
    }

    [Fact]
    public void AplicarParametrosFactor_TramosIncompletos_ConservaTramosPrevios()
    {
        var config = ConfigDefaults();
        var json = """{"nunca":98,"tramos":[{"meses_min":12,"score":80},{"sin_score":true}]}""";

        RankingHospitalesService.AplicarParametrosFactor(config, "recencia_seleccion", json);

        // nunca aplica; los tramos validos reemplazan a los defaults (1 de 2 parseables)
        config.ScoreRecenciaNunca.Should().Be(98m);
        config.TramosRecencia.Should().ContainSingle();
        config.TramosRecencia[0].Score.Should().Be(80m);
    }
}
