using FluentAssertions;
using Lefarma.API.Features.Configuracion;

namespace Lefarma.UnitTests.Features.Configuracion;

public class IntegracionLlavesTests
{
    [Fact]
    public void Generar_Produce_Llaves_Distintas_Con_Prefijo()
    {
        var primera = IntegracionLlaves.Generar();
        var segunda = IntegracionLlaves.Generar();

        primera.Should().StartWith("cfg_");
        segunda.Should().StartWith("cfg_");
        primera.Should().NotBe(segunda);
        primera.Length.Should().BeGreaterThan(40);
        primera.Should().NotContain("=");
        primera.Should().NotContain("+");
        primera.Should().NotContain("/");
    }

    [Fact]
    public void CalcularHash_Es_Estable_Y_Hexadecimal_De_64()
    {
        const string llave = "cfg_ejemplo-de-llave";

        var hash = IntegracionLlaves.CalcularHash(llave);

        hash.Should().Be(IntegracionLlaves.CalcularHash(llave));
        hash.Should().HaveLength(64);
        hash.Should().MatchRegex("^[0-9a-f]{64}$");
    }

    [Fact]
    public void ObtenerPrefijoVisible_No_Expone_La_Llave_Completa()
    {
        var llave = IntegracionLlaves.Generar();

        var prefijo = IntegracionLlaves.ObtenerPrefijoVisible(llave);

        prefijo.Should().HaveLength(IntegracionLlaves.LongitudPrefijoVisible);
        llave.Should().StartWith(prefijo);
        prefijo.Should().NotBe(llave);
    }

    [Fact]
    public void HashesIguales_Compara_Contenido()
    {
        var hash = IntegracionLlaves.CalcularHash("cfg_x");

        IntegracionLlaves.HashesIguales(hash, hash).Should().BeTrue();
        IntegracionLlaves.HashesIguales(hash, hash[..^1] + "0").Should().BeFalse();
        IntegracionLlaves.HashesIguales(hash, "corto").Should().BeFalse();
    }

    [Fact]
    public void NormalizarClaves_Vacio_Devuelve_Null()
    {
        IntegracionLlaves.NormalizarClaves(null).Value.Should().BeNull();
        IntegracionLlaves.NormalizarClaves(Array.Empty<string>()).Value.Should().BeNull();
        IntegracionLlaves.NormalizarClaves(new[] { "  " }).IsError.Should().BeTrue();
    }

    [Fact]
    public void NormalizarClaves_Elimina_Duplicados_Y_Guarda_Prefijos()
    {
        var resultado = IntegracionLlaves.NormalizarClaves(new[]
        {
            "app.tema", " APP.TEMA ", "notificaciones.*"
        });

        resultado.IsError.Should().BeFalse();
        resultado.Value.Should().BeEquivalentTo(new[] { "app.tema", "notificaciones.*" });
    }

    [Fact]
    public void NormalizarClaves_Prefijo_Solo_Asterisco_Falla()
    {
        IntegracionLlaves.NormalizarClaves(new[] { "*" }).IsError.Should().BeTrue();
    }

    [Theory]
    [InlineData(null, "cualquiera", true)]
    [InlineData(new[] { "app.tema" }, "app.tema", true)]
    [InlineData(new[] { "app.tema" }, "app.TEMA", true)]
    [InlineData(new[] { "app.tema" }, "app.otra", false)]
    [InlineData(new[] { "notificaciones.*" }, "notificaciones.correo", true)]
    [InlineData(new[] { "notificaciones.*" }, "app.tema", false)]
    [InlineData(new[] { "notificaciones.*", "app.tema" }, "app.tema", true)]
    public void ClavePermitida_Coincidencia_Exacta_O_Prefijo(string[]? patrones, string clave, bool esperado)
    {
        IntegracionLlaves.ClavePermitida(patrones, clave).Should().Be(esperado);
    }

    [Fact]
    public void SerializarYDeserializarClaves_Conserva_Valores()
    {
        var original = new List<string> { "app.tema", "notificaciones.*" };

        var json = IntegracionLlaves.SerializarClaves(original);
        var recuperadas = IntegracionLlaves.DeserializarClaves(json);

        recuperadas.Should().BeEquivalentTo(original);
        IntegracionLlaves.SerializarClaves(null).Should().BeNull();
        IntegracionLlaves.DeserializarClaves("{invalido").Should().BeNull();
    }
}
