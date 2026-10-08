using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using Lefarma.API.Domain.Entities.Viaticos;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
// WebHostBuilder y TestServer(IWebHostBuilder) estan obsoletos en .NET 8+
// (ASPDEPR004/ASPDEPR008). Mismo criterio que PermisosEndpointTests: mini
// pipeline in-memory sin importar Program.cs ni una DB real.
#pragma warning disable ASPDEPR004
#pragma warning disable ASPDEPR008
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// Tests HTTP de <see cref="Lefarma.API.Features.Viaticos.SolicitudesController"/>
/// levantando una mini aplicacion ASP.NET Core en memoria con
/// <see cref="TestServer"/>, <c>ApplicationDbContext</c> sobre EF InMemory y el
/// <c>TestAuthHandler</c> compartido de <see cref="PermisosEndpointTests"/>
/// (inyecta <c>X-Test-UserId</c> / <c>X-Test-Permissions</c> sin JWT real).
///
/// Endpoints cubiertos (todos del scope de este incremento):
///   - POST /api/viaticos/solicitudes
///   - GET  /api/viaticos/solicitudes/mis
///   - GET  /api/viaticos/solicitudes/{id}
///   - PUT  /api/viaticos/solicitudes/{id}/opciones
///
/// Cada test crea su propio <see cref="TestContext"/> con un nombre de base
/// InMemory unico (Guid), por lo que son independientes y no dependen del orden.
/// </summary>
public class SolicitudesControllerTests
{
    // ---------------- POST /api/viaticos/solicitudes ----------------

    [Fact]
    public async Task Post_SinToken_Retorna401()
    {
        using var ctx = new TestContext();
        using var cliente = ctx.Servidor.CreateClient();

        var resp = await cliente.PostAsJsonAsync("/api/viaticos/solicitudes", new { datos = new { } });

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Post_ConTokenSinPermisoSolicitar_Retorna403()
    {
        using var ctx = new TestContext();
        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "5001");
        // Token valido, pero con 'ver_todos' (no 'solicitar').
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.VerTodos);

        var resp = await cliente.PostAsJsonAsync("/api/viaticos/solicitudes", new { datos = new { } });

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Post_ConPermisoSolicitar_Retorna201YGuardaElIdDelToken()
    {
        using var ctx = new TestContext();
        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "7777");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        // El body NO lleva id_usuario_solicitante: debe usarse el del token.
        var resp = await cliente.PostAsJsonAsync("/api/viaticos/solicitudes", new
        {
            gerencia = "Operaciones",
            datos = new { paso = 1, transporte = "avion" }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDtoJson>>();
        envelope.Should().NotBeNull();
        envelope!.Success.Should().BeTrue();
        envelope.Data.Should().NotBeNull();
        envelope.Data!.IdUsuarioSolicitante.Should().Be(7777);
        // periodo derivado del servidor (yyyy-MM), no del body.
        envelope.Data.Periodo.Should().MatchRegex(@"^\d{4}-\d{2}$");
        envelope.Data.Gerencia.Should().Be("Operaciones");
        envelope.Data.Estado.Should().Be("borrador");

        ctx.SembrarVerificacion(7777, envelope.Data.IdSolicitud);
    }

    [Fact]
    public async Task Post_IgnoraIdUsuarioSolicitanteDelBody_UsaElDelToken()
    {
        using var ctx = new TestContext();
        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "4242");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        // Caso de seguridad clave: el body intenta pedir en nombre de 9999.
        var resp = await cliente.PostAsJsonAsync("/api/viaticos/solicitudes", new
        {
            id_usuario_solicitante = 9999,
            datos = new { x = 1 }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDtoJson>>();
        envelope.Should().NotBeNull();
        envelope!.Data.Should().NotBeNull();
        envelope.Data!.IdUsuarioSolicitante.Should().Be(4242);

        using var scope = ctx.Servidor.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var guardada = await db.Solicitudes.AsNoTracking()
            .SingleAsync(x => x.IdSolicitud == envelope.Data.IdSolicitud);
        guardada.IdUsuarioSolicitante.Should().Be(4242);
        db.Solicitudes.AsNoTracking().Any(x => x.IdUsuarioSolicitante == 9999)
            .Should().BeFalse("el id del body no debe crear filas ajenas");
    }

    // ---------------- GET /api/viaticos/solicitudes/mis ----------------

    [Fact]
    public async Task GetMis_DevuelveSoloLasDelUsuarioAutenticado()
    {
        using var ctx = new TestContext();
        const int yoId = 6100;
        const int otroId = 6101;

        var mia1 = ctx.SembrarSolicitud(yoId, "MIA -> MTY");
        var mia2 = ctx.SembrarSolicitud(yoId, "MIA -> GDL");
        var ajena = ctx.SembrarSolicitud(otroId, "OTRO -> CUN");
        // Una solicitud inactiva del mismo usuario tampoco debe listarse.
        var inactiva = ctx.SembrarSolicitud(yoId, "MIA -> SJD", activo: false);

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", yoId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes/mis");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<List<SolicitudDtoJson>>>();
        envelope.Should().NotBeNull();
        envelope!.Success.Should().BeTrue();
        envelope.Data.Should().NotBeNull();

        var ids = envelope.Data!.Select(x => x.IdSolicitud).ToList();
        ids.Should().BeEquivalentTo(new[] { mia1, mia2 });
        envelope.Data.Should().OnlyContain(x => x.IdUsuarioSolicitante == yoId);
        ids.Should().NotContain(ajena);
        ids.Should().NotContain(inactiva);
    }

    [Fact]
    public async Task GetMis_SinToken_Retorna401()
    {
        using var ctx = new TestContext();
        using var cliente = ctx.Servidor.CreateClient();

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes/mis");

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ---------------- GET /api/viaticos/solicitudes/{id} ----------------

    [Fact]
    public async Task GetDetalle_DeSolicitudAjenaSinVerTodos_Retorna403()
    {
        using var ctx = new TestContext();
        const int duenoId = 100;
        const int solicitanteId = 200;
        var idSolicitud = ctx.SembrarSolicitud(duenoId, "CDMX -> MTY");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", solicitanteId.ToString());
        // Solo 'solicitar' (sin 'ver_todos'): no debe ver lo ajeno.
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.GetAsync($"/api/viaticos/solicitudes/{idSolicitud}");

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetDetalle_ConPermisoVerTodos_Retorna200AunqueSeaAjena()
    {
        using var ctx = new TestContext();
        const int duenoId = 100;
        const int adminId = 500;
        var idSolicitud = ctx.SembrarSolicitud(duenoId, "GDL -> CUN");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions",
            string.Join(",", Permissions.Viaticos.Solicitar, Permissions.Viaticos.VerTodos));

        var resp = await cliente.GetAsync($"/api/viaticos/solicitudes/{idSolicitud}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDtoJson>>();
        envelope!.Data!.IdUsuarioSolicitante.Should().Be(duenoId);
    }

    [Fact]
    public async Task GetDetalle_Propio_Retorna200ConEventosYOpciones()
    {
        using var ctx = new TestContext();
        const int duenoId = 321;
        var idSolicitud = ctx.SembrarSolicitud(duenoId, "QRO -> TIJ");
        ctx.SembrarOpcion(idSolicitud, fuente: "GoogleFlights", urlCompra: "https://flights.google.com/x", precio: 1850m);
        ctx.SembrarEvento(idSolicitud, "creada", duenoId);

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", duenoId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.GetAsync($"/api/viaticos/solicitudes/{idSolicitud}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDtoJson>>();
        envelope!.Data.Should().NotBeNull();
        envelope.Data!.Opciones.Should().HaveCount(1);
        envelope.Data.Opciones[0].Fuente.Should().Be("GoogleFlights");
        envelope.Data.Eventos.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GetDetalle_EventoDeAjuste_ExponeElPayloadConCampoValorAnteriorYMotivo()
    {
        using var ctx = new TestContext();
        const int duenoId = 322;
        var idSolicitud = ctx.SembrarSolicitud(duenoId, "QRO -> TIJ ajuste");
        // Mismo payload_json que escribe AprobacionesController al aplicar un
        // ajuste: sin esto el frontend nunca ve "que cambio" ni "por que".
        ctx.SembrarEvento(idSolicitud, "creada", duenoId);
        ctx.SembrarEvento(idSolicitud, "ajuste_aplicado", duenoId,
            payloadJson: "{\"campo\":\"total\",\"valor_anterior\":\"5000.00\",\"valor_nuevo\":\"4200.00\",\"motivo\":\"cotizacion mas barata\",\"id_opcion\":null}");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", duenoId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.GetAsync($"/api/viaticos/solicitudes/{idSolicitud}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDtoJson>>();
        envelope!.Data!.Eventos.Should().HaveCount(2);

        var ajuste = envelope.Data.Eventos.Single(e => e.Tipo == "ajuste_aplicado");
        ajuste.Payload.Should().NotBeNull();
        var payload = ajuste.Payload!.Value;
        payload.GetProperty("campo").GetString().Should().Be("total");
        payload.GetProperty("valor_anterior").GetString().Should().Be("5000.00");
        payload.GetProperty("valor_nuevo").GetString().Should().Be("4200.00");
        payload.GetProperty("motivo").GetString().Should().Be("cotizacion mas barata");

        // El evento sin payload sigue saliendo completo (payload = null).
        var creada = envelope.Data.Eventos.Single(e => e.Tipo == "creada");
        creada.Payload.Should().BeNull();
        creada.IdEvento.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetDetalle_EventoConPayloadJsonInvalido_ExponePayloadNullYNoRompeElDetalle()
    {
        using var ctx = new TestContext();
        const int duenoId = 323;
        var idSolicitud = ctx.SembrarSolicitud(duenoId, "MTY -> TIJ roto");
        ctx.SembrarEvento(idSolicitud, "ajuste_aplicado", duenoId, payloadJson: "{esto-no-es-json");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", duenoId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.GetAsync($"/api/viaticos/solicitudes/{idSolicitud}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDtoJson>>();
        envelope!.Data!.Eventos.Should().HaveCount(1);
        envelope.Data.Eventos[0].Payload.Should().BeNull();
    }

    // ---------------- PUT /api/viaticos/solicitudes/{id}/opciones ----------------

    [Fact]
    public async Task PutOpciones_OpcionSinUrlCompra_Retorna400NominandoElCampo()
    {
        using var ctx = new TestContext();
        const int duenoId = 800;
        var idSolicitud = ctx.SembrarSolicitud(duenoId, "MTY -> BJX");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", duenoId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PutAsJsonAsync($"/api/viaticos/solicitudes/{idSolicitud}/opciones", new
        {
            cotizacion = new
            {
                opciones = new[]
                {
                    new
                    {
                        tipo = "vuelo",
                        linea = "MTY -> BJX 2026-11-12",
                        fuente = "GoogleFlights",
                        precio = 1500m,
                        // url_compra omitido -> debe fallar
                    }
                }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("url_compra");
    }

    [Fact]
    public async Task PutOpciones_OpcionSinFuente_Retorna400()
    {
        using var ctx = new TestContext();
        const int duenoId = 810;
        var idSolicitud = ctx.SembrarSolicitud(duenoId, "MTY -> SJD");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", duenoId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PutAsJsonAsync($"/api/viaticos/solicitudes/{idSolicitud}/opciones", new
        {
            cotizacion = new
            {
                opciones = new[]
                {
                    new
                    {
                        tipo = "vuelo",
                        linea = "MTY -> SJD 2026-11-20",
                        url_compra = "https://www.google.com/travel/flights",
                        precio = 2200m,
                        // fuente omitida -> debe fallar
                    }
                }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("fuente");
    }

    [Fact]
    public async Task PutOpciones_PrecioNullConFuenteNoEstimado_Retorna400()
    {
        using var ctx = new TestContext();
        const int duenoId = 801;
        var idSolicitud = ctx.SembrarSolicitud(duenoId, "Puebla -> CDMX");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", duenoId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PutAsJsonAsync($"/api/viaticos/solicitudes/{idSolicitud}/opciones", new
        {
            cotizacion = new
            {
                opciones = new[]
                {
                    new
                    {
                        tipo = "hotel",
                        linea = "Hotel Majestic 2 noches",
                        fuente = "Booking", // NO contiene "estimado"
                        url_compra = "https://www.booking.com/hotel/majestic",
                        precio = (decimal?)null, // null + fuente no-estimado -> 400
                    }
                }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("precio");
    }

    [Fact]
    public async Task PutOpciones_PrecioNullConFuenteEstimado_Retorna200()
    {
        using var ctx = new TestContext();
        const int duenoId = 802;
        var idSolicitud = ctx.SembrarSolicitud(duenoId, "Veracruz -> Puebla");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", duenoId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PutAsJsonAsync($"/api/viaticos/solicitudes/{idSolicitud}/opciones", new
        {
            cotizacion = new
            {
                opciones = new[]
                {
                    new
                    {
                        tipo = "vuelo",
                        linea = "VER -> PBC 2026-12-01",
                        fuente = "estimado fase 1 (sin proveedor)",
                        url_compra = "https://www.google.com/search?q=vuelo+VER+PBC",
                        precio = (decimal?)null,
                    }
                }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDtoJson>>();
        envelope!.Data.Should().NotBeNull();
        envelope.Data!.Opciones.Should().HaveCount(1);
        envelope.Data.Opciones[0].Fuente.Should().Contain("estimado");
        envelope.Data.Opciones[0].Precio.Should().BeNull();
    }

    [Fact]
    public async Task PutOpciones_DeSolicitudAjenaSinVerTodos_Retorna403()
    {
        using var ctx = new TestContext();
        const int duenoId = 900;
        const int otroId = 901;
        var idSolicitud = ctx.SembrarSolicitud(duenoId, "XAL -> CDMX");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", otroId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PutAsJsonAsync($"/api/viaticos/solicitudes/{idSolicitud}/opciones", new
        {
            cotizacion = new
            {
                opciones = new[]
                {
                    new { tipo = "vuelo", linea = "x", fuente = "f", url_compra = "https://e.x", precio = 1m }
                }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // =====================================================================
    //   Transicion borrador -> enviada al guardar la cotizacion
    // =====================================================================

    /// <summary>
    /// Regresion del bug original: <c>GuardarOpciones</c> persistia la
    /// cotizacion pero NUNCA tocaba <c>Solicitud.Estado</c>, asi que toda
    /// solicitud se quedaba en 'borrador' para siempre y
    /// <c>AprobacionesController</c> (que solo acepta 'enviada') respondia
    /// 409: la bandeja autorizable quedaba vacia sin que nadie lo notara.
    ///
    /// Este test recorre el flujo REAL completo por HTTP
    /// (POST -> PUT opciones -> GET detalle) y lee el estado devuelto por el
    /// SERVIDOR, no un mock: si se quita la transicion del controller, el
    /// GET devuelve 'borrador' y el test falla.
    /// </summary>
    [Fact]
    public async Task PutOpciones_PasaLaSolicitudDeBorradorAEnviadaYElDetalleLoDevuelve()
    {
        using var ctx = new TestContext();
        const int userId = 950;
        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", userId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        // 1) Crear: nace en 'borrador'.
        var creada = await cliente.PostAsJsonAsync("/api/viaticos/solicitudes", new
        {
            gerencia = "Operaciones",
            datos = new { ruta = "MTY -> BJX" }
        });
        creada.StatusCode.Should().Be(HttpStatusCode.Created);
        var envelopeCreada = await creada.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDtoJson>>();
        envelopeCreada!.Data!.Estado.Should().Be("borrador");
        var idSolicitud = envelopeCreada.Data.IdSolicitud;

        // 2) Guardar la cotizacion: ES el envio.
        var guardada = await cliente.PutAsJsonAsync($"/api/viaticos/solicitudes/{idSolicitud}/opciones", new
        {
            cotizacion = new
            {
                opciones = new[]
                {
                    new
                    {
                        tipo = "vuelo",
                        linea = "MTY -> BJX 2026-11-12",
                        fuente = "GoogleFlights",
                        url_compra = "https://flights.google.com/mty-bjx",
                        precio = 1500m,
                        fue_elegida = true,
                    }
                }
            }
        });
        guardada.StatusCode.Should().Be(HttpStatusCode.OK);

        // 3) Leer el estado final DESDE EL SERVIDOR (otra peticion HTTP).
        var detalle = await cliente.GetAsync($"/api/viaticos/solicitudes/{idSolicitud}");
        detalle.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelopeDetalle = await detalle.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDtoJson>>();
        envelopeDetalle!.Data!.IdSolicitud.Should().Be(idSolicitud);
        envelopeDetalle.Data.Estado.Should().Be(
            "enviada",
            "guardar la cotizacion debe dejar la solicitud autorizable; si se queda en 'borrador' AprobacionesController devuelve 409");

        // Corroboracion en la BD (misma fuente de verdad del servidor, no un mock).
        using (var scope = ctx.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var enBd = await db.Solicitudes.AsNoTracking()
                .SingleAsync(x => x.IdSolicitud == idSolicitud);
            enBd.Estado.Should().Be("enviada");
        }

        // La transicion no debe alterar el comportamiento de las opciones.
        envelopeDetalle.Data.Opciones.Should().HaveCount(1);
        envelopeDetalle.Data.Opciones[0].FueElegida.Should().BeTrue();
    }

    /// <summary>
    /// La transicion deja traza en <c>solicitud_eventos</c>: el evento
    /// 'enviada' debe quedar en el historial, con el usuario del token y la
    /// fecha del envio. Sin el, la auditoria del wizard no explica cuando
    /// salto de 'borrador' a 'enviada'.
    /// </summary>
    [Fact]
    public async Task PutOpciones_RegistraElEventoEnviadaEnElHistorial()
    {
        using var ctx = new TestContext();
        const int userId = 951;
        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", userId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var creada = await cliente.PostAsJsonAsync("/api/viaticos/solicitudes", new
        {
            datos = new { ruta = "GDL -> CUN" }
        });
        var envelopeCreada = await creada.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDtoJson>>();
        var idSolicitud = envelopeCreada!.Data!.IdSolicitud;

        await cliente.PutAsJsonAsync($"/api/viaticos/solicitudes/{idSolicitud}/opciones", new
        {
            cotizacion = new
            {
                opciones = new[]
                {
                    new
                    {
                        tipo = "hotel",
                        linea = "Hotel Riu 2 noches",
                        fuente = "estimado fase 1 (sin proveedor)",
                        url_compra = "https://www.google.com/search?q=hotel+gdl",
                        precio = (decimal?)null,
                    }
                }
            }
        });

        var detalle = await cliente.GetAsync($"/api/viaticos/solicitudes/{idSolicitud}");
        var envelope = await detalle.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDtoJson>>();
        var eventos = envelope!.Data!.Eventos;

        // 'creada' + 'cotizacion_guardada' + 'enviada'.
        eventos.Select(e => e.Tipo).Should().Contain(new[] { "creada", "cotizacion_guardada", "enviada" });

        var enviada = eventos.Single(e => e.Tipo == "enviada");
        enviada.IdUsuario.Should().Be(userId, "el evento se registra con el usuario del token");
        enviada.FechaCreacion.Should().NotBe(default);

        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var eventosBd = db.SolicitudEventos.AsNoTracking()
            .Where(e => e.IdSolicitud == idSolicitud && e.Tipo == "enviada")
            .ToList();
        eventosBd.Should().HaveCount(1, "la transicion se registra una sola vez");
        eventosBd[0].IdUsuario.Should().Be(userId);
        eventosBd[0].PayloadJson.Should().Contain("enviada");
    }

    /// <summary>
    /// Regla anti-retroceso: la transicion a 'enviada' SOLO aplica cuando la
    /// solicitud esta en 'borrador'. Una solicitud ya resuelta ('autorizada'
    /// o 'rechazada') no debe volver a 'enviada' porque reenviar opciones
    /// borraria la decision del autorizador, y tampoco debe registrar un
    /// evento 'enviada' que no ocurrio.
    ///
    /// El estado terminal se SIEMBRA en la fila real de EF InMemory (via
    /// <see cref="TestContext.SembrarSolicitud"/>), no se falsea con un mock:
    /// si la regla se rompe, el PUT mueve la fila a 'enviada' y el test falla.
    /// </summary>
    [Theory]
    [InlineData("autorizada")]
    [InlineData("rechazada")]
    public async Task PutOpciones_SolicitudYaResueltaNoRetrocedeANiRegistraEventoEnviada(string estadoTerminal)
    {
        using var ctx = new TestContext();
        const int duenoId = 970;
        var idSolicitud = ctx.SembrarSolicitud(duenoId, "MTY -> CUN terminal", estado: estadoTerminal);
        // El desenlace ya quedo en la bitacora antes de reenviar opciones.
        ctx.SembrarEvento(idSolicitud, estadoTerminal, duenoId);

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", duenoId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PutAsJsonAsync($"/api/viaticos/solicitudes/{idSolicitud}/opciones", new
        {
            cotizacion = new
            {
                opciones = new[]
                {
                    new
                    {
                        tipo = "vuelo",
                        linea = "MTY -> CUN 2026-12-10",
                        fuente = "GoogleFlights",
                        url_compra = "https://flights.google.com/mty-cun",
                        precio = 1700m,
                        fue_elegida = true,
                    }
                }
            }
        });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDtoJson>>();
        envelope!.Data.Should().NotBeNull();

        // (a) El estado terminal sigue intacto, tanto en la respuesta como en
        //     la fila real de la BD.
        envelope.Data!.Estado.Should().Be(
            estadoTerminal,
            "reenviar opciones no debe borrar una autorizacion ni revivir una solicitud rechazada");
        envelope.Data.Eventos.Should().NotContain(
            e => e.Tipo == "enviada",
            "sin transicion real no se registra el evento 'enviada'");

        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var enBd = await db.Solicitudes.AsNoTracking().SingleAsync(x => x.IdSolicitud == idSolicitud);
        enBd.Estado.Should().Be(estadoTerminal);

        var eventosEnviada = db.SolicitudEventos.AsNoTracking()
            .Where(e => e.IdSolicitud == idSolicitud && e.Tipo == "enviada")
            .ToList();
        eventosEnviada.Should().BeEmpty("no hubo transicion, no hay evento 'enviada'");

        // La cotizacion SI se guarda (es el proposito del endpoint): el evento
        // 'cotizacion_guardada' existe aunque no haya envio.
        db.SolicitudEventos.AsNoTracking()
            .Any(e => e.IdSolicitud == idSolicitud && e.Tipo == "cotizacion_guardada")
            .Should().BeTrue("guardar opciones sigue registrando su propia bitacora");
    }

    // =====================================================================
    //                            Test harness
    // =====================================================================

    /// <summary>
    /// Levanta un <see cref="TestServer"/> con el SolicitudesController real,
    /// <see cref="ApplicationDbContext"/> sobre EF InMemory y la auth de
    /// pruebas. El nombre de la base InMemory es unico por instancia, asi que
    /// los tests no comparten estado.
    /// </summary>
    private sealed class TestContext : IDisposable
    {
        private readonly string _dbName = $"SolicitudesCtrl-{Guid.NewGuid():N}";
        public TestServer Servidor { get; }

        public TestContext()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: _dbName)
                .Options;

            // Crea el modelo EF antes de que el controller pida el DbContext.
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
                    services.AddAuthentication(PermisosEndpointTests.TestAuthHandler.NombreEsquema)
                        .AddScheme<AuthenticationSchemeOptions, PermisosEndpointTests.TestAuthHandler>(
                            PermisosEndpointTests.TestAuthHandler.NombreEsquema, _ => { });
                    services.AddAuthorization();
                    services
                        .AddControllers()
                        .AddApplicationPart(typeof(Lefarma.API.Features.Viaticos.SolicitudesController).Assembly);
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

        public IServiceProvider Services => Servidor.Services;

        public void SembrarVerificacion(int userIdEsperado, int idSolicitud)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var s = db.Solicitudes.AsNoTracking().Single(x => x.IdSolicitud == idSolicitud);
            s.IdUsuarioSolicitante.Should().Be(userIdEsperado);
        }

        public int SembrarSolicitud(int duenoId, string linea, bool activo = true, string estado = "borrador")
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var ahora = DateTime.UtcNow;
            var s = new Solicitud
            {
                IdUsuarioSolicitante = duenoId,
                Periodo = ahora.ToString("yyyy-MM"),
                Gerencia = "Operaciones",
                Estado = estado,
                // 'linea' se usa solo para distinguir semillas en fallos.
                DatosJson = $"{{\"linea\":\"{linea}\"}}",
                Activo = activo,
                FechaCreacion = ahora,
                FechaModificacion = ahora,
            };
            db.Solicitudes.Add(s);
            db.SaveChanges();
            return s.IdSolicitud;
        }

        public void SembrarOpcion(int idSolicitud, string fuente, string urlCompra, decimal? precio)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.SolicitudOpciones.Add(new SolicitudOpcion
            {
                IdSolicitud = idSolicitud,
                Tipo = "vuelo",
                Linea = "TEST",
                DatosJson = null,
                Precio = precio,
                Moneda = "MXN",
                UrlCompra = urlCompra,
                Fuente = fuente,
                FueElegida = false,
                RutaCaptura = null,
                CapturadaEn = null,
            });
            db.SaveChanges();
        }

        public void SembrarEvento(int idSolicitud, string tipo, int userId, string? payloadJson = null)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.SolicitudEventos.Add(new SolicitudEvento
            {
                IdSolicitud = idSolicitud,
                Tipo = tipo,
                PayloadJson = payloadJson,
                IdUsuario = userId,
                FechaCreacion = DateTime.UtcNow,
            });
            db.SaveChanges();
        }

        public void Dispose() => Servidor.Dispose();
    }

    // ---------------------------------------------------------------------
    // Tipos auxiliares para deserializar el envelope ApiResponse<T> sin
    // acoplar el test a las clases de dominio (que son internas al controller).
    // ---------------------------------------------------------------------

    // La API serializa en snake_case, asi que los tipos de deserializacion
    // replican los JsonPropertyName de SolicitudDtos.cs.
    private sealed class ApiEnvelope<T>
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("message")]
        public string Message { get; set; } = string.Empty;

        [JsonPropertyName("data")]
        public T? Data { get; set; }
    }

    private sealed class SolicitudDtoJson
    {
        [JsonPropertyName("id_solicitud")]
        public int IdSolicitud { get; set; }

        [JsonPropertyName("id_usuario_solicitante")]
        public int IdUsuarioSolicitante { get; set; }

        [JsonPropertyName("periodo")]
        public string Periodo { get; set; } = string.Empty;

        [JsonPropertyName("gerencia")]
        public string Gerencia { get; set; } = string.Empty;

        [JsonPropertyName("estado")]
        public string Estado { get; set; } = string.Empty;

        [JsonPropertyName("activo")]
        public bool Activo { get; set; }

        [JsonPropertyName("fecha_creacion")]
        public DateTime FechaCreacion { get; set; }

        [JsonPropertyName("fecha_modificacion")]
        public DateTime FechaModificacion { get; set; }

        [JsonPropertyName("datos")]
        public JsonElement? Datos { get; set; }

        [JsonPropertyName("opciones")]
        public List<SolicitudOpcionDtoJson> Opciones { get; set; } = new();

        [JsonPropertyName("eventos")]
        public List<SolicitudEventoDtoJson> Eventos { get; set; } = new();
    }

    private sealed class SolicitudOpcionDtoJson
    {
        [JsonPropertyName("id_opcion")]
        public int IdOpcion { get; set; }

        [JsonPropertyName("tipo")]
        public string Tipo { get; set; } = string.Empty;

        [JsonPropertyName("linea")]
        public string Linea { get; set; } = string.Empty;

        [JsonPropertyName("precio")]
        public decimal? Precio { get; set; }

        [JsonPropertyName("moneda")]
        public string? Moneda { get; set; }

        [JsonPropertyName("url_compra")]
        public string? UrlCompra { get; set; }

        [JsonPropertyName("fuente")]
        public string Fuente { get; set; } = string.Empty;

        [JsonPropertyName("fue_elegida")]
        public bool FueElegida { get; set; }

        [JsonPropertyName("ruta_captura")]
        public string? RutaCaptura { get; set; }
    }

    private sealed class SolicitudEventoDtoJson
    {
        [JsonPropertyName("id_evento")]
        public int IdEvento { get; set; }

        [JsonPropertyName("tipo")]
        public string Tipo { get; set; } = string.Empty;

        [JsonPropertyName("id_usuario")]
        public int IdUsuario { get; set; }

        [JsonPropertyName("fecha_creacion")]
        public DateTime FechaCreacion { get; set; }

        [JsonPropertyName("payload")]
        public JsonElement? Payload { get; set; }
    }
}