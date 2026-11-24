using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Lefarma.API.Domain.Entities.Viaticos;
using Lefarma.API.Features.Viaticos;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
#pragma warning disable ASPDEPR004
#pragma warning disable ASPDEPR008
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// Endpoint de detección automática (vuelo, autobús u hotel): aplica el
/// precio elegido con su captura y recalcula totales; si no hay opción
/// aplicable, responde aplicado=false sin tocar la cotización.
/// </summary>
public class DeteccionVuelosControllerTests
{
    [Fact]
    public async Task DetectarPrecio_ConVueloATiempo_AplicaPrecioCapturaYEvento()
    {
        using var ctx = new TestContext();
        const int userId = 9100;
        var idSolicitud = ctx.SembrarSolicitud(
            userId,
            """
            {"destinos":[{"punto":{"nombre":"La Huerta, Jalisco"},"debeEstarFecha":"2026-11-20","debeEstarHora":"16:14"}]}
            """);
        var idOpcion = ctx.SembrarVueloEstimado(idSolicitud, minutosTaxi: 36);

        ctx.Deteccion.Resultado = new DeteccionPrecioResult
        {
            Ok = true,
            Fuente = "playwright",
            RutaCaptura = "capturas-viaticos/viaje31-op108-auto.png",
            Elegido = new PrecioDetectado(
                "vuelo", "Aeromexico 08:00–09:34", 4974m, "MXN",
                "kayak.com.mx", "https://www.kayak.com.mx/book/flight?code=abc",
                "Directo · 94 min", new DateOnly(2026, 11, 20),
                new TimeOnly(8, 0), new TimeOnly(9, 34), 0, 94),
            Opciones = new List<PrecioDetectado>
            {
                new("vuelo", "Aeromexico 08:00–09:34", 4974m, "MXN",
                    "kayak.com.mx", "https://www.kayak.com.mx/book/flight?code=abc",
                    "Directo · 94 min", new DateOnly(2026, 11, 20),
                    new TimeOnly(8, 0), new TimeOnly(9, 34), 0, 94),
            },
        };

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", userId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PostAsJsonAsync(
            $"/api/viaticos/solicitudes/{idSolicitud}/opciones/{idOpcion}/detectar-precio",
            new { });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        using var body = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        body.RootElement.GetProperty("success").GetBoolean().Should().BeTrue();
        var data = body.RootElement.GetProperty("data");
        data.GetProperty("aplicado").GetBoolean().Should().BeTrue();
        data.GetProperty("elegido").GetProperty("precio").GetDecimal().Should().Be(4974m);
        data.GetProperty("elegido").GetProperty("linea").GetString().Should().Be("Aeromexico 08:00–09:34");
        data.GetProperty("fuente").GetString().Should().Be("playwright");

        ctx.Deteccion.Fecha.Should().Be(new DateOnly(2026, 11, 20));
        ctx.Deteccion.Deadline.Should().Be(new DateTime(2026, 11, 20, 16, 14, 0));
        ctx.Deteccion.MinutosTaxi.Should().Be(36);

        using var scope = ctx.Servidor.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var opcion = await db.SolicitudOpciones.AsNoTracking().SingleAsync(o => o.IdOpcion == idOpcion);
        opcion.Precio.Should().Be(4974m);
        opcion.Linea.Should().Be("Aeromexico 08:00–09:34");
        opcion.Fuente.Should().Be("kayak.com.mx");
        opcion.RutaCaptura.Should().Be("capturas-viaticos/viaje31-op108-auto.png");
        opcion.DatosJson.Should().Contain("\"tipo_precio\":\"cotizado\"");
        opcion.DatosJson.Should().Contain("\"deteccion_estado\":\"aplicado\"");

        var solicitud = await db.Solicitudes.AsNoTracking().SingleAsync(s => s.IdSolicitud == idSolicitud);
        using var datos = JsonDocument.Parse(solicitud.DatosJson);
        datos.RootElement.GetProperty("total_cotizado").GetDecimal().Should().Be(4974m);
        datos.RootElement.GetProperty("total").GetDecimal().Should().Be(4974m);

        db.SolicitudEventos.AsNoTracking()
            .Any(e => e.IdSolicitud == idSolicitud && e.Tipo == "precio_real_detectado")
            .Should().BeTrue();
    }

    [Fact]
    public async Task DetectarPrecio_SinVueloATiempo_RespondeAplicadoFalseYNoTocaLaOpcion()
    {
        using var ctx = new TestContext();
        const int userId = 9101;
        var idSolicitud = ctx.SembrarSolicitud(
            userId,
            """
            {"destinos":[{"punto":{"nombre":"La Huerta, Jalisco"},"debeEstarFecha":"2026-11-20","debeEstarHora":"16:14"}]}
            """);
        var idOpcion = ctx.SembrarVueloEstimado(idSolicitud, minutosTaxi: 36);

        ctx.Deteccion.Resultado = new DeteccionPrecioResult
        {
            Ok = false,
            Error = "Ningún vuelo detectado llega antes de 20/11 16:14.",
            Fuente = "playwright",
            Opciones = new List<PrecioDetectado>
            {
                new("vuelo", "Aeromexico 16:30–18:04", 5664m, "MXN",
                    "kayak.com.mx", null, "Directo · 94 min", new DateOnly(2026, 11, 20),
                    new TimeOnly(16, 30), new TimeOnly(18, 4), 0, 94),
            },
        };

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", userId.ToString());
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PostAsJsonAsync(
            $"/api/viaticos/solicitudes/{idSolicitud}/opciones/{idOpcion}/detectar-precio",
            new { });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        using var body = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        var data = body.RootElement.GetProperty("data");
        data.GetProperty("aplicado").GetBoolean().Should().BeFalse();
        data.GetProperty("motivo").GetString().Should().Contain("Ningún vuelo");

        using var scope = ctx.Servidor.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var opcion = await db.SolicitudOpciones.AsNoTracking().SingleAsync(o => o.IdOpcion == idOpcion);
        opcion.Precio.Should().BeNull();
        opcion.RutaCaptura.Should().BeNull();
        db.SolicitudEventos.AsNoTracking()
            .Any(e => e.IdSolicitud == idSolicitud && e.Tipo == "precio_real_detectado")
            .Should().BeFalse();
    }

    [Fact]
    public async Task DetectarPrecioPreview_EligeLaOpcionSeleccionadaSinPersistir()
    {
        using var ctx = new TestContext();
        ctx.Deteccion.Resultado = new DeteccionPrecioResult
        {
            Ok = true,
            Fuente = "playwright",
            RutaCaptura = "capturas-viaticos/preview.png",
            Elegido = Vuelo("Volaris 06:00–07:30", 4000m, new TimeOnly(6, 0), new TimeOnly(7, 30)),
            Opciones =
            [
                Vuelo("Volaris 06:00–07:30", 4000m, new TimeOnly(6, 0), new TimeOnly(7, 30)),
                Vuelo("Aeromexico 08:00–09:34", 5200m, new TimeOnly(8, 0), new TimeOnly(9, 34)),
            ],
        };

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "9300");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PostAsJsonAsync("/api/viaticos/opciones/detectar-precio", new
        {
            tipo = "vuelo",
            linea = "Aeromexico",
            salida = "08:00",
            llegada = "09:34",
            url_compra = "https://www.kayak.com.mx/flights/MEX-ZLO/2026-11-20",
            datos = new { tramo = 0, minutos_taxi_destino = 36 },
            solicitud_datos = new
            {
                destinos = new[]
                {
                    new { debeEstarFecha = "2026-11-20", debeEstarHora = "16:14" },
                },
            },
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        using var body = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        var data = body.RootElement.GetProperty("data");
        data.GetProperty("detectado").GetBoolean().Should().BeTrue();
        data.GetProperty("elegido").GetProperty("linea").GetString().Should().Be("Aeromexico 08:00–09:34");
        data.GetProperty("elegido").GetProperty("precio").GetDecimal().Should().Be(5200m);
        data.GetProperty("ruta_captura").GetString().Should().Be("capturas-viaticos/preview.png");

        ctx.Deteccion.Fecha.Should().Be(new DateOnly(2026, 11, 20));
        ctx.Deteccion.Deadline.Should().Be(new DateTime(2026, 11, 20, 16, 14, 0));

        using var scope = ctx.Servidor.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.Solicitudes.AnyAsync()).Should().BeFalse("la vista previa no persiste la solicitud");
    }

    [Fact]
    public async Task DetectarPrecioPreview_SiLaOpcionNoAparece_NoDevuelveOtroVuelo()
    {
        using var ctx = new TestContext();
        ctx.Deteccion.Resultado = new DeteccionPrecioResult
        {
            Ok = true,
            Fuente = "playwright",
            RutaCaptura = "capturas-viaticos/preview.png",
            Elegido = Vuelo("Volaris 16:30–18:04", 4600m, new TimeOnly(16, 30), new TimeOnly(18, 4)),
            Opciones = [Vuelo("Volaris 16:30–18:04", 4600m, new TimeOnly(16, 30), new TimeOnly(18, 4))],
        };

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "9301");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PostAsJsonAsync("/api/viaticos/opciones/detectar-precio", new
        {
            tipo = "vuelo",
            linea = "Aeromexico",
            salida = "08:00",
            llegada = "09:34",
            url_compra = "https://www.kayak.com.mx/flights/MEX-ZLO/2026-11-20",
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        using var body = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        var data = body.RootElement.GetProperty("data");
        data.GetProperty("detectado").GetBoolean().Should().BeFalse();
        data.GetProperty("motivo").GetString().Should().Contain("no aparece");
        data.TryGetProperty("elegido", out var elegido).Should().BeTrue();
        elegido.ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public async Task DetectarPrecioPreview_OpcionGenerica_UsaLaMejorOpcionDetectada()
    {
        using var ctx = new TestContext();
        ctx.Deteccion.Resultado = new DeteccionPrecioResult
        {
            Ok = true,
            Fuente = "playwright",
            RutaCaptura = "capturas-viaticos/preview.png",
            Elegido = Vuelo("Volaris 06:00–07:30", 4000m, new TimeOnly(6, 0), new TimeOnly(7, 30)),
            Opciones =
            [
                Vuelo("Volaris 06:00–07:30", 4000m, new TimeOnly(6, 0), new TimeOnly(7, 30)),
                Vuelo("Aeromexico 08:00–09:34", 5200m, new TimeOnly(8, 0), new TimeOnly(9, 34)),
            ],
        };

        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "9303");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PostAsJsonAsync("/api/viaticos/opciones/detectar-precio", new
        {
            tipo = "vuelo",
            linea = "Vuelo (estimado)",
            salida = "09:00",
            llegada = "13:30",
            url_compra = "https://www.kayak.com.mx/flights/MEX-ZLO/2026-11-20",
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        using var body = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        var data = body.RootElement.GetProperty("data");
        data.GetProperty("detectado").GetBoolean().Should().BeTrue();
        data.GetProperty("elegido").GetProperty("precio").GetDecimal().Should().Be(4000m);
    }

    [Fact]
    public async Task DetectarPrecioPreview_RechazaUrlInterna()
    {
        using var ctx = new TestContext();
        using var cliente = ctx.Servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "9302");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        var resp = await cliente.PostAsJsonAsync("/api/viaticos/opciones/detectar-precio", new
        {
            tipo = "vuelo",
            linea = "Aeromexico",
            url_compra = "http://192.168.6.4:3002/v2/scrape",
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        using var body = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        body.RootElement.GetProperty("message").GetString().Should().Contain("red interna");
    }

    private static PrecioDetectado Vuelo(
        string linea,
        decimal precio,
        TimeOnly salida,
        TimeOnly llegada) =>
        new(
            "vuelo", linea, precio, "MXN", "kayak.com.mx",
            "https://www.kayak.com.mx/book/flight?code=abc", "Directo · 94 min",
            new DateOnly(2026, 11, 20), salida, llegada, 0, 94);

    private sealed class DeteccionFake : IDeteccionPrecioService
    {
        public DeteccionPrecioResult Resultado { get; set; } = new()
        {
            Ok = false,
            Error = "sin configuración de prueba",
        };

        public DateOnly? Fecha { get; private set; }
        public DateTime? Deadline { get; private set; }
        public int MinutosTaxi { get; private set; }

        public Task<DeteccionPrecioResult> DetectarAsync(
            SolicitudOpcion opcion,
            DateOnly fecha,
            DateTime? deadline,
            int minutosTaxi,
            string nombre,
            CancellationToken ct,
            bool capturar = true)
        {
            Fecha = fecha;
            Deadline = deadline;
            MinutosTaxi = minutosTaxi;
            return Task.FromResult(Resultado);
        }
    }

    private sealed class TestContext : IDisposable
    {
        private readonly string _dbName = $"DeteccionVuelosCtrl-{Guid.NewGuid():N}";
        public TestServer Servidor { get; }
        public DeteccionFake Deteccion { get; } = new();

        public TestContext()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(_dbName)
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
                    services.AddSingleton<IDeteccionPrecioService>(Deteccion);
                    services.AddSingleton<DeteccionPrecioPreviewGate>();
                    services.AddAuthentication(PermisosEndpointTests.TestAuthHandler.NombreEsquema)
                        .AddScheme<AuthenticationSchemeOptions, PermisosEndpointTests.TestAuthHandler>(
                            PermisosEndpointTests.TestAuthHandler.NombreEsquema, _ => { });
                    services.AddAuthorization();
                    services.AddControllers()
                        .AddApplicationPart(typeof(DeteccionVuelosController).Assembly);
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

        public int SembrarSolicitud(int duenoId, string datosJson)
        {
            using var scope = Servidor.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var ahora = DateTime.UtcNow;
            var s = new Solicitud
            {
                IdUsuarioSolicitante = duenoId,
                Periodo = ahora.ToString("yyyy-MM"),
                Gerencia = "Operaciones",
                Estado = SolicitudesController.EstadoEnviada,
                DatosJson = datosJson,
                Activo = true,
                FechaCreacion = ahora,
                FechaModificacion = ahora,
            };
            db.Solicitudes.Add(s);
            db.SaveChanges();
            return s.IdSolicitud;
        }

        public int SembrarVueloEstimado(int idSolicitud, int minutosTaxi)
        {
            using var scope = Servidor.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var opcion = new SolicitudOpcion
            {
                IdSolicitud = idSolicitud,
                Tipo = "vuelo",
                Linea = "Vuelo (estimado)",
                DatosJson = JsonSerializer.Serialize(new
                {
                    tramo = 0,
                    tipo_precio = "estimado",
                    precio_estimado = 1546.14m,
                    minutos_taxi_destino = minutosTaxi,
                }),
                Precio = null,
                Moneda = "MXN",
                UrlCompra = "https://www.kayak.com.mx/flights/MEX-ZLO/2026-11-20?sort=bestflight_a&fs=cabin=e",
                Fuente = "estimado fase 1 (sin proveedor)",
                FueElegida = true,
            };
            db.SolicitudOpciones.Add(opcion);
            db.SaveChanges();
            return opcion.IdOpcion;
        }

        public void Dispose() => Servidor.Dispose();
    }
}
