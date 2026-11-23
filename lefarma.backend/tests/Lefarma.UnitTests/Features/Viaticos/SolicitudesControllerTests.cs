using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Entities.Viaticos;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
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

public class SolicitudesControllerTests
{

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

[Fact]
    public async Task PostDesdeEducacionMedica_CreaLigaYReutilizaMismoConjunto()
    {
        using var ctx = new TestContext();
        ctx.SembrarRutaConVisitas(9, new[] { 101, 102, 103, 104 });
        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "7001");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var body = new
        {
            id_ruta = 9,
            id_seleccion_mensual = 3,
            id_ruta_visitas = new[] { 101, 102 },
            gerencia = "EM",
            datos = new { destinos = new[] { 101, 102 } }
        };

        var resp = await cliente.PostAsJsonAsync("/api/viaticos/solicitudes/desde-educacion-medica", body);
        resp.StatusCode.Should().Be(HttpStatusCode.Created);

        var creada = await resp.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDesdeEmDtoJson>>();
        creada.Should().NotBeNull();
        creada!.Success.Should().BeTrue();
        creada.Data.Should().NotBeNull();
        creada.Data!.Reutilizado.Should().BeFalse();
        var id = creada.Data.IdSolicitud;

        using (var scope = ctx.Servidor.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var guardada = await db.Solicitudes
                .AsNoTracking()
                .Include(s => s.OrigenEmVisitas)
                .SingleAsync(s => s.IdSolicitud == id);
            guardada.SistemaOrigen.Should().Be("educacion_medica");
            guardada.Estado.Should().Be("borrador");
            guardada.NumPuntos.Should().Be(2);
            guardada.OrigenEmVisitas.Select(l => l.IdRutaVisita).OrderBy(v => v)
                .Should().Equal(101, 102);
            guardada.OrigenEmVisitas.Should().OnlyContain(l => l.IdRuta == 9 && l.IdSeleccionMensual == 3);
        }

        var respReuso = await cliente.PostAsJsonAsync("/api/viaticos/solicitudes/desde-educacion-medica", body);
        respReuso.StatusCode.Should().Be(HttpStatusCode.OK);
        var reutilizada = await respReuso.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDesdeEmDtoJson>>();
        reutilizada!.Data!.Reutilizado.Should().BeTrue();
        reutilizada.Data.IdSolicitud.Should().Be(id);

        var respOtra = await cliente.PostAsJsonAsync("/api/viaticos/solicitudes/desde-educacion-medica", new
        {
            id_ruta = 9,
            id_ruta_visitas = new[] { 103, 104 },
            datos = new { destinos = new[] { 103, 104 } }
        });
        respOtra.StatusCode.Should().Be(HttpStatusCode.Created);
        var otra = await respOtra.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDesdeEmDtoJson>>();
        otra!.Data!.IdSolicitud.Should().NotBe(id);
        otra.Data.Reutilizado.Should().BeFalse();
    }

    [Fact]
    public async Task PostDesdeEducacionMedica_SinGerencia_UsaLaGerenciaDeLaSeleccion()
    {
        using var ctx = new TestContext();
        ctx.SembrarRutaConVisitas(14, new[] { 901 });
        var ahora = DateTime.UtcNow;
        using (var scope = ctx.Servidor.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.TiposGerencia.Add(new TipoGerencia
            {
                IdTipoGerencia = 7,
                Descripcion = "IMSS",
                Activo = true,
                FechaCreacion = ahora,
                FechaModificacion = ahora,
            });
            db.SeleccionesMensuales.Add(new SeleccionMensual
            {
                IdSeleccionMensual = 3,
                FechaSeleccion = new DateOnly(2026, 10, 1),
                IdTipoGerencia = 7,
                Estado = SeleccionMensual.EstadoCreada,
                Activo = true,
                FechaCreacion = ahora,
                FechaModificacion = ahora,
            });
            db.SaveChanges();
        }

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "7010");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PostAsJsonAsync("/api/viaticos/solicitudes/desde-educacion-medica", new
        {
            id_ruta = 14,
            id_ruta_visitas = new[] { 901 },
            datos = new { destinos = new[] { 901 } }
        });
        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var creada = await resp.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDesdeEmDtoJson>>();

        using var verificacion = ctx.Servidor.Services.CreateScope();
        var contexto = verificacion.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var guardada = await contexto.Solicitudes
            .AsNoTracking()
            .SingleAsync(s => s.IdSolicitud == creada!.Data!.IdSolicitud);
        guardada.Gerencia.Should().Be("IMSS");
    }

    [Fact]
    public async Task PostDesdeEducacionMedica_RutaConEspecialistasDistintos_Retorna409()
    {
        using var ctx = new TestContext();
        ctx.SembrarRutaConVisitas(12, new[] { 601 }, idEspecialista: 20);
        using (var scope = ctx.Servidor.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.RutasVisitas.Add(new RutaVisita
            {
                IdRutaVisita = 602,
                IdRuta = 12,
                IdEspecialista = 21,
                FechaVisita = new DateOnly(2026, 10, 21),
                Orden = 2,
                FechaCreacion = DateTime.UtcNow,
                FechaModificacion = DateTime.UtcNow,
            });
            db.SaveChanges();
        }

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "7004");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PostAsJsonAsync("/api/viaticos/solicitudes/desde-educacion-medica", new
        {
            id_ruta = 12,
            id_ruta_visitas = new[] { 601, 602 },
            datos = new { destinos = new[] { 601, 602 } }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await resp.Content.ReadAsStringAsync()).Should().Contain("especialistas distintos");
    }

    [Theory]
    [InlineData(Ruta.EstadoArchivada)]
    [InlineData(Ruta.EstadoCancelada)]
    [InlineData(Ruta.EstadoRechazada)]
    public async Task PostDesdeEducacionMedica_RutaNoVigente_Retorna409(string estadoRuta)
    {
        using var ctx = new TestContext();
        ctx.SembrarRutaConVisitas(11, new[] { 501 }, estado: estadoRuta);
        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "7005");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PostAsJsonAsync("/api/viaticos/solicitudes/desde-educacion-medica", new
        {
            id_ruta = 11,
            id_ruta_visitas = new[] { 501 },
            datos = new { destinos = new[] { 501 } }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var texto = await resp.Content.ReadAsStringAsync();
        texto.Should().Contain(estadoRuta);
        texto.Should().Contain("no se puede cotizar");
    }

    [Fact]
    public async Task PostDesdeEducacionMedica_RutaCerrada_PermiteCotizar()
    {
        using var ctx = new TestContext();
        ctx.SembrarRutaConVisitas(13, new[] { 502 }, estado: Ruta.EstadoCerrada);
        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "7006");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PostAsJsonAsync("/api/viaticos/solicitudes/desde-educacion-medica", new
        {
            id_ruta = 13,
            id_ruta_visitas = new[] { 502 },
            datos = new { destinos = new[] { 502 } }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task PostDesdeEducacionMedica_VisitaEnCotizacionActiva_Retorna409ConFolio()
    {
        using var ctx = new TestContext();
        const int userId = 7002;
        ctx.SembrarRutaConVisitas(10, new[] { 201 });
        _ = ctx.SembrarCotizacionEducacionMedica(
            userId, idRuta: 10, idRutaVisitas: new[] { 201 }, estado: "enviada", folio: "VIA-EM-9999");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", userId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PostAsJsonAsync("/api/viaticos/solicitudes/desde-educacion-medica", new
        {
            id_ruta = 10,
            id_ruta_visitas = new[] { 201 },
            datos = new { destinos = new[] { 201 } }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var texto = await resp.Content.ReadAsStringAsync();
        texto.Should().Contain("VIA-EM-9999");
    }

[Fact]
    public async Task GetPorRuta_DevuelveTodasConFolioEstadoYTotal()
    {
        using var ctx = new TestContext();
        const int userId = 7003;
        var conTotal = ctx.SembrarCotizacionEducacionMedica(
            userId, idRuta: 12, idRutaVisitas: new[] { 301, 302 }, estado: "enviada", total: 1500.50m, folio: "VIA-EM-A");
        var sinTotal = ctx.SembrarCotizacionEducacionMedica(
            userId, idRuta: 12, idRutaVisitas: new[] { 401, 402 }, estado: "borrador", folio: "VIA-EM-B");
        _ = ctx.SembrarCotizacionEducacionMedica(
            userId, idRuta: 99, idRutaVisitas: new[] { 501 }, estado: "enviada", total: 10m, folio: "VIA-EM-X");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", userId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes/por-ruta/12");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<List<SolicitudPorRutaDtoJson>>>();
        envelope.Should().NotBeNull();
        envelope!.Data.Should().NotBeNull();
        envelope.Data!.Select(x => x.IdSolicitud).Should().BeEquivalentTo(new[] { conTotal, sinTotal });

        var primera = envelope.Data.Single(x => x.IdSolicitud == conTotal);
        primera.Folio.Should().Be("VIA-EM-A");
        primera.Estado.Should().Be("enviada");
        primera.Total.Should().Be(1500.50m);
        primera.IdRutaVisitas.Should().BeEquivalentTo(new[] { 301, 302 });

        var segunda = envelope.Data.Single(x => x.IdSolicitud == sinTotal);
        segunda.Folio.Should().Be("VIA-EM-B");
        segunda.Total.Should().BeNull();
        segunda.IdRutaVisitas.Should().BeEquivalentTo(new[] { 401, 402 });
    }

[Fact]
    public async Task GetMis_DevuelveSoloLasDelUsuarioAutenticado()
    {
        using var ctx = new TestContext();
        const int yoId = 6100;
        const int otroId = 6101;

        var mia1 = ctx.SembrarSolicitud(yoId, "MIA -> MTY");
        var mia2 = ctx.SembrarSolicitud(yoId, "MIA -> GDL");
        var ajena = ctx.SembrarSolicitud(otroId, "OTRO -> CUN");
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

    [Fact]
    public async Task GetMis_ConVerTodos_DevuelveTambienLasAjenasYBorradores()
    {
        using var ctx = new TestContext();
        const int yoId = 6200;
        const int otroId = 6201;

        var mia = ctx.SembrarSolicitud(yoId, "MIA -> MTY", estado: "enviada");
        var borradorMio = ctx.SembrarSolicitud(yoId, "MIA -> GDL");
        var ajenaEnviada = ctx.SembrarSolicitud(otroId, "OTRO -> CUN", estado: "enviada");
        var borradorAjeno = ctx.SembrarSolicitud(otroId, "OTRO -> SJD");
        var inactivaAjena = ctx.SembrarSolicitud(otroId, "OTRO -> PBC", activo: false);

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", yoId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions",
            string.Join(",", Permissions.Viaticos.Solicitar, Permissions.Viaticos.VerTodos));

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes/mis?todas=true");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<List<SolicitudDtoJson>>>();
        envelope!.Success.Should().BeTrue();
        var ids = envelope.Data!.Select(x => x.IdSolicitud).ToList();
        ids.Should().BeEquivalentTo(new[] { mia, borradorMio, ajenaEnviada, borradorAjeno });
        ids.Should().NotContain(inactivaAjena);
    }

    [Fact]
    public async Task GetMis_TodasSinPermisoVerTodos_Retorna403()
    {
        using var ctx = new TestContext();
        ctx.SembrarSolicitud(6210, "MIA -> MTY", estado: "enviada");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "6211");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes/mis?todas=true");

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

[Fact]
    public async Task GetPorAutorizar_DevuelveSoloEnviadasActivasDeTodosUsuarios()
    {
        using var ctx = new TestContext();
        const int solicitante = 6300;
        const int otro = 6301;

        var enviadaPropia = ctx.SembrarSolicitud(solicitante, "MIA -> MTY", estado: "enviada");
        var enviadaAjena = ctx.SembrarSolicitud(otro, "OTRO -> CUN", estado: "enviada");
        ctx.SembrarSolicitud(otro, "OTRO -> GDL");                                  
        ctx.SembrarSolicitud(otro, "OTRO -> SJD", estado: "autorizada");
        ctx.SembrarSolicitud(otro, "OTRO -> PBC", estado: "enviada", activo: false);

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "6310");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes/por-autorizar");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<List<SolicitudDtoJson>>>();
        envelope!.Success.Should().BeTrue();
        var ids = envelope.Data!.Select(x => x.IdSolicitud).ToList();
        ids.Should().BeEquivalentTo(new[] { enviadaPropia, enviadaAjena });
        envelope.Data.Should().OnlyContain(x => x.Estado == "enviada");
    }

    [Fact]
    public async Task GetPorAutorizar_SinPermisoAutorizar_Retorna403()
    {
        using var ctx = new TestContext();
        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "6320");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.VerTodos);

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes/por-autorizar");

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetPorAutorizar_SinToken_Retorna401()
    {
        using var ctx = new TestContext();
        using var cliente = ctx.Servidor.CreateClient();

        var resp = await cliente.GetAsync("/api/viaticos/solicitudes/por-autorizar");

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

[Fact]
    public async Task GetDetalle_DeSolicitudAjenaSinVerTodos_Retorna403()
    {
        using var ctx = new TestContext();
        const int duenoId = 100;
        const int solicitanteId = 200;
        var idSolicitud = ctx.SembrarSolicitud(duenoId, "CDMX -> MTY");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", solicitanteId.ToString());
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

    [Fact]
    public async Task PutOpciones_ConTotal_LoPersisteEnDatosJson()
    {
        using var ctx = new TestContext();
        const int userId = 7100;
        var idSolicitud = ctx.SembrarSolicitud(userId, "MIA -> MTY");

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", userId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PutAsJsonAsync($"/api/viaticos/solicitudes/{idSolicitud}/opciones", new
        {
            cotizacion = new
            {
                total = 1234.56m,
                opciones = new[]
                {
                    new
                    {
                        tipo = "vuelo",
                        linea = "Aeromexico",
                        precio = 1234.56m,
                        moneda = "MXN",
                        url_compra = "https://ejemplo.test/vuelo",
                        fuente = "GoogleFlights",
                        fue_elegida = true,
                        ruta_captura = (string?)null,
                    }
                }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        using var scope = ctx.Servidor.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var guardada = await db.Solicitudes.AsNoTracking().SingleAsync(s => s.IdSolicitud == idSolicitud);
        using var datos = JsonDocument.Parse(guardada.DatosJson);
        datos.RootElement.GetProperty("total").GetDecimal().Should().Be(1234.56m);
        datos.RootElement.GetProperty("linea").GetString().Should().Be("MIA -> MTY");
    }

[Fact]
    public async Task PutOpciones_OpcionSinUrlCompra_SeGuardaConUrlNull()
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
                    }
                }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await resp.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDtoJson>>();
        envelope!.Data!.Opciones.Should().ContainSingle();
        envelope.Data.Opciones[0].UrlCompra.Should().BeNull();
        envelope.Data.Opciones[0].Precio.Should().Be(1500m);
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
                        fuente = "Booking", 
                        url_compra = "https://www.booking.com/hotel/majestic",
                        precio = (decimal?)null, 
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

[Fact]
    public async Task PutOpciones_PasaLaSolicitudDeBorradorAEnviadaYElDetalleLoDevuelve()
    {
        using var ctx = new TestContext();
        const int userId = 950;
        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", userId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var creada = await cliente.PostAsJsonAsync("/api/viaticos/solicitudes", new
        {
            gerencia = "Operaciones",
            datos = new { ruta = "MTY -> BJX" }
        });
        creada.StatusCode.Should().Be(HttpStatusCode.Created);
        var envelopeCreada = await creada.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDtoJson>>();
        envelopeCreada!.Data!.Estado.Should().Be("borrador");
        var idSolicitud = envelopeCreada.Data.IdSolicitud;

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

        var detalle = await cliente.GetAsync($"/api/viaticos/solicitudes/{idSolicitud}");
        detalle.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelopeDetalle = await detalle.Content.ReadFromJsonAsync<ApiEnvelope<SolicitudDtoJson>>();
        envelopeDetalle!.Data!.IdSolicitud.Should().Be(idSolicitud);
        envelopeDetalle.Data.Estado.Should().Be(
            "enviada",
            "guardar la cotizacion debe dejar la solicitud autorizable; si se queda en 'borrador' AprobacionesController devuelve 409");

        using (var scope = ctx.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var enBd = await db.Solicitudes.AsNoTracking()
                .SingleAsync(x => x.IdSolicitud == idSolicitud);
            enBd.Estado.Should().Be("enviada");
        }

        envelopeDetalle.Data.Opciones.Should().HaveCount(1);
        envelopeDetalle.Data.Opciones[0].FueElegida.Should().BeTrue();
    }

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

    [Theory]
    [InlineData("autorizada")]
    [InlineData("rechazada")]
    public async Task PutOpciones_SolicitudYaResueltaNoRetrocedeANiRegistraEventoEnviada(string estadoTerminal)
    {
        using var ctx = new TestContext();
        const int duenoId = 970;
        var idSolicitud = ctx.SembrarSolicitud(duenoId, "MTY -> CUN terminal", estado: estadoTerminal);
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

        db.SolicitudEventos.AsNoTracking()
            .Any(e => e.IdSolicitud == idSolicitud && e.Tipo == "cotizacion_guardada")
            .Should().BeTrue("guardar opciones sigue registrando su propia bitacora");
    }

private sealed class TestContext : IDisposable
    {
        private readonly string _dbName = $"SolicitudesCtrl-{Guid.NewGuid():N}";
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
                    services.AddDbContext<AsokamDbContext>(o => o.UseInMemoryDatabase($"{_dbName}-asokam"));
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

        public void SembrarRutaConVisitas(
            int idRuta,
            int[] idRutaVisitas,
            int idEspecialista = 20,
            string estado = Ruta.EstadoCreada)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var ahora = DateTime.UtcNow;
            db.Rutas.Add(new Ruta
            {
                IdRuta = idRuta,
                IdSeleccionMensual = 3,
                IdEspecialista = idEspecialista,
                Version = 1,
                Nombre = $"Ruta prueba {idRuta}",
                Estado = estado,
                FechaCreacion = ahora,
                FechaModificacion = ahora,
            });
            for (var i = 0; i < idRutaVisitas.Length; i++)
            {
                db.RutasVisitas.Add(new RutaVisita
                {
                    IdRutaVisita = idRutaVisitas[i],
                    IdRuta = idRuta,
                    IdEspecialista = idEspecialista,
                    FechaVisita = new DateOnly(2026, 10, 21),
                    Orden = i + 1,
                    FechaCreacion = ahora,
                    FechaModificacion = ahora,
                });
            }
            db.SaveChanges();
        }

        public int SembrarCotizacionEducacionMedica(
            int duenoId,
            int idRuta,
            int[] idRutaVisitas,
            string estado = "borrador",
            decimal? total = null,
            string? folio = null)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var ahora = DateTime.UtcNow;
            var s = new Solicitud
            {
                IdUsuarioSolicitante = duenoId,
                IdUsuarioCreacion = duenoId,
                Periodo = ahora.ToString("yyyy-MM"),
                Gerencia = "EM",
                Estado = estado,
                SistemaOrigen = "educacion_medica",
                NumPuntos = idRutaVisitas.Length,
                Folio = folio,
                DatosJson = total.HasValue ? JsonSerializer.Serialize(new { total = total.Value }) : "{}",
                Activo = true,
                FechaCreacion = ahora,
                FechaModificacion = ahora,
            };
            db.Solicitudes.Add(s);
            db.SaveChanges();

            foreach (var idVisita in idRutaVisitas)
            {
                db.SolicitudOrigenEmVisitas.Add(new SolicitudOrigenEmVisita
                {
                    IdSolicitud = s.IdSolicitud,
                    IdRuta = idRuta,
                    IdRutaVisita = idVisita,
                    FechaCreacion = ahora,
                });
            }
            db.SaveChanges();
            return s.IdSolicitud;
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

    private sealed class SolicitudDesdeEmDtoJson
    {
        [JsonPropertyName("id_solicitud")]
        public int IdSolicitud { get; set; }

        [JsonPropertyName("folio")]
        public string? Folio { get; set; }

        [JsonPropertyName("reutilizado")]
        public bool Reutilizado { get; set; }
    }

    private sealed class SolicitudPorRutaDtoJson
    {
        [JsonPropertyName("id_solicitud")]
        public int IdSolicitud { get; set; }

        [JsonPropertyName("folio")]
        public string? Folio { get; set; }

        [JsonPropertyName("estado")]
        public string Estado { get; set; } = string.Empty;

        [JsonPropertyName("num_puntos")]
        public int NumPuntos { get; set; }

        [JsonPropertyName("total")]
        public decimal? Total { get; set; }

        [JsonPropertyName("fecha_creacion")]
        public DateTime FechaCreacion { get; set; }

        [JsonPropertyName("id_ruta_visitas")]
        public List<int> IdRutaVisitas { get; set; } = new();
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
