using System.Text;
using System.Text.Json;
using FluentAssertions;
using Lefarma.API.Features.Configuracion;

namespace Lefarma.UnitTests.Features.Configuracion;

public class ConfiguracionValueValidatorTests
{
    private static JsonElement Json(string json)
    {
        using var documento = JsonDocument.Parse(json);
        return documento.RootElement.Clone();
    }

    private static JsonElement JsonNulo() => Json("null");

    // ------------------------------------------------------------- tipos base

    [Theory]
    [InlineData("string", "\"texto\"")]
    [InlineData("text", "\"texto largo\"")]
    [InlineData("integer", "123")]
    [InlineData("integer", "-7")]
    [InlineData("decimal", "12.5")]
    [InlineData("boolean", "true")]
    [InlineData("boolean", "false")]
    [InlineData("date", "\"2026-02-28\"")]
    [InlineData("time", "\"18:30\"")]
    [InlineData("time", "\"18:30:15\"")]
    [InlineData("datetime", "\"2026-01-31T18:30:00-06:00\"")]
    [InlineData("datetime", "\"2026-01-31T18:30:00Z\"")]
    [InlineData("enum", "\"opcion\"")]
    [InlineData("object", "{\"a\":1}")]
    [InlineData("array", "[1,2,3]")]
    [InlineData("json", "{\"libre\":[1,2]}")]
    [InlineData("json", "null")]
    public void Validar_Tipo_Valido_No_Devuelve_Errores(string tipo, string valorJson)
    {
        var resultado = ConfiguracionValueValidator.Validar(tipo, Json(valorJson), null);

        resultado.IsError.Should().BeFalse();
    }

    [Theory]
    [InlineData("string", "123")]
    [InlineData("text", "true")]
    [InlineData("integer", "12.5")]
    [InlineData("integer", "\"12\"")]
    [InlineData("decimal", "\"12.5\"")]
    [InlineData("boolean", "\"true\"")]
    [InlineData("date", "\"2026-02-30\"")]
    [InlineData("date", "\"28/02/2026\"")]
    [InlineData("time", "\"25:00\"")]
    [InlineData("datetime", "\"ayer\"")]
    [InlineData("object", "[1,2]")]
    [InlineData("array", "{\"a\":1}")]
    public void Validar_Tipo_Invalido_Devuelve_Error(string tipo, string valorJson)
    {
        var resultado = ConfiguracionValueValidator.Validar(tipo, Json(valorJson), null);

        resultado.IsError.Should().BeTrue();
        resultado.FirstError.Type.Should().Be(ErrorOr.ErrorType.Validation);
    }

    [Fact]
    public void Validar_Tipo_Desconocido_Devuelve_Error()
    {
        var resultado = ConfiguracionValueValidator.Validar("moneda", Json("\"MXN\""), null);

        resultado.IsError.Should().BeTrue();
        resultado.FirstError.Code.Should().Be("Validation.tipoDato");
    }

    [Fact]
    public void Validar_Valor_Undefined_Devuelve_Error_De_Obligatorio()
    {
        var resultado = ConfiguracionValueValidator.Validar("string", default, null);

        resultado.IsError.Should().BeTrue();
        resultado.FirstError.Description.Should().Contain("obligatorio");
    }

    // ------------------------------------------------------------ restricciones

    [Fact]
    public void Validar_String_Respeta_MinLength_Y_MaxLength()
    {
        var esquema = Json("{\"type\":\"string\",\"minLength\":3,\"maxLength\":5}");

        ConfiguracionValueValidator.Validar("string", Json("\"ab\""), esquema).IsError.Should().BeTrue();
        ConfiguracionValueValidator.Validar("string", Json("\"abc\""), esquema).IsError.Should().BeFalse();
        ConfiguracionValueValidator.Validar("string", Json("\"abcdef\""), esquema).IsError.Should().BeTrue();
    }

    [Fact]
    public void Validar_String_Respeta_Pattern()
    {
        var esquema = Json("{\"type\":\"string\",\"pattern\":\"^[A-Z]{3}$\"}");

        ConfiguracionValueValidator.Validar("string", Json("\"ABC\""), esquema).IsError.Should().BeFalse();
        ConfiguracionValueValidator.Validar("string", Json("\"abc\""), esquema).IsError.Should().BeTrue();
    }

    [Fact]
    public void Validar_Esquema_Con_Pattern_Invalido_Devuelve_Error()
    {
        var esquema = Json("{\"type\":\"string\",\"pattern\":\"([\"}");

        var resultado = ConfiguracionValueValidator.Validar("string", Json("\"x\""), esquema);

        resultado.IsError.Should().BeTrue();
        resultado.FirstError.Description.Should().Contain("expresión regular");
    }

    [Fact]
    public void Validar_Numero_Respeta_Minimum_Y_Maximum()
    {
        var esquema = Json("{\"type\":\"number\",\"minimum\":1,\"maximum\":10}");

        ConfiguracionValueValidator.Validar("integer", Json("0"), esquema).IsError.Should().BeTrue();
        ConfiguracionValueValidator.Validar("integer", Json("5"), esquema).IsError.Should().BeFalse();
        ConfiguracionValueValidator.Validar("decimal", Json("10.5"), esquema).IsError.Should().BeTrue();
    }

    // ------------------------------------------------------------------- enum

    [Fact]
    public void Validar_Enum_Con_Enum_Declarado()
    {
        var esquema = Json("{\"type\":\"string\",\"enum\":[\"activo\",\"inactivo\"]}");

        ConfiguracionValueValidator.Validar("enum", Json("\"activo\""), esquema).IsError.Should().BeFalse();

        var invalido = ConfiguracionValueValidator.Validar("enum", Json("\"otro\""), esquema);
        invalido.IsError.Should().BeTrue();
        invalido.FirstError.Description.Should().Contain("activo");
    }

    [Fact]
    public void Validar_Enum_Con_Opciones_Value_Label()
    {
        var esquema = Json(
            "{\"type\":\"string\",\"opciones\":[{\"value\":\"mx\",\"label\":\"México\"},{\"value\":\"us\",\"label\":\"Estados Unidos\"}]}");

        ConfiguracionValueValidator.Validar("enum", Json("\"mx\""), esquema).IsError.Should().BeFalse();
        ConfiguracionValueValidator.Validar("enum", Json("\"México\""), esquema).IsError.Should().BeTrue();
    }

    // ----------------------------------------------------------------- object

    [Fact]
    public void Validar_Object_Exige_Propiedades_Requeridas()
    {
        var esquema = Json(
            "{\"type\":\"object\",\"properties\":{\"host\":{\"type\":\"string\"},\"puerto\":{\"type\":\"integer\"}},\"required\":[\"host\",\"puerto\"]}");

        ConfiguracionValueValidator.Validar("object", Json("{\"host\":\"mail.local\",\"puerto\":25}"), esquema)
            .IsError.Should().BeFalse();

        var faltante = ConfiguracionValueValidator.Validar("object", Json("{\"host\":\"mail.local\"}"), esquema);
        faltante.IsError.Should().BeTrue();
        faltante.FirstError.Description.Should().Contain("puerto");

        ConfiguracionValueValidator.Validar("object", Json("{\"host\":\"mail.local\",\"puerto\":\"25\"}"), esquema)
            .IsError.Should().BeTrue();
    }

    [Fact]
    public void Validar_Object_Con_AdditionalProperties_False_Rechaza_Extras()
    {
        var esquema = Json(
            "{\"type\":\"object\",\"properties\":{\"host\":{\"type\":\"string\"}},\"additionalProperties\":false}");

        ConfiguracionValueValidator.Validar("object", Json("{\"host\":\"a\"}"), esquema).IsError.Should().BeFalse();

        var extra = ConfiguracionValueValidator.Validar("object", Json("{\"host\":\"a\",\"otro\":1}"), esquema);
        extra.IsError.Should().BeTrue();
        extra.FirstError.Description.Should().Contain("no es una propiedad permitida");
    }

    [Fact]
    public void Validar_Object_Anidado_Devuelve_Ruta_Exacta()
    {
        var esquema = Json(
            "{\"type\":\"object\",\"properties\":{\"smtp\":{\"type\":\"object\",\"properties\":{\"puerto\":{\"type\":\"integer\"}}}}}");

        var resultado = ConfiguracionValueValidator.Validar(
            "object",
            Json("{\"smtp\":{\"puerto\":\"abc\"}}"),
            esquema);

        resultado.IsError.Should().BeTrue();
        resultado.FirstError.Description.Should().Contain("smtp.puerto");
    }

    // ------------------------------------------------------------------ array

    [Fact]
    public void Validar_Array_Valida_Cada_Elemento()
    {
        var esquema = Json("{\"type\":\"array\",\"items\":{\"type\":\"integer\"}}");

        ConfiguracionValueValidator.Validar("array", Json("[1,2,3]"), esquema).IsError.Should().BeFalse();

        var resultado = ConfiguracionValueValidator.Validar("array", Json("[1,\"dos\"]"), esquema);
        resultado.IsError.Should().BeTrue();
        resultado.FirstError.Description.Should().Contain("valor[1]");
    }

    // ---------------------------------------------------------------- esquema

    [Fact]
    public void Validar_Esquema_Invalido_Se_Rechaza()
    {
        ConfiguracionValueValidator.ValidarEsquema(Json("[1,2]")).IsError.Should().BeTrue();
        ConfiguracionValueValidator.ValidarEsquema(Json("{\"type\":123}")).IsError.Should().BeTrue();
        ConfiguracionValueValidator.ValidarEsquema(Json("{\"required\":\"host\"}")).IsError.Should().BeTrue();
        ConfiguracionValueValidator.ValidarEsquema(Json("{\"minLength\":5,\"maxLength\":2}")).IsError.Should().BeTrue();
        ConfiguracionValueValidator.ValidarEsquema(Json("{\"type\":\"object\",\"properties\":{\"a\":{\"type\":\"string\"}}}"))
            .IsError.Should().BeFalse();
    }

    [Fact]
    public void Validar_Esquema_Con_Profundidad_Excesiva_Falla()
    {
        var esquema = "{\"type\":\"array\"}";
        for (var i = 0; i < ConfiguracionValueValidator.ProfundidadMaxima + 2; i++)
        {
            esquema = "{\"type\":\"array\",\"items\":" + esquema + "}";
        }

        var profundidad = ConfiguracionValueValidator.ProfundidadMaxima + 2;

        var jsonValor = new StringBuilder();
        jsonValor.Append('[', profundidad);
        jsonValor.Append(']', profundidad);

        var resultado = ConfiguracionValueValidator.Validar("array", Json(jsonValor.ToString()), Json(esquema));

        resultado.IsError.Should().BeTrue();
        resultado.FirstError.Description.Should().Contain("profundidad");
    }

    [Fact]
    public void Validar_Esquema_Null_No_Restringe()
    {
        ConfiguracionValueValidator.Validar("integer", Json("999"), JsonNulo()).IsError.Should().BeFalse();
    }
}
