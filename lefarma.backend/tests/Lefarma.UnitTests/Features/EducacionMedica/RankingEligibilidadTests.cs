using FluentAssertions;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Features.EducacionMedica.Services;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class RankingEligibilidadTests
{
    private const int GerenciaImss = 1;
    private const int GerenciaDescentralizado = 2;

    private static Hospital Hospital(int codigoContacto) => new() { CodigoContacto = codigoContacto };

    private static Hospital HospitalConDatos(
        int codigoContacto,
        string? nombre = null,
        string? ciudad = null,
        string? colonia = null,
        string? codigoEstado = null)
    {
        return new Hospital
        {
            CodigoContacto = codigoContacto,
            NombreContacto = nombre,
            Ciudad = ciudad,
            Colonia = colonia,
            CodigoEstado = codigoEstado,
        };
    }

    private static Dictionary<int, HospitalExtension> Extensiones(params (int IdHospital, int? IdTipoGerencia, bool? EsZonaMetropolitana)[] datos)
    {
        return datos.ToDictionary(
            d => d.IdHospital,
            d => new HospitalExtension
            {
                IdHospital = d.IdHospital,
                IdTipoGerencia = d.IdTipoGerencia,
                EsZonaMetropolitana = d.EsZonaMetropolitana,
            });
    }

    private static Dictionary<int, HospitalExtension> ExtensionesGerencia(params (int IdHospital, int? IdTipoGerencia)[] datos)
    {
        return datos.ToDictionary(
            d => d.IdHospital,
            d => new HospitalExtension { IdHospital = d.IdHospital, IdTipoGerencia = d.IdTipoGerencia });
    }

    [Fact]
    public void FiltrarPorGerencia_MismaGerencia_SeIncluye()
    {
        var hospitales = new List<Hospital> { Hospital(101) };
        var extensiones = ExtensionesGerencia((101, GerenciaImss));

        var (candidatos, excluidos) = RankingHospitalesService.FiltrarPorGerencia(
            hospitales, extensiones, GerenciaImss);

        candidatos.Should().ContainSingle(h => h.CodigoContacto == 101);
        excluidos.Should().Be(0);
    }

    [Fact]
    public void FiltrarPorGerencia_OtraGerencia_SeExcluye()
    {
        var hospitales = new List<Hospital> { Hospital(201) };
        var extensiones = ExtensionesGerencia((201, GerenciaDescentralizado));

        var (candidatos, excluidos) = RankingHospitalesService.FiltrarPorGerencia(
            hospitales, extensiones, GerenciaImss);

        candidatos.Should().BeEmpty();
        excluidos.Should().Be(1);
    }

    [Fact]
    public void FiltrarPorGerencia_SinFilaExtension_SeExcluye()
    {
        var hospitales = new List<Hospital> { Hospital(301) };
        var extensiones = new Dictionary<int, HospitalExtension>();

        var (candidatos, excluidos) = RankingHospitalesService.FiltrarPorGerencia(
            hospitales, extensiones, GerenciaImss);

        candidatos.Should().BeEmpty();
        excluidos.Should().Be(1);
    }

    [Fact]
    public void FiltrarPorGerencia_GerenciaNulaEnExtension_SeExcluye()
    {
        var hospitales = new List<Hospital> { Hospital(401) };
        var extensiones = ExtensionesGerencia((401, null));

        var (candidatos, excluidos) = RankingHospitalesService.FiltrarPorGerencia(
            hospitales, extensiones, GerenciaImss);

        candidatos.Should().BeEmpty();
        excluidos.Should().Be(1);
    }

    [Fact]
    public void FiltrarPorGerencia_UniversoMixto_SeparaCandidatosYExcluidos()
    {
        var hospitales = new List<Hospital>
        {
            Hospital(1), Hospital(2), Hospital(3), Hospital(4),
        };
        var extensiones = ExtensionesGerencia(
            (1, GerenciaImss),
            (2, GerenciaImss),
            (3, GerenciaDescentralizado),
            (4, null));

        var (candidatos, excluidos) = RankingHospitalesService.FiltrarPorGerencia(
            hospitales, extensiones, GerenciaImss);

        candidatos.Select(h => h.CodigoContacto).Should().BeEquivalentTo(new[] { 1, 2 });
        excluidos.Should().Be(2);
    }

    [Fact]
    public void FiltrarPorGerencia_GerenciaDescentralizada_ConsideraSoloSusHospitales()
    {
        var hospitales = new List<Hospital> { Hospital(1), Hospital(2) };
        var extensiones = ExtensionesGerencia((1, GerenciaImss), (2, GerenciaDescentralizado));

        var (candidatos, excluidos) = RankingHospitalesService.FiltrarPorGerencia(
            hospitales, extensiones, GerenciaDescentralizado);

        candidatos.Select(h => h.CodigoContacto).Should().BeEquivalentTo(new[] { 2 });
        excluidos.Should().Be(1);
    }

    [Fact]
    public void AplicarFiltrosOpcionales_SinFiltros_DevuelveTodos()
    {
        var hospitales = new List<Hospital>
        {
            HospitalConDatos(1, nombre: "Hospital A"),
            HospitalConDatos(2, nombre: "Hospital B"),
        };
        var extensiones = Extensiones((1, GerenciaImss, true), (2, GerenciaImss, false));
        var request = new GenerarRankingRequest();

        var (candidatos, excluidos) = RankingHospitalesService.AplicarFiltrosOpcionales(
            hospitales, extensiones, request);

        candidatos.Select(h => h.CodigoContacto).Should().BeEquivalentTo(new[] { 1, 2 });
        excluidos.Should().Be(0);
    }

    [Fact]
    public void AplicarFiltrosOpcionales_BusquedaPorNombre_Filtra()
    {
        var hospitales = new List<Hospital>
        {
            HospitalConDatos(1, nombre: "Hospital Norte"),
            HospitalConDatos(2, nombre: "Hospital Sur"),
        };
        var extensiones = ExtensionesGerencia((1, GerenciaImss), (2, GerenciaImss));
        var request = new GenerarRankingRequest { Search = "Norte" };

        var (candidatos, excluidos) = RankingHospitalesService.AplicarFiltrosOpcionales(
            hospitales, extensiones, request);

        candidatos.Select(h => h.CodigoContacto).Should().BeEquivalentTo(new[] { 1 });
        excluidos.Should().Be(1);
    }

    [Fact]
    public void AplicarFiltrosOpcionales_CodigoEstado_Filtra()
    {
        var hospitales = new List<Hospital>
        {
            HospitalConDatos(1, codigoEstado: "19"),
            HospitalConDatos(2, codigoEstado: "20"),
        };
        var extensiones = ExtensionesGerencia((1, GerenciaImss), (2, GerenciaImss));
        var request = new GenerarRankingRequest { CodigoEstado = "19" };

        var (candidatos, excluidos) = RankingHospitalesService.AplicarFiltrosOpcionales(
            hospitales, extensiones, request);

        candidatos.Select(h => h.CodigoContacto).Should().BeEquivalentTo(new[] { 1 });
        excluidos.Should().Be(1);
    }

    [Fact]
    public void AplicarFiltrosOpcionales_ZonaMetropolitana_Filtra()
    {
        var hospitales = new List<Hospital>
        {
            HospitalConDatos(1),
            HospitalConDatos(2),
        };
        var extensiones = Extensiones((1, GerenciaImss, true), (2, GerenciaImss, false));
        var request = new GenerarRankingRequest { ZonaMetropolitana = true };

        var (candidatos, excluidos) = RankingHospitalesService.AplicarFiltrosOpcionales(
            hospitales, extensiones, request);

        candidatos.Select(h => h.CodigoContacto).Should().BeEquivalentTo(new[] { 1 });
        excluidos.Should().Be(1);
    }

    [Fact]
    public void AplicarFiltrosOpcionales_ZonaMetropolitanaSinExtension_NoIncluyeSiRequiereTrue()
    {
        var hospitales = new List<Hospital> { HospitalConDatos(1) };
        var extensiones = new Dictionary<int, HospitalExtension>();
        var request = new GenerarRankingRequest { ZonaMetropolitana = true };

        var (candidatos, excluidos) = RankingHospitalesService.AplicarFiltrosOpcionales(
            hospitales, extensiones, request);

        candidatos.Should().BeEmpty();
        excluidos.Should().Be(1);
    }

    [Fact]
    public void AplicarFiltrosOpcionales_Combinados_ExigeTodasLasCondiciones()
    {
        var hospitales = new List<Hospital>
        {
            HospitalConDatos(1, nombre: "Hospital Norte", codigoEstado: "19"),
            HospitalConDatos(2, nombre: "Hospital Norte", codigoEstado: "20"),
            HospitalConDatos(3, nombre: "Hospital Sur", codigoEstado: "19"),
        };
        var extensiones = Extensiones(
            (1, GerenciaImss, true),
            (2, GerenciaImss, false),
            (3, GerenciaImss, true));
        var request = new GenerarRankingRequest
        {
            Search = "Norte",
            CodigoEstado = "19",
            ZonaMetropolitana = true,
        };

        var (candidatos, excluidos) = RankingHospitalesService.AplicarFiltrosOpcionales(
            hospitales, extensiones, request);

        candidatos.Select(h => h.CodigoContacto).Should().BeEquivalentTo(new[] { 1 });
        excluidos.Should().Be(2);
    }
}
