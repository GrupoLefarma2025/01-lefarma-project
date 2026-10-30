using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.Viaticos;
using Lefarma.API.Features.Viaticos;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// Tests HTTP del <see cref="AprobacionesController"/> (bandeja, autorizar,
/// rechazar, ajustar) levantando una mini aplicacion ASP.NET Core en memoria
/// con <see cref="TestServer"/>, <c>ApplicationDbContext</c> sobre EF InMemory
/// y el <c>TestAuthHandler</c> compartido de
/// <see cref="PermisosEndpointTests"/> (<c>X-Test-UserId</c> /
/// <c>X-Test-Permissions</c>).
///
/// Endpoints cubiertos:
///   - GET  /api/viaticos/solicitudes            (bandeja)
///   - POST /api/viaticos/solicitudes/{id}/autorizar
///   - POST /api/viaticos/solicitudes/{id}/rechazar
///   - POST /api/viaticos/solicitudes/{id}/ajustes
///
/// Cada test crea su propia base InMemory (nombre con GUID) y siembra datos
/// propios: no hay dependencia del orden de ejecucion ni de estado compartido.
/// </summary>
public class AprobacionesControllerTests
{
    // ---------------- GET /api/viaticos/solicitudes ----------------

    [Fact]
    public async Task Bandeja_SinPermisoAutorizar_Retorna403()
    {
        using var ctx = new TestContext();
        const int yoId = 1000;
        ctx.SembrarSolicitud(yoId, "enviada");
        ctx.SembrarSolicitud(yoId, "autorizada");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", yoId.ToString());
        // Solicitar (y ver_todos) no bastan: la bandeja es la pantalla de
        // autorizacion y exige viaticos.autorizar.
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions",
            string.Join(",", Permissions.Viaticos.Solicitar, Permissions.Viaticos.VerTodos));

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes");

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain(Permissions.Viaticos.Autorizar);
    }

    [Fact]
    public async Task Bandeja_ConAutorizar_DevuelveTodas()
    {
        using var ctx = new TestContext();
        const int adminId = 5000;
        var propia = ctx.SembrarSolicitud(adminId, "enviada");
        var ajenaA = ctx.SembrarSolicitud(6001, "enviada");
        var ajenaB = ctx.SembrarSolicitud(6002, "autorizada");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<List<BandejaItemJson>>>();
        envelope!.Success.Should().BeTrue();
        envelope.Data.Should().HaveCount(3);
        envelope.Data!.Select(x => x.IdSolicitud).Should().BeEquivalentTo(
            new[] { propia, ajenaA, ajenaB });
    }

    // ---------------- GET /api/viaticos/solicitudes: destino y directorio ----------------

    [Fact]
    public async Task Bandeja_SinGerenciaPropia_UsaLaUltimaDelViajero()
    {
        using var ctx = new TestContext();
        const int adminId = 5200;
        const int solicitanteId = 8201;
        const int viajeroId = 8202;

        // El viajero ya tenia una solicitud clasificada; la nueva nace "Sin asignar".
        ctx.SembrarSolicitud(viajeroId, "autorizada", """{"total":100}""", gerencia: "IMSS Bienestar");
        var sinGerencia = ctx.SembrarSolicitud(
            solicitanteId,
            "enviada",
            $$"""{"persona":{"modo":"otra","empleadoId":{{viajeroId}},"nombre":"Viajero"},"total":200}""",
            gerencia: SolicitudesController.GerenciaPorDefecto);
        // Una solicitud que SI trae gerencia conserva la suya.
        var conGerencia = ctx.SembrarSolicitud(
            solicitanteId, "enviada", """{"total":300}""", gerencia: "Descentralizado");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<List<BandejaItemJson>>>();
        envelope!.Data!.Single(x => x.IdSolicitud == sinGerencia).Gerencia.Should().Be("IMSS Bienestar");
        envelope.Data!.Single(x => x.IdSolicitud == conGerencia).Gerencia.Should().Be("Descentralizado");
    }

    [Fact]
    public async Task Bandeja_LeeDestinoDeDatosJsonYNombreDelDirectorio()
    {
        using var ctx = new TestContext();
        const int adminId = 5100;
        const int solicitanteA = 8101;
        const int solicitanteB = 8102;

        ctx.SembrarUsuario(solicitanteA, "Ana Perez", esActivo: true);
        ctx.SembrarUsuario(solicitanteB, "Bruno Diaz", esActivo: true);
        var conDestinoA = ctx.SembrarSolicitud(
            solicitanteA, "enviada", """{"origen":"Lima","destino":"Cusco","total":1500}""");
        var conDestinoB = ctx.SembrarSolicitud(
            solicitanteB, "autorizada", """{"origen":"Arequipa","destino":"Puno","total":2500}""");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<List<BandejaItemJson>>>();
        envelope!.Success.Should().BeTrue();
        envelope.Data.Should().HaveCount(2);

        var filaA = envelope.Data!.Single(x => x.IdSolicitud == conDestinoA);
        filaA.Destino.Should().Be("Cusco");
        filaA.NombreSolicitante.Should().Be("Ana Perez");

        var filaB = envelope.Data!.Single(x => x.IdSolicitud == conDestinoB);
        filaB.Destino.Should().Be("Puno");
        filaB.NombreSolicitante.Should().Be("Bruno Diaz");
    }

    [Fact]
    public async Task Bandeja_DatosJsonVacioOMalformado_DevuelveDestinoNullSinLanzar()
    {
        using var ctx = new TestContext();
        const int adminId = 5200;
        var vacio = ctx.SembrarSolicitud(8201, "enviada", "");
        var malformado = ctx.SembrarSolicitud(8202, "enviada", "{no-es-json");
        var sinDestino = ctx.SembrarSolicitud(8203, "enviada", """{"total":700}""");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<List<BandejaItemJson>>>();
        envelope!.Success.Should().BeTrue();
        envelope.Data.Should().HaveCount(3);
        envelope.Data!.Where(x => x.IdSolicitud == vacio).Should().OnlyContain(x => x.Destino == null);
        envelope.Data!.Where(x => x.IdSolicitud == malformado).Should().OnlyContain(x => x.Destino == null);
        envelope.Data!.Where(x => x.IdSolicitud == sinDestino).Should().OnlyContain(x => x.Destino == null);
    }

    [Fact]
    public async Task Bandeja_SolicitanteFueraDelDirectorio_CaeAUsuarioPorId()
    {
        using var ctx = new TestContext();
        const int adminId = 5300;
        const int inactivoId = 8301;
        const int desconocidoId = 8302;
        ctx.SembrarUsuario(inactivoId, "Carla Inactiva", esActivo: false);
        var deInactivo = ctx.SembrarSolicitud(inactivoId, "enviada");
        var deDesconocido = ctx.SembrarSolicitud(desconocidoId, "enviada");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<List<BandejaItemJson>>>();
        envelope!.Success.Should().BeTrue();
        // Usuario dado de baja no expone su nombre en la bandeja del admin.
        envelope.Data!.Single(x => x.IdSolicitud == deInactivo).NombreSolicitante
            .Should().Be($"Usuario #{inactivoId}");
        envelope.Data!.Single(x => x.IdSolicitud == deDesconocido).NombreSolicitante
            .Should().Be($"Usuario #{desconocidoId}");
    }

    // ---------------- GET /api/viaticos/solicitudes: desglose FOR-008 ----------------

    [Fact]
    public async Task Bandeja_LeeDesglosePorConceptoDeDatosJson()
    {
        using var ctx = new TestContext();
        const int adminId = 5400;
        var conDesglose = ctx.SembrarSolicitud(
            8401, "autorizada",
            """
            {"origen":"CDMX","destino":"CANCUN","autobus":478,"avion":14963,
             "gasolina":1200.50,"casetas":340,"vehiculo_propio":900,
             "hospedaje":5568,"comida":2000,"taxi":3700,"total":26709}
            """);

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<List<BandejaItemJson>>>();
        envelope!.Success.Should().BeTrue();
        var fila = envelope.Data!.Single(x => x.IdSolicitud == conDesglose);

        // Nombres exactos de las columnas del concentrado ASK-ADM-FOR-008.
        fila.Autobus.Should().Be(478m);
        fila.Avion.Should().Be(14963m);
        fila.Gasolina.Should().Be(1200.50m);
        fila.Casetas.Should().Be(340m);
        fila.VehiculoPropio.Should().Be(900m);
        fila.Hospedaje.Should().Be(5568m);
        fila.Comida.Should().Be(2000m);
        fila.Taxi.Should().Be(3700m);
        fila.Total.Should().Be(26709m);
    }

    [Fact]
    public async Task Bandeja_SinDesgloseOMalformado_DevuelveNullsSinLanzarNiInventarCero()
    {
        using var ctx = new TestContext();
        const int adminId = 5500;
        var vacio = ctx.SembrarSolicitud(8501, "enviada", "");
        var malformado = ctx.SembrarSolicitud(8502, "enviada", "{no-es-json");
        var noObjeto = ctx.SembrarSolicitud(8503, "enviada", "[1,2,3]");
        var sinClaves = ctx.SembrarSolicitud(8504, "enviada", """{"origen":"CDMX","total":700}""");
        var tiposInvalidos = ctx.SembrarSolicitud(
            8505, "enviada",
            """{"autobus":"600","gasolina":null,"casetas":true,"avion":0}""");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes");

        // Ningun snapshot roto tumba la bandeja ni convierte la celda en $0.00.
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<List<BandejaItemJson>>>();
        envelope!.Success.Should().BeTrue();

        foreach (var id in new[] { vacio, malformado, noObjeto, sinClaves })
        {
            var fila = envelope.Data!.Single(x => x.IdSolicitud == id);
            fila.Autobus.Should().BeNull();
            fila.Avion.Should().BeNull();
            fila.Gasolina.Should().BeNull();
            fila.Casetas.Should().BeNull();
            fila.VehiculoPropio.Should().BeNull();
            fila.Hospedaje.Should().BeNull();
            fila.Comida.Should().BeNull();
            fila.Taxi.Should().BeNull();
        }

        // Un tipo que no es numero tampoco se coacciona: null, no 0. Un 0
        // explicito SI es un dato y se conserva.
        var filaInvalida = envelope.Data!.Single(x => x.IdSolicitud == tiposInvalidos);
        filaInvalida.Autobus.Should().BeNull();
        filaInvalida.Gasolina.Should().BeNull();
        filaInvalida.Casetas.Should().BeNull();
        filaInvalida.Avion.Should().Be(0m);
    }

    [Fact]
    public async Task Bandeja_SinTotalConocido_DevuelveTotalNullNoCero()
    {
        using var ctx = new TestContext();
        const int adminId = 5800;
        var vacio = ctx.SembrarSolicitud(8801, "enviada", "");
        var malformado = ctx.SembrarSolicitud(8802, "enviada", "{no-es-json");
        var sinTotal = ctx.SembrarSolicitud(8803, "enviada", """{"destino":"PUEBLA"}""");
        var totalNoNumerico = ctx.SembrarSolicitud(8804, "enviada", """{"total":"700"}""");
        var conTotal = ctx.SembrarSolicitud(8805, "enviada", """{"total":700}""");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<List<BandejaItemJson>>>();
        envelope!.Success.Should().BeTrue();

        // Sin dato conocido: null ("no se sabe"), nunca 0 ("costo nada").
        foreach (var id in new[] { vacio, malformado, sinTotal, totalNoNumerico })
            envelope.Data!.Single(x => x.IdSolicitud == id).Total.Should().BeNull();
        // Un total explicito SI es un dato y se conserva.
        envelope.Data!.Single(x => x.IdSolicitud == conTotal).Total.Should().Be(700m);
    }

    // ---------------- GET /api/viaticos/solicitudes: origen y fecha FOR-008 ----------------

    [Fact]
    public async Task Bandeja_LeeOrigenYFechaDeDatosJson()
    {
        using var ctx = new TestContext();
        const int adminId = 5600;
        var conRango = ctx.SembrarSolicitud(
            8601, "autorizada",
            """{"origen":"CDMX","destino":"CANCUN","fecha_salida":"2026-10-05","fecha_regreso":"2026-10-09","total":1000}""");
        var unSoloDia = ctx.SembrarSolicitud(
            8602, "autorizada",
            """{"origen":"CDMX","destino":"TOLUCA","fecha_salida":"2026-10-05","total":900}""");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<List<BandejaItemJson>>>();
        envelope!.Success.Should().BeTrue();

        // Rango salida/regreso en el formato del concentrado ASK-ADM-FOR-008.
        var filaRango = envelope.Data!.Single(x => x.IdSolicitud == conRango);
        filaRango.Origen.Should().Be("CDMX");
        filaRango.Fecha.Should().Be("05/10/2026 AL 09/10/2026");

        // Sin regreso solo se expone la salida, formateada igual.
        var filaDia = envelope.Data!.Single(x => x.IdSolicitud == unSoloDia);
        filaDia.Origen.Should().Be("CDMX");
        filaDia.Fecha.Should().Be("05/10/2026");
    }

    [Fact]
    public async Task Bandeja_LeeElRangoDelViajeDelSnapshotV2YDeLosDestinos()
    {
        using var ctx = new TestContext();
        const int adminId = 5650;
        // solicitud-v2: el rango explicito manda sobre los dias de cada destino.
        var wizard = ctx.SembrarSolicitud(
            8650, "enviada",
            """{"version":"solicitud-v2","rango":{"inicio":"2026-10-18","fin":"2026-10-22"},"destinos":[{"debeEstarFecha":"2026-10-19"}]}""");
        // Sin rango: el viaje va del dia menor al mayor de los destinos.
        var soloDestinos = ctx.SembrarSolicitud(
            8651, "enviada",
            """{"version":"solicitud-v2","destinos":[{"debeEstarFecha":"2026-10-21"},{"debeEstarFecha":"2026-10-22"}]}""");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<List<BandejaItemJson>>>();
        envelope!.Success.Should().BeTrue();

        var filaRango = envelope.Data!.Single(x => x.IdSolicitud == wizard);
        filaRango.FechaSalida.Should().Be("2026-10-18");
        filaRango.FechaRegreso.Should().Be("2026-10-22");
        filaRango.Fecha.Should().Be("18/10/2026 AL 22/10/2026");

        var filaDestinos = envelope.Data!.Single(x => x.IdSolicitud == soloDestinos);
        filaDestinos.FechaSalida.Should().Be("2026-10-21");
        filaDestinos.FechaRegreso.Should().Be("2026-10-22");
    }

    [Fact]
    public async Task Bandeja_ExponeFolioYLosDestinosDelSnapshotV2()
    {
        using var ctx = new TestContext();
        const int adminId = 5670;
        // solicitud-v2: origen y destinos son objetos con `punto`; se publican
        // como ciudad, no como direccion completa.
        var multiPunto = ctx.SembrarSolicitud(
            8670, "enviada",
            """
            {"version":"solicitud-v2",
             "origen":{"punto":{"nombre":"Calle 1, Pátzcuaro, Michoacán","municipio":"Pátzcuaro"}},
             "destinos":[
               {"punto":{"nombre":"Avenida 2, Chihuahua","municipio":"Chihuahua"}},
               {"punto":{"nombre":"Calle 3, Juárez","municipio":"Juárez"}},
               {"punto":{"nombre":"Avenida 2, Chihuahua","municipio":"Chihuahua"}}
             ]}
            """,
            folio: "VIA-BLEDESMA-42");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<List<BandejaItemJson>>>();
        var fila = envelope!.Data!.Single(x => x.IdSolicitud == multiPunto);

        fila.Folio.Should().Be("VIA-BLEDESMA-42");
        fila.Origen.Should().Be("Pátzcuaro");
        // Los puntos se unen con " - " y el repetido no se pinta dos veces.
        fila.Destino.Should().Be("Chihuahua - Juárez");
    }

    [Fact]
    public async Task Bandeja_SinOrigenNiFechaOMalformado_DevuelveNullSinLanzar()
    {
        using var ctx = new TestContext();
        const int adminId = 5700;
        var sinClaves = ctx.SembrarSolicitud(8701, "enviada", """{"destino":"PUEBLA","total":700}""");
        var vacio = ctx.SembrarSolicitud(8702, "enviada", "");
        var malformado = ctx.SembrarSolicitud(8703, "enviada", "{no-es-json");
        var arreglo = ctx.SembrarSolicitud(8704, "enviada", "[1,2,3]");
        var numero = ctx.SembrarSolicitud(8705, "enviada", "123");
        var tiposInvalidos = ctx.SembrarSolicitud(
            8706, "enviada",
            """{"origen":7,"fecha_salida":null,"fecha_regreso":true}""");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes");

        // Ausencia, JSON invalido o clave de tipo equivocado: null, sin lanzar.
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<List<BandejaItemJson>>>();
        envelope!.Success.Should().BeTrue();

        foreach (var id in new[] { sinClaves, vacio, malformado, arreglo, numero, tiposInvalidos })
        {
            var fila = envelope.Data!.Single(x => x.IdSolicitud == id);
            fila.Origen.Should().BeNull();
            fila.Fecha.Should().BeNull();
        }
    }

    // ---------------- POST /{id}/autorizar ----------------

    [Fact]
    public async Task Autorizar_SinPermisoAutorizar_Retorna403()
    {
        using var ctx = new TestContext();
        var id = ctx.SembrarSolicitud(7001, "enviada");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "7001");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.VerTodos);

        var resp = await cliente.PostAsync($"/api/viaticos/solicitudes/{id}/autorizar", null);

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain(Permissions.Viaticos.Autorizar);
    }

    [Fact]
    public async Task Autorizar_SolicitudYaAutorizada_Retorna409()
    {
        using var ctx = new TestContext();
        var id = ctx.SembrarSolicitud(7002, "autorizada");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "7002");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.PostAsync($"/api/viaticos/solicitudes/{id}/autorizar", null);

        resp.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("autorizada");
    }

    [Fact]
    public async Task Autorizar_SinBody_CopiaLaRutaVigenteComoAutorizada()
    {
        using var ctx = new TestContext();
        var id = ctx.SembrarSolicitud(
            7008,
            "enviada",
            """{"calculo":{"tramos":[{"de":"Origen","a":"Destino"}]},"total":1000}""");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "7008");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.PostAsync($"/api/viaticos/solicitudes/{id}/autorizar", null);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var datos = ctx.LeeDatosJson(id);
        // La ruta calculada se conserva y ademas queda como autorizada.
        datos.Should().Contain("calculo").And.Contain("calculo_autorizado");
        datos.Should().Contain("Origen").And.Contain("Destino");
    }

    [Fact]
    public async Task Autorizar_ConRutaNueva_GuardaLaAutorizadaYReemplazaOpciones()
    {
        using var ctx = new TestContext();
        var id = ctx.SembrarSolicitud(
            7009,
            "enviada",
            """{"calculo":{"tramos":[{"de":"Vieja","a":"Ruta"}]},"total":1000}""");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "7009");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.PostAsJsonAsync($"/api/viaticos/solicitudes/{id}/autorizar", new
        {
            calculo = new { tramos = new[] { new { de = "Nueva", a = "Ruta" } }, generado_en = "2026-10-22T10:00:00" },
            opciones = new[]
            {
                new
                {
                    tipo = "autobus",
                    linea = "Nueva ruta ETN",
                    precio = 1234.50m,
                    moneda = "MXN",
                    url_compra = "https://proveedor.test/boleto",
                    fuente = "proveedor",
                    fue_elegida = true,
                    ruta_captura = (string?)null,
                },
            },
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var datos = ctx.LeeDatosJson(id);
        datos.Should().Contain("calculo_autorizado").And.Contain("Nueva").And.Contain("Ruta");
        datos.Should().Contain("Vieja"); // la ruta calculada original no se pierde.

        var opciones = ctx.LeeOpciones(id);
        opciones.Should().ContainSingle();
        opciones[0].Linea.Should().Be("Nueva ruta ETN");
        opciones[0].FueElegida.Should().BeTrue();

        ctx.LeeEstado(id).Should().Be("autorizada");
        ctx.LeeEventos(id).Should().Contain(e =>
            e.Tipo == "autorizada" && e.PayloadJson!.Contains("\"ruta\":\"nueva\""));
    }

    // ---------------- POST /{id}/autorizar: resumen de la version autorizada ----------------

    [Fact]
    public async Task Autorizar_ConRutaNueva_GuardaResumenAutorizadoYBandejaLoDevuelve()
    {
        using var ctx = new TestContext();
        const int adminId = 7100;
        // Snapshot previo: la ruta vieja es de transporte solicitado (sus
        // casetas NO aplican) y el total raiz es un valor historico.
        var id = ctx.SembrarSolicitud(
            adminId,
            "enviada",
            """
            {"calculo":{"generado_en":"2026-10-20T09:00:00","modo_transporte":"solicitado",
              "tramos":[{"de":"Vieja","a":"Ruta","casetas":[{"nombre":"Vieja","costo":111}]}]},
             "comida":350,"autobus":999,"total":55555}
            """);

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.PostAsJsonAsync($"/api/viaticos/solicitudes/{id}/autorizar", new
        {
            calculo = new
            {
                generado_en = "2026-10-22T10:00:00",
                modo_transporte = "propio",
                tramos = new[]
                {
                    new
                    {
                        de = "CDMX",
                        a = "Puebla",
                        casetas = new[]
                        {
                            new { nombre = "Caseta A", costo = 120.50m },
                            new { nombre = "Caseta B", costo = 79.50m },
                        },
                    },
                    new
                    {
                        de = "Puebla",
                        a = "Veracruz",
                        casetas = new[] { new { nombre = "Caseta C", costo = 100m } },
                    },
                },
            },
            opciones = new object[]
            {
                new { tipo = "vuelo", linea = "Vuelo elegido", precio = 5000m, moneda = "MXN", fuente = "proveedor", fue_elegida = true },
                new { tipo = "hotel", linea = "Hotel elegido", precio = 2000m, moneda = "MXN", fuente = "proveedor", fue_elegida = true },
                new { tipo = "taxi", linea = "Taxi elegido", precio = 300m, moneda = "MXN", fuente = "proveedor", fue_elegida = true },
                new { tipo = "auto", linea = "Renta elegida", precio = 800m, moneda = "MXN", fuente = "proveedor", fue_elegida = true },
                // No elegida: no debe sumar en ninguna columna.
                new { tipo = "autobus", linea = "Bus descartado", precio = 700m, moneda = "MXN", fuente = "proveedor", fue_elegida = false },
            },
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var resumen = ctx.LeeResumenAutorizado(id);
        resumen.ValueKind.Should().Be(JsonValueKind.Object);
        resumen.GetProperty("autobus").ValueKind.Should().Be(JsonValueKind.Null);
        resumen.GetProperty("avion").GetDecimal().Should().Be(5000m);
        resumen.GetProperty("gasolina").GetDecimal().Should().Be(800m);
        // Casetas solo aplican en automovil propio: 120.50 + 79.50 + 100.
        resumen.GetProperty("casetas").GetDecimal().Should().Be(300m);
        resumen.GetProperty("hospedaje").GetDecimal().Should().Be(2000m);
        // comida no viene de opciones ni del calculo: se conserva la previa.
        resumen.GetProperty("comida").GetDecimal().Should().Be(350m);
        resumen.GetProperty("taxi").GetDecimal().Should().Be(300m);
        resumen.GetProperty("total").GetDecimal().Should().Be(8750m);

        // La bandeja FOR-008 proyecta el resumen, no el total raiz historico.
        var bandejaResp = await cliente.GetAsync("/api/viaticos/solicitudes");
        bandejaResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await bandejaResp.Content.ReadFromJsonAsync<ApiEnvelope<List<BandejaItemJson>>>();
        var fila = envelope!.Data!.Single(x => x.IdSolicitud == id);
        // El resumen autorizado manda incluso en null: el 999 historico no se
        // cuela en una version donde no se eligio autobus.
        fila.Autobus.Should().BeNull();
        fila.Avion.Should().Be(5000m);
        fila.Gasolina.Should().Be(800m);
        fila.Casetas.Should().Be(300m);
        fila.Hospedaje.Should().Be(2000m);
        fila.Comida.Should().Be(350m);
        fila.Taxi.Should().Be(300m);
        fila.Total.Should().Be(8750m);
    }

    [Fact]
    public async Task Autorizar_TransporteSolicitado_DejaCasetasNullYNoInventaCero()
    {
        using var ctx = new TestContext();
        const int adminId = 7150;
        var id = ctx.SembrarSolicitud(adminId, "enviada", """{"total":1000}""");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.PostAsJsonAsync($"/api/viaticos/solicitudes/{id}/autorizar", new
        {
            calculo = new
            {
                generado_en = "2026-10-22T10:00:00",
                modo_transporte = "solicitado",
                tramos = new[] { new { de = "CDMX", a = "Puebla", casetas = new[] { new { nombre = "Caseta A", costo = 120m } } } },
            },
            opciones = new object[]
            {
                new { tipo = "vuelo", linea = "Vuelo", precio = 2500m, moneda = "MXN", fuente = "proveedor", fue_elegida = true },
            },
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var resumen = ctx.LeeResumenAutorizado(id);
        // En transporte solicitado las casetas ya van dentro del boleto.
        resumen.GetProperty("casetas").ValueKind.Should().Be(JsonValueKind.Null);
        resumen.GetProperty("total").GetDecimal().Should().Be(2500m);
    }

    [Fact]
    public async Task Autorizar_ConservaOpcionesOriginalesYNoPierdeLaRutaCalculada()
    {
        using var ctx = new TestContext();
        const int adminId = 7200;
        var id = ctx.SembrarSolicitud(
            adminId,
            "enviada",
            """{"calculo":{"modo_transporte":"solicitado","tramos":[{"de":"Ruta","a":"Original"}]},"total":1000}""");
        ctx.SembrarOpcion(
            id,
            "vuelo",
            "Vuelo original",
            4500m,
            fueElegida: true,
            datosJson: """{"tramo":1,"de":"CDMX","a":"Puebla"}""");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.PostAsJsonAsync($"/api/viaticos/solicitudes/{id}/autorizar", new
        {
            calculo = new
            {
                modo_transporte = "solicitado",
                tramos = new[] { new { de = "Ruta", a = "Nueva" } },
            },
            opciones = new object[]
            {
                // Sin url_compra: la ruta recalculada puede no traer enlace.
                new { tipo = "vuelo", linea = "Vuelo nuevo", precio = 4800m, moneda = "MXN", fuente = "proveedor", fue_elegida = true },
            },
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        using var doc = JsonDocument.Parse(ctx.LeeDatosJson(id));
        var raiz = doc.RootElement;

        // La referencia original queda congelada con todos sus campos.
        var originales = raiz.GetProperty("opciones_originales");
        originales.ValueKind.Should().Be(JsonValueKind.Array);
        originales.GetArrayLength().Should().Be(1);
        var original = originales[0];
        original.GetProperty("tipo").GetString().Should().Be("vuelo");
        original.GetProperty("linea").GetString().Should().Be("Vuelo original");
        original.GetProperty("precio").GetDecimal().Should().Be(4500m);
        original.GetProperty("fuente").GetString().Should().Be("proveedor");
        original.GetProperty("fue_elegida").GetBoolean().Should().BeTrue();
        original.GetProperty("datos").GetProperty("tramo").GetInt32().Should().Be(1);

        // La ruta calculada original no se pierde; la nueva queda autorizada.
        raiz.GetProperty("calculo").GetProperty("tramos")[0].GetProperty("a").GetString().Should().Be("Original");
        raiz.GetProperty("calculo_autorizado").GetProperty("tramos")[0].GetProperty("a").GetString().Should().Be("Nueva");

        // Las opciones vigentes son las de esta autorizacion.
        var opciones = ctx.LeeOpciones(id);
        opciones.Should().ContainSingle();
        opciones[0].Linea.Should().Be("Vuelo nuevo");
        opciones[0].UrlCompra.Should().BeNull();
    }

    [Fact]
    public async Task Autorizar_ConOpcionesOriginalesPrevias_NoLasPisa()
    {
        using var ctx = new TestContext();
        const int adminId = 7300;
        // Un recálculo anterior ya dejo su referencia: es la original y no se
        // debe reemplazar por una version intermedia.
        var id = ctx.SembrarSolicitud(
            adminId,
            "enviada",
            """
            {"calculo":{"modo_transporte":"solicitado","tramos":[{"de":"Origen","a":"Vigente"}]},
             "opciones_originales":[{"id_opcion":1,"tipo":"vuelo","linea":"Primera referencia","precio":4000}]}
            """);
        ctx.SembrarOpcion(id, "vuelo", "Vuelo vigente", 4200m, fueElegida: true);

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.PostAsJsonAsync($"/api/viaticos/solicitudes/{id}/autorizar", new
        {
            calculo = new
            {
                modo_transporte = "solicitado",
                tramos = new[] { new { de = "Origen", a = "Recalculada" } },
            },
            opciones = new object[]
            {
                new { tipo = "vuelo", linea = "Vuelo recalculado", precio = 4300m, moneda = "MXN", fuente = "proveedor", fue_elegida = true },
            },
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        using var doc = JsonDocument.Parse(ctx.LeeDatosJson(id));
        var originales = doc.RootElement.GetProperty("opciones_originales");
        originales.GetArrayLength().Should().Be(1);
        originales[0].GetProperty("linea").GetString().Should().Be("Primera referencia");
    }

    // ---------------- POST /{id}/ajustes ----------------

    [Fact]
    public async Task Ajustar_SinPermisoAjustar_Retorna403()
    {
        using var ctx = new TestContext();
        var id = ctx.SembrarSolicitud(7003, "autorizada");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "7003");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.PostAsJsonAsync($"/api/viaticos/solicitudes/{id}/ajustes", new
        {
            campo = "total",
            valor_anterior = "1000",
            valor_nuevo = "900",
            motivo = "cotizacion corregida"
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain(Permissions.Viaticos.Ajustar);
    }

    [Fact]
    public async Task Ajustar_SinMotivo_Retorna400NominandoElCampoMotivo()
    {
        using var ctx = new TestContext();
        var id = ctx.SembrarSolicitud(7004, "autorizada");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "7004");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Ajustar);

        var resp = await cliente.PostAsJsonAsync($"/api/viaticos/solicitudes/{id}/ajustes", new
        {
            campo = "total",
            valor_anterior = "1000",
            valor_nuevo = "900"
            // motivo omitido
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("motivo");
        ctx.LeeEstado(id).Should().Be("autorizada");
    }

    [Fact]
    public async Task Ajustar_ConMotivo_ConservaValorAnteriorAplicaValorNuevoYDejaEvento()
    {
        using var ctx = new TestContext();
        const int adminId = 7005;
        var id = ctx.SembrarSolicitud(7005, "autorizada");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Ajustar);

        var resp = await cliente.PostAsJsonAsync($"/api/viaticos/solicitudes/{id}/ajustes", new
        {
            id_opcion = 0,
            campo = "total",
            valor_anterior = "1000",
            valor_nuevo = "900",
            motivo = "cotizacion corregida por el admin"
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        // valor_anterior INTACTO, valor_nuevo aplicado, motivo persistido.
        var ajustes = ctx.LeeAjustes(id);
        ajustes.Should().ContainSingle();
        ajustes[0].Campo.Should().Be("total");
        ajustes[0].ValorAnterior.Should().Be("1000");
        ajustes[0].ValorNuevo.Should().Be("900");
        ajustes[0].Motivo.Should().Be("cotizacion corregida por el admin");
        ajustes[0].IdUsuarioAdmin.Should().Be(adminId);

        // Estado transicionado.
        ctx.LeeEstado(id).Should().Be("autorizada_con_ajustes");

        // Evento de bitacora.
        var eventos = ctx.LeeEventos(id);
        eventos.Should().Contain(e => e.Tipo == "ajuste_aplicado");
        eventos.First(e => e.Tipo == "ajuste_aplicado").PayloadJson.Should()
            .Contain("valor_anterior").And.Contain("1000").And.Contain("900");
    }

    [Fact]
    public async Task Ajustar_SinCampo_Retorna400YNoRegistraNada()
    {
        using var ctx = new TestContext();
        var id = ctx.SembrarSolicitud(7007, "autorizada");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "7007");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Ajustar);

        var resp = await cliente.PostAsJsonAsync($"/api/viaticos/solicitudes/{id}/ajustes", new
        {
            campo = "   ",
            valor_anterior = "1000",
            valor_nuevo = "900",
            motivo = "cotizacion corregida"
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("campo");
        // Un ajuste sin campo no deja rastro fantasma ni cambia el estado.
        ctx.LeeAjustes(id).Should().BeEmpty();
        ctx.LeeEstado(id).Should().Be("autorizada");
    }

    // ---------------- POST /{id}/rechazar ----------------

    [Fact]
    public async Task Rechazar_SinMotivo_Retorna400()
    {
        using var ctx = new TestContext();
        var id = ctx.SembrarSolicitud(7006, "enviada");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "7006");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.PostAsJsonAsync($"/api/viaticos/solicitudes/{id}/rechazar", new
        {
            // motivo omitido
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("motivo");
        ctx.LeeEstado(id).Should().Be("enviada");
    }

    // =====================================================================
    //                            Test harness
    // =====================================================================

    /// <summary>
    /// <see cref="TestServer"/> con el <see cref="AprobacionesController"/> real,
    /// <see cref="ApplicationDbContext"/> sobre InMemory (nombre unico por test) y
    /// el <c>TestAuthHandler</c> compartido.
    ///
    /// <see cref="AsokamDbContext"/> tambien va sobre InMemory pero con su PROPIA
    /// base: el directorio de usuarios (<c>app.Usuarios</c>) vive en la BD Asokam,
    /// no en la de Lefarma, igual que en el servidor real.
    /// </summary>
    private sealed class TestContext : IDisposable
    {
        private readonly string _dbName = $"AprobacionesCtrl-{Guid.NewGuid():N}";
        private readonly string _asokamDbName = $"AprobacionesCtrl-Asokam-{Guid.NewGuid():N}";
        public TestServer Servidor { get; }

        public TestContext()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: _dbName)
                .Options;

            using (var seed = new ApplicationDbContext(options))
            {
                seed.Database.EnsureCreated();
            }

            var builder = new WebHostBuilder()
                .UseEnvironment(Environments.Development)
                .ConfigureServices(services =>
                {
                    services.AddLogging();
                    services.AddRouting();
                    services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(_dbName));
                    services.AddDbContext<AsokamDbContext>(o => o.UseInMemoryDatabase(_asokamDbName));
                    services.AddAuthentication(PermisosEndpointTests.TestAuthHandler.NombreEsquema)
                        .AddScheme<AuthenticationSchemeOptions, PermisosEndpointTests.TestAuthHandler>(
                            PermisosEndpointTests.TestAuthHandler.NombreEsquema, _ => { });
                    services.AddAuthorization();
                    services
                        .AddControllers()
                        .AddApplicationPart(typeof(AprobacionesController).Assembly);
                })
                .Configure(app =>
                {
                    app.UseRouting();
                    app.UseAuthentication();
                    app.UseAuthorization();
                    app.UseEndpoints(e => e.MapControllers());
                });

            Servidor = new TestServer(builder);
        }

        public int SembrarSolicitud(int duenoId, string estado)
            => SembrarSolicitud(duenoId, estado, """{"total":1000}""");

        public int SembrarSolicitud(
            int duenoId,
            string estado,
            string? datosJson,
            string? folio = null,
            string gerencia = "Operaciones")
        {
            using var scope = Servidor.Host.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var ahora = DateTime.UtcNow;
            var s = new Solicitud
            {
                IdUsuarioSolicitante = duenoId,
                Periodo = ahora.ToString("yyyy-MM"),
                Gerencia = gerencia,
                Estado = estado,
                DatosJson = datosJson!,
                Folio = folio,
                Activo = true,
                FechaCreacion = ahora,
                FechaModificacion = ahora,
            };
            db.Solicitudes.Add(s);
            db.SaveChanges();
            return s.IdSolicitud;
        }

        public void SembrarUsuario(int idUsuario, string nombreCompleto, bool esActivo)
        {
            using var scope = Servidor.Host.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AsokamDbContext>();
            db.Usuarios.Add(new Usuario
            {
                IdUsuario = idUsuario,
                NombreCompleto = nombreCompleto,
                EsActivo = esActivo,
            });
            db.SaveChanges();
        }

        public string LeeEstado(int idSolicitud)
        {
            using var scope = Servidor.Host.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            return db.Solicitudes.AsNoTracking().Single(x => x.IdSolicitud == idSolicitud).Estado;
        }

        public string LeeDatosJson(int idSolicitud)
        {
            using var scope = Servidor.Host.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            return db.Solicitudes.AsNoTracking().Single(x => x.IdSolicitud == idSolicitud).DatosJson;
        }

        public List<SolicitudOpcion> LeeOpciones(int idSolicitud)
        {
            using var scope = Servidor.Host.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            return db.SolicitudOpciones.AsNoTracking()
                .Where(x => x.IdSolicitud == idSolicitud)
                .OrderBy(x => x.IdOpcion)
                .ToList();
        }

        public void SembrarOpcion(
            int idSolicitud,
            string tipo,
            string linea,
            decimal? precio,
            bool fueElegida,
            string? datosJson = null,
            string? urlCompra = null,
            string fuente = "proveedor")
        {
            using var scope = Servidor.Host.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.SolicitudOpciones.Add(new SolicitudOpcion
            {
                IdSolicitud = idSolicitud,
                Tipo = tipo,
                Linea = linea,
                DatosJson = datosJson,
                Precio = precio,
                Moneda = "MXN",
                UrlCompra = urlCompra,
                Fuente = fuente,
                FueElegida = fueElegida,
            });
            db.SaveChanges();
        }

        /// <summary>
        /// Lee <c>datos.resumen_autorizado</c> como elemento JSON. Falla el test
        /// con un mensaje claro si la propiedad no existe: es el contrato que
        /// consume el concentrado FOR-008.
        /// </summary>
        public JsonElement LeeResumenAutorizado(int idSolicitud)
        {
            using var doc = JsonDocument.Parse(LeeDatosJson(idSolicitud));
            doc.RootElement.TryGetProperty("resumen_autorizado", out var resumen)
                .Should().BeTrue("la autorizacion debe sellar datos.resumen_autorizado");
            return resumen.Clone();
        }

        public List<SolicitudAjuste> LeeAjustes(int idSolicitud)
        {
            using var scope = Servidor.Host.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            return db.SolicitudAjustes.AsNoTracking().Where(x => x.IdSolicitud == idSolicitud).ToList();
        }

        public List<SolicitudEvento> LeeEventos(int idSolicitud)
        {
            using var scope = Servidor.Host.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            return db.SolicitudEventos.AsNoTracking().Where(x => x.IdSolicitud == idSolicitud).ToList();
        }

        public void Dispose() => Servidor.Dispose();
    }

    // ---------------------------------------------------------------------
    // Tipos auxiliares: replican el envelope y el DTO de bandeja para no
    // acoplar el test a las clases de presentacion.
    // ---------------------------------------------------------------------

    private sealed class ApiEnvelope<T>
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("message")]
        public string Message { get; set; } = string.Empty;

        [JsonPropertyName("data")]
        public T? Data { get; set; }
    }

    private sealed class BandejaItemJson
    {
        [JsonPropertyName("id_solicitud")]
        public int IdSolicitud { get; set; }

        [JsonPropertyName("folio")]
        public string? Folio { get; set; }

        [JsonPropertyName("id_usuario_solicitante")]
        public int IdUsuarioSolicitante { get; set; }

        [JsonPropertyName("gerencia")]
        public string Gerencia { get; set; } = string.Empty;

        [JsonPropertyName("estado")]
        public string Estado { get; set; } = string.Empty;

        [JsonPropertyName("nombre_solicitante")]
        public string NombreSolicitante { get; set; } = string.Empty;

        [JsonPropertyName("destino")]
        public string? Destino { get; set; }

        [JsonPropertyName("origen")]
        public string? Origen { get; set; }

        [JsonPropertyName("fecha")]
        public string? Fecha { get; set; }

        [JsonPropertyName("fecha_salida")]
        public string? FechaSalida { get; set; }

        [JsonPropertyName("fecha_regreso")]
        public string? FechaRegreso { get; set; }

        [JsonPropertyName("autobus")]
        public decimal? Autobus { get; set; }

        [JsonPropertyName("avion")]
        public decimal? Avion { get; set; }

        [JsonPropertyName("gasolina")]
        public decimal? Gasolina { get; set; }

        [JsonPropertyName("casetas")]
        public decimal? Casetas { get; set; }

        [JsonPropertyName("vehiculo_propio")]
        public decimal? VehiculoPropio { get; set; }

        [JsonPropertyName("hospedaje")]
        public decimal? Hospedaje { get; set; }

        [JsonPropertyName("comida")]
        public decimal? Comida { get; set; }

        [JsonPropertyName("taxi")]
        public decimal? Taxi { get; set; }

        [JsonPropertyName("total")]
        public decimal? Total { get; set; }
    }
}
