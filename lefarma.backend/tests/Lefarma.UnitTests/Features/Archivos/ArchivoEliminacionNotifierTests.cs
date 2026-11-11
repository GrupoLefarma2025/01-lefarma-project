using System;
using System.Collections.Generic;
using System.Linq;
using FluentAssertions;
using Lefarma.API.Features.Archivos.Notifications;

namespace Lefarma.UnitTests.Features.Archivos;

public class ArchivoEliminacionNotifierTests
{
    private static ArchivoEliminadoEvento Evento(
        string nombreOriginal = "comprobante.pdf",
        string carpeta = "comprobantes",
        string? metadata = "{\"tipo\":\"comprobante_pago\"}",
        DateTime? fechaEliminacion = null) => new(
            IdArchivo: 42,
            EntidadTipo: "OrdenCompra",
            EntidadId: 7,
            Carpeta: carpeta,
            NombreOriginal: nombreOriginal,
            Extension: ".pdf",
            TamanoBytes: 2048,
            Metadata: metadata,
            FechaCreacion: new DateTime(2026, 11, 10, 9, 0, 0),
            IdUsuarioSubio: 3,
            IdUsuarioElimina: 9,
            FechaEliminacion: fechaEliminacion ?? new DateTime(2026, 11, 10, 14, 35, 0));

    [Fact]
    public void DebeNotificar_Debe_Respetar_Entidad_Creador_Y_Eliminador()
    {
        // Entidad distinta de OrdenCompra: nunca se avisa.
        ArchivoEliminacionNotifier.DebeNotificar("Archivo", 5, 9).Should().BeFalse();

        // El creador elimina su propio archivo: no se avisa.
        ArchivoEliminacionNotifier.DebeNotificar("OrdenCompra", 5, 5).Should().BeFalse();

        // Otro usuario elimina el archivo del creador: se avisa.
        ArchivoEliminacionNotifier.DebeNotificar("OrdenCompra", 5, 9).Should().BeTrue();

        // Sin usuario de eliminación registrado: se avisa.
        ArchivoEliminacionNotifier.DebeNotificar("OrdenCompra", 5, null).Should().BeTrue();

        // Creador desconocido (0): se avisa aunque coincida con el eliminador.
        ArchivoEliminacionNotifier.DebeNotificar("OrdenCompra", 0, 0).Should().BeTrue();
    }

    [Fact]
    public void ConstruirAsunto_Debe_Incluir_El_Folio_O_Usar_El_Generico()
    {
        ArchivoEliminacionNotifier.ConstruirAsunto("OC-2026-00012")
            .Should().Be("Archivo eliminado — OC-2026-00012");

        ArchivoEliminacionNotifier.ConstruirAsunto(string.Empty).Should().Be("Archivo eliminado");
    }

    [Fact]
    public void ConstruirContenidoHtml_Debe_Incluir_Quien_Archivo_Fecha_Y_Tipo()
    {
        var html = ArchivoEliminacionNotifier.ConstruirContenidoHtml(
            Evento(),
            "OC-2026-00012",
            "Adriana Arredondo",
            nombreSubio: null);

        html.Should().Contain("Adriana Arredondo");
        html.Should().Contain("comprobante.pdf");
        html.Should().Contain("OC-2026-00012");
        html.Should().Contain("10/11/2026");
        html.Should().Contain("14:35");
        html.Should().Contain("Comprobante de pago");
    }

    [Fact]
    public void ConstruirContenidoHtml_Debe_Escapar_El_Nombre_Del_Archivo()
    {
        var html = ArchivoEliminacionNotifier.ConstruirContenidoHtml(
            Evento(nombreOriginal: "<script>alert(1)</script>.pdf"),
            "OC-2026-00012",
            "Adriana Arredondo",
            nombreSubio: null);

        html.Should().Contain("&lt;script&gt;alert(1)&lt;/script&gt;.pdf");
        html.Should().NotContain("<script>");
    }

    [Fact]
    public void DescribirTipoArchivo_Debe_Distinguir_Adjuntos_Y_Comprobantes()
    {
        ArchivoEliminacionNotifier.DescribirTipoArchivo("ordenes-compra", null)
            .Should().Be("Adjunto de la orden");

        ArchivoEliminacionNotifier.DescribirTipoArchivo("comprobantes", "{\"tipo\":\"comprobante_pago\"}")
            .Should().Be("Comprobante de pago");

        ArchivoEliminacionNotifier.DescribirTipoArchivo("comprobantes", "{\"tipo\":\"comprobante_gasto\"}")
            .Should().Be("Comprobante de gasto");

        ArchivoEliminacionNotifier.DescribirTipoArchivo("comprobantes", null)
            .Should().Be("Comprobante");
    }

    [Fact]
    public void ConstruirNombreVisible_Debe_Caer_Al_SamAccountName_Y_Al_Generico()
    {
        ArchivoEliminacionNotifier.ConstruirNombreVisible("Adriana Arredondo", "aarre")
            .Should().Be("Adriana Arredondo");

        ArchivoEliminacionNotifier.ConstruirNombreVisible(null, "aarre")
            .Should().Be("aarre");

        ArchivoEliminacionNotifier.ConstruirNombreVisible(null, null)
            .Should().Be("Un usuario del sistema");
    }

    [Fact]
    public void NormalizarCorreosAdicionales_Debe_Recortar_Deduplicar_Y_Limitar()
    {
        ArchivoEliminacionNotifier.NormalizarCorreosAdicionales(null).Should().BeEmpty();

        var correos = new List<string>
        {
            " uno@b.com ",
            "DOS@b.com",
            "dos@B.COM",
            "sin-arroba",
            "  ",
            "tres@b.com"
        };

        ArchivoEliminacionNotifier.NormalizarCorreosAdicionales(correos)
            .Should().Equal("uno@b.com", "DOS@b.com", "tres@b.com");

        var limitados = ArchivoEliminacionNotifier.NormalizarCorreosAdicionales(
            new[] { "a@b.com", "c@d.com", "e@f.com" },
            maximo: 2);

        limitados.Should().HaveCount(2);
        limitados.Should().Equal("a@b.com", "c@d.com");
    }

    [Fact]
    public void ResolverCorreosAdicionales_Debe_Preferir_La_Variable_Y_Caer_A_La_Configuracion()
    {
        // La variable del módulo Configuración manda sobre appsettings.
        ArchivoEliminacionNotifier.ResolverCorreosAdicionales(
                new[] { "variable@b.com" },
                new[] { "config@b.com" })
            .Should().Equal("variable@b.com");

        // Sin variable disponible se usa la lista de appsettings.
        ArchivoEliminacionNotifier.ResolverCorreosAdicionales(null, new[] { "config@b.com" })
            .Should().Equal("config@b.com");

        // Variable vacía: configuración explícita, no se cae al respaldo.
        ArchivoEliminacionNotifier.ResolverCorreosAdicionales(Array.Empty<string>(), new[] { "config@b.com" })
            .Should().BeEmpty();

        ArchivoEliminacionNotifier.ResolverCorreosAdicionales(null, null).Should().BeEmpty();
    }

    [Fact]
    public void EsCorreoValido_Debe_Rechazar_Correos_Sin_Arroba_O_Incompletos()
    {
        string? correoNulo = null;

        ArchivoEliminacionNotifier.EsCorreoValido("a@b.com").Should().BeTrue();
        ArchivoEliminacionNotifier.EsCorreoValido(correoNulo).Should().BeFalse();
        ArchivoEliminacionNotifier.EsCorreoValido(string.Empty).Should().BeFalse();
        ArchivoEliminacionNotifier.EsCorreoValido("sin-arroba").Should().BeFalse();
        ArchivoEliminacionNotifier.EsCorreoValido("a@").Should().BeFalse();
    }

    [Fact]
    public void ConstruirUrlOrden_Debe_Armar_La_Ruta_Absoluta_O_Relativa()
    {
        ArchivoEliminacionNotifier.ConstruirUrlOrden("http://host:8081/", 7)
            .Should().Be("http://host:8081/cxp/ordenes/autorizaciones?idOrden=7");

        ArchivoEliminacionNotifier.ConstruirUrlOrden(null, 7)
            .Should().Be("/cxp/ordenes/autorizaciones?idOrden=7");
    }

    [Fact]
    public void AplicarLayout_Debe_Reemplazar_Todos_Los_Marcadores()
    {
        const string layout = "<html>{{Asunto}}|{{Contenido}}|{{UrlOrden}}|{{ColorTema}}</html>";
        const string contenido = "<p>El usuario eliminó el archivo.</p>";
        const string url = "http://host:8081/cxp/ordenes/autorizaciones?idOrden=7";

        var resultado = ArchivoEliminacionNotifier.AplicarLayout(
            layout,
            "Archivo eliminado — OC OC-2026-00012",
            contenido,
            url);

        resultado.Should().NotContain("{{");
        resultado.Should().Be(
            "<html>Archivo eliminado — OC OC-2026-00012|<p>El usuario eliminó el archivo.</p>|" +
            "http://host:8081/cxp/ordenes/autorizaciones?idOrden=7|#0f2744</html>");
    }

    [Fact]
    public void AplicarLayout_Sin_Layout_Debe_Usar_El_Respaldo_Con_Contenido_Y_Url()
    {
        const string contenido = "<p>El usuario eliminó el archivo.</p>";
        const string url = "http://host:8081/cxp/ordenes/autorizaciones?idOrden=7";

        var resultado = ArchivoEliminacionNotifier.AplicarLayout(null, "Archivo eliminado", contenido, url);

        resultado.Should().Contain(contenido);
        resultado.Should().Contain(url);
        resultado.Should().NotContain("{{");
    }

    [Fact]
    public void FormatearTamano_Debe_Usar_La_Unidad_Adecuada()
    {
        ArchivoEliminacionNotifier.FormatearTamano(0).Should().Be("No registrado");
        ArchivoEliminacionNotifier.FormatearTamano(512).Should().Be("512 B");
        ArchivoEliminacionNotifier.FormatearTamano(2048).Should().Be("2 KB");
        ArchivoEliminacionNotifier.FormatearTamano(1572864).Should().Be("1.5 MB");
    }
}
