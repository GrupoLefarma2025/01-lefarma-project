using FluentAssertions;
using Lefarma.API.Features.Configuracion;

namespace Lefarma.UnitTests.Features.Configuracion;

public class ConfiguracionReglasTests
{
    [Fact]
    public void ValidarInmutables_Misma_Clave_Y_Tipo_No_Falla()
    {
        var resultado = ConfiguracionReglas.ValidarInmutables(
            "app.tema",
            "string",
            " app.tema ",
            "STRING");

        resultado.IsError.Should().BeFalse();
    }

    [Fact]
    public void ValidarInmutables_Campos_No_Enviados_No_Falla()
    {
        var resultado = ConfiguracionReglas.ValidarInmutables("app.tema", "string", null, null);

        resultado.IsError.Should().BeFalse();
    }

    [Fact]
    public void ValidarInmutables_Clave_Distinta_Falla()
    {
        var resultado = ConfiguracionReglas.ValidarInmutables("app.tema", "string", "app.otra", null);

        resultado.IsError.Should().BeTrue();
        resultado.FirstError.Code.Should().Be("Validation.clave");
    }

    [Fact]
    public void ValidarInmutables_Tipo_Distinto_Falla()
    {
        var resultado = ConfiguracionReglas.ValidarInmutables("app.puerto", "integer", null, "decimal");

        resultado.IsError.Should().BeTrue();
        resultado.FirstError.Code.Should().Be("Validation.tipoDato");
    }

    [Theory]
    [InlineData(false, false, false, false, false)]
    [InlineData(true, false, false, false, true)]
    [InlineData(false, false, false, true, true)]
    public void TieneDestino_Exige_Al_Menos_Uno(
        bool backend,
        bool frontend,
        bool sql,
        bool integraciones,
        bool esperado)
    {
        ConfiguracionReglas
            .TieneDestino(backend, frontend, sql, integraciones)
            .Should()
            .Be(esperado);
    }

    [Fact]
    public void ExtraerRestaurables_Solo_Toma_Campos_Editables()
    {
        const string snapshot = """
            {
              "idVariable": 7,
              "clave": "app.tema",
              "nombre": "Tema de la aplicación",
              "descripcion": "Tema visual",
              "tipoDato": "string",
              "valor": "oscuro",
              "esquema": {"type":"string"},
              "disponibleBackend": true,
              "disponibleFrontend": true,
              "disponibleSql": false,
              "disponibleIntegraciones": false,
              "activo": true,
              "version": 3
            }
            """;

        var resultado = ConfiguracionReglas.ExtraerRestaurables(snapshot);

        resultado.IsError.Should().BeFalse();

        var valores = resultado.Value;
        valores.Nombre.Should().Be("Tema de la aplicación");
        valores.DescripcionDefinida.Should().BeTrue();
        valores.Descripcion.Should().Be("Tema visual");
        valores.Valor!.Value.GetString().Should().Be("oscuro");
        valores.EsquemaDefinido.Should().BeTrue();
        valores.Esquema!.Value.GetProperty("type").GetString().Should().Be("string");
        valores.DisponibleBackend.Should().BeTrue();
        valores.DisponibleFrontend.Should().BeTrue();
        valores.DisponibleSql.Should().BeFalse();
        valores.DisponibleIntegraciones.Should().BeFalse();
    }

    [Fact]
    public void ExtraerRestaurables_Distinguir_Descripcion_Nula_De_Ausente()
    {
        const string conNula = """{"nombre":"x","descripcion":null,"valor":1}""";
        const string sinDescripcion = """{"nombre":"x","valor":1}""";

        var nula = ConfiguracionReglas.ExtraerRestaurables(conNula).Value;
        nula.DescripcionDefinida.Should().BeTrue();
        nula.Descripcion.Should().BeNull();

        var ausente = ConfiguracionReglas.ExtraerRestaurables(sinDescripcion).Value;
        ausente.DescripcionDefinida.Should().BeFalse();
    }

    [Fact]
    public void ExtraerRestaurables_Json_Invalido_Falla()
    {
        var resultado = ConfiguracionReglas.ExtraerRestaurables("{no-es-json");

        resultado.IsError.Should().BeTrue();
        resultado.FirstError.Code.Should().Be("Validation.idBitacoraOrigen");
    }

    [Fact]
    public void ExtraerRestaurables_Snapshot_Vacio_Falla()
    {
        ConfiguracionReglas.ExtraerRestaurables(null).IsError.Should().BeTrue();
        ConfiguracionReglas.ExtraerRestaurables("   ").IsError.Should().BeTrue();
    }

    [Fact]
    public void ExtraerRestaurables_Ignora_Clave_Tipo_Y_Activo()
    {
        const string snapshot = """
            {"clave":"otra.clave","tipoDato":"integer","activo":false,"nombre":"Nombre"}
            """;

        var valores = ConfiguracionReglas.ExtraerRestaurables(snapshot).Value;

        valores.Nombre.Should().Be("Nombre");
        valores.Valor.Should().BeNull();
        valores.DisponibleBackend.Should().BeNull();
        valores.DisponibleFrontend.Should().BeNull();
        valores.DisponibleSql.Should().BeNull();
        valores.DisponibleIntegraciones.Should().BeNull();
    }
}
