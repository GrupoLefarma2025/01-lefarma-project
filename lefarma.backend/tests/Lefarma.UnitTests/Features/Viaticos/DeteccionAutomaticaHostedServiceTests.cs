using System.Text.Json;
using FluentAssertions;
using Lefarma.API.Domain.Entities.Viaticos;
using Lefarma.API.Features.Viaticos;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// Worker de Fase 2: al encolar una opción sin precio real, la consulta, aplica
/// el precio elegido con su captura y deja el evento. Es el camino que corre
/// solo después de guardar la cotización, sin botón.
/// </summary>
public class DeteccionAutomaticaHostedServiceTests
{
    [Fact]
    public async Task Worker_ProcesaOpcionPendienteYAplicaPrecioConCaptura()
    {
        const int userId = 9200;
        var dbName = $"auto-{Guid.NewGuid():N}";
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(dbName));
        services.AddSingleton<IDeteccionPrecioService, DetectorFalso>();
        await using var provider = services.BuildServiceProvider();

        int idSolicitud;
        int idOpcion;
        await using (var seedScope = provider.CreateAsyncScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var ahora = DateTime.UtcNow;
            var solicitud = new Solicitud
            {
                IdUsuarioSolicitante = userId,
                Periodo = ahora.ToString("yyyy-MM"),
                Gerencia = "Operaciones",
                Estado = "enviada",
                DatosJson = """
                    {"destinos":[{"punto":{"nombre":"La Huerta, Jalisco"},"debeEstarFecha":"2026-11-20","debeEstarHora":"16:14"}]}
                    """,
                Activo = true,
                FechaCreacion = ahora,
                FechaModificacion = ahora,
                Opciones =
                [
                    new SolicitudOpcion
                    {
                        Tipo = "vuelo",
                        Linea = "Vuelo (estimado)",
                        Precio = null,
                        Moneda = "MXN",
                        UrlCompra = "https://www.kayak.com.mx/flights/MEX-ZLO/2026-11-20",
                        Fuente = "estimado fase 1 (sin proveedor)",
                        FueElegida = true,
                        DatosJson = """{"tramo":0,"tipo_precio":"estimado","precio_estimado":1546.14,"minutos_taxi_destino":36,"deteccion_estado":"pendiente"}""",
                    },
                ],
            };
            db.Solicitudes.Add(solicitud);
            await db.SaveChangesAsync();
            idSolicitud = solicitud.IdSolicitud;
            idOpcion = solicitud.Opciones[0].IdOpcion;
        }

        var queue = new DeteccionAutomaticaQueue();
        var worker = new DeteccionAutomaticaHostedService(
            queue,
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<DeteccionAutomaticaHostedService>.Instance);

        await worker.StartAsync(CancellationToken.None);
        try
        {
            await queue.EnqueueAsync(new DeteccionAutomaticaJob(idSolicitud, idOpcion, userId));

            SolicitudOpcion? opcion = null;
            var limite = DateTime.UtcNow.AddSeconds(5);
            while (DateTime.UtcNow < limite)
            {
                await using var scope = provider.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                opcion = await db.SolicitudOpciones.AsNoTracking()
                    .SingleAsync(o => o.IdOpcion == idOpcion);
                if (opcion.Precio is not null) break;
                await Task.Delay(50);
            }

            opcion.Should().NotBeNull();
            opcion!.Precio.Should().Be(4999m);
            opcion.Linea.Should().Be("Aeromexico 08:00–09:34");
            opcion.Fuente.Should().Be("kayak.com.mx");
            opcion.RutaCaptura.Should().Be("capturas-viaticos/auto-test.png");
            opcion.DatosJson.Should().Contain("\"tipo_precio\":\"cotizado\"");
            opcion.DatosJson.Should().Contain("\"deteccion_estado\":\"aplicado\"");

            await using var verifyScope = provider.CreateAsyncScope();
            var verify = verifyScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var solicitud = await verify.Solicitudes.AsNoTracking().SingleAsync(s => s.IdSolicitud == idSolicitud);
            using var datos = JsonDocument.Parse(solicitud.DatosJson);
            datos.RootElement.GetProperty("total_cotizado").GetDecimal().Should().Be(4999m);
            (await verify.SolicitudEventos.AsNoTracking()
                    .AnyAsync(e => e.IdSolicitud == idSolicitud && e.Tipo == "precio_real_detectado"))
                .Should().BeTrue();
        }
        finally
        {
            await worker.StopAsync(CancellationToken.None);
        }
    }

    private sealed class DetectorFalso : IDeteccionPrecioService
    {
        public Task<DeteccionPrecioResult> DetectarAsync(
            SolicitudOpcion opcion,
            DateOnly fecha,
            DateTime? deadline,
            int minutosTaxi,
            string nombre,
            CancellationToken ct,
            bool capturar = true)
        {
            var elegido = new PrecioDetectado(
                "vuelo", "Aeromexico 08:00–09:34", 4999m, "MXN",
                "kayak.com.mx", "https://www.kayak.com.mx/book/flight?code=abc",
                "Directo · 94 min", new DateOnly(2026, 11, 20),
                new TimeOnly(8, 0), new TimeOnly(9, 34), 0, 94);

            return Task.FromResult(new DeteccionPrecioResult
            {
                Ok = true,
                Fuente = "playwright",
                RutaCaptura = "capturas-viaticos/auto-test.png",
                Elegido = elegido,
                Opciones = [elegido],
            });
        }
    }
}
