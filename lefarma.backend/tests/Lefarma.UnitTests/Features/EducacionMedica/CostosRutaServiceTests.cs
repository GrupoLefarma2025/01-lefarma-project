using FluentAssertions;
using Lefarma.API.Features.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class CostosRutaServiceTests
{
    private sealed class OsrmStub : IOsrmClient
    {
        public Task<RutaCarretera?> ObtenerRutaAsync(double latO, double lonO, double latD, double lonD, CancellationToken ct)
        {
            var km = CostosRutaGeo.HaversineKm(latO, lonO, latD, lonD) * 1.25;
            return Task.FromResult<RutaCarretera?>(new RutaCarretera(km, km / 70.0, "stub test"));
        }
    }

    private sealed class GasolinaStub : IGasolinaClient
    {
        public Task<PreciosGasolina> ObtenerPreciosAsync(CancellationToken ct)
            => Task.FromResult(new PreciosGasolina(23.5, 25.5, "seed test"));
    }

    private sealed class HotelesStub : IHotelesClient
    {
        public Task<List<HotelCercano>> BuscarCercanosAsync(double lat, double lon, CancellationToken ct)
            => Task.FromResult(new List<HotelCercano>());
    }

    private sealed class ClickBusStub : IClickBusClient
    {
        public Task<List<ViajeBus>> BuscarAsync(string origen, string destino, DateOnly fecha, double km, CancellationToken ct)
            => Task.FromResult(CostosRutaSeeds.ViajesBusSeed(fecha, km, "seed test bus"));
    }

    private sealed class DistribusionStub : IDistribusionClient
    {
        public Task<List<ViajeBus>> BuscarAsync(string origen, string destino, DateOnly fecha, double km, CancellationToken ct)
            => Task.FromResult(new List<ViajeBus>());
    }

    private sealed class VuelosStub : IVuelosClient
    {
        private readonly EstimadoVuelosClient _inner = new();
        public Task<List<ViajeVuelo>> BuscarAsync(double kmAerea, string origen, string destino, DateOnly fecha, CancellationToken ct)
            => _inner.BuscarAsync(kmAerea, origen, destino, fecha, ct);
    }

    private static CostosRutaService CrearServicio() => new(
        new OsrmStub(), new GasolinaStub(), new HotelesStub(),
        new ClickBusStub(), new DistribusionStub(), new VuelosStub());

    private static CostosRutaPersonaInput Ana() => new()
    {
        Nombre = "Ana",
        CarroPropio = true,
        Gasolina = "magna",
        Draft = false,
        Trabajo = new CostosRutaTrabajoInput
        {
            HoraEntrada = "08:00", HoraSalida = "18:30", PrimerDiaLaboral = 1, UltimoDiaLaboral = 5,
        },
        Lugares =
        [
            new CostosRutaLugarInput
            {
                Orden = 1, Tipo = "salida", Nombre = "CDMX base",
                Latitud = 19.4326, Longitud = -99.1332,
                FechaSalida = "2026-10-15", HoraSalida = "06:00",
            },
            new CostosRutaLugarInput
            {
                Orden = 2, Tipo = "taller", Nombre = "Taller Puebla 1",
                Latitud = 19.0414, Longitud = -98.2063,
                FechaInicioActividad = "2026-10-15", HoraInicioActividad = "10:00",
                FechaFinActividad = "2026-10-15", HoraFinActividad = "14:00",
            },
            new CostosRutaLugarInput
            {
                Orden = 3, Tipo = "taller", Nombre = "Taller Puebla 2",
                Latitud = 19.0520, Longitud = -98.2100,
                FechaInicioActividad = "2026-10-16", HoraInicioActividad = "09:00",
                FechaFinActividad = "2026-10-16", HoraFinActividad = "12:00",
            },
        ],
    };

    [Fact]
    public async Task Ana_Cdmx_Puebla_200_Y_Totales_Coherentes()
    {
        var svc = CrearServicio();
        var resp = await svc.CalcularAsync(new CostosRutaRequest
        {
            Opciones = new CostosRutaOpcionesInput(),
            Personas = [Ana()],
        });

        resp.Resultados.Should().HaveCount(1);
        var r = resp.Resultados[0];
        r.Tramos.Should().HaveCount(2);
        resp.Propuestas.Should().HaveCount(6);
        resp.Propuestas.Select(p => p.Clave).Should().BeEquivalentTo(
            ["barata", "rapida", "equilibrada", "tipo1-carro", "tipo2-bus", "tipo3-avion"]);
        resp.Categorias.Should().HaveCount(9);

        // Totales coherentes: subtotal = litros * precio + casetas (magna 23.5 seed).
        foreach (var t in r.RutaArmada.Tramos)
        {
            t.Litros.Should().BeApproximately(t.Km / 12.0, 0.01);
            t.Gasolina.Magna.PrecioL.Should().Be(23.5);
            t.SubtotalMagna.Should().BeApproximately(t.Litros * 23.5 + t.Casetas.Costo, 0.6);
            t.SubtotalPremium.Should().BeApproximately(t.Litros * 25.5 + t.Casetas.Costo, 0.6);
        }
        r.RutaArmada.Totales.SubtotalMagna.Should().BeApproximately(
            r.RutaArmada.Tramos.Sum(t => t.SubtotalMagna), 0.01);
        r.RutaArmada.Totales.SubtotalPremium.Should().BeApproximately(
            r.RutaArmada.Tramos.Sum(t => t.SubtotalPremium), 0.01);
    }

    [Fact]
    public async Task Personas_Vacias_Lanza_400()
    {
        var svc = CrearServicio();
        var controller = new CostosRutaController(svc);
        var result = await controller.Calcular(new CostosRutaRequest
        {
            Opciones = new CostosRutaOpcionesInput(),
            Personas = [],
        });
        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Xalapa_Puebla_Leon_Documenta_Seeds()
    {
        // Expected con seeds (stub OSRM = hav*1.25, gasolina 23.5/25.5, caseta ~1.4/km):
        // XAL→PUE ~230 km carretera, PUE→BJX ~480 km (aérea >300 → incluye avión).
        var svc = CrearServicio();
        CostosRutaPersonaInput Persona() => new()
        {
            Nombre = "Beto",
            CarroPropio = false,
            Gasolina = "magna",
            Draft = false,
            Lugares =
            [
                new CostosRutaLugarInput
                {
                    Orden = 1, Tipo = "salida", Nombre = "Xalapa base",
                    Latitud = 19.5438, Longitud = -96.9102,
                    FechaSalida = "2026-10-20", HoraSalida = "05:00",
                },
                new CostosRutaLugarInput
                {
                    Orden = 2, Tipo = "taller", Nombre = "Taller Puebla",
                    Latitud = 19.0414, Longitud = -98.2063,
                    FechaInicioActividad = "2026-10-20", HoraInicioActividad = "12:00",
                    FechaFinActividad = "2026-10-20", HoraFinActividad = "16:00",
                },
                new CostosRutaLugarInput
                {
                    Orden = 3, Tipo = "taller", Nombre = "Taller León",
                    Latitud = 21.1214, Longitud = -101.6830,
                    FechaInicioActividad = "2026-10-21", HoraInicioActividad = "10:00",
                    FechaFinActividad = "2026-10-21", HoraFinActividad = "13:00",
                },
            ],
        };
        var resp = await svc.CalcularAsync(new CostosRutaRequest { Personas = [Persona()] });

        resp.Resultados.Should().HaveCount(1);
        resp.Resultados[0].Tramos.Should().HaveCount(2);
        // Sin carro propio: tramo sin auto propio, pero sí renta/bus.
        resp.Resultados[0].Tramos[0].Opciones.Should().NotContain(o => o.Modo == "auto");
        resp.Resultados[0].Tramos[0].Opciones.Should().Contain(o => o.Modo == "bus");
        // PUE→BJX supera 300 km aéreos: hay avión estimado.
        resp.Resultados[0].Tramos[1].Opciones.Should().Contain(o => o.Modo == "avion" && o.Estimado);
        resp.Propuestas.Should().HaveCount(6);
        var tipo3 = resp.Propuestas.First(p => p.Clave == "tipo3-avion");
        tipo3.Tramos.Should().Contain(t => t.Modo == "avion");
    }
}
