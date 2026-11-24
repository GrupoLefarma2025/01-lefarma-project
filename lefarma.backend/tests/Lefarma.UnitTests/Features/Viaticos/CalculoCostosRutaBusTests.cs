using FluentAssertions;
using Lefarma.API.Features.Viaticos;

namespace Lefarma.UnitTests.Features.Viaticos;

public class CalculoCostosRutaBusTests
{
    [Fact]
    public void Selecciona_la_mejor_la_cercana_la_barata_y_una_anterior()
    {
        // Salida 10:21 y límite 15:21. Con el margen de 30 min, la primera
        // corrida tomable es 10:51; la mejor es la última que llega a tiempo.
        var salidaPrevia = new DateTime(2026, 12, 1, 10, 21, 0);
        var deadline = new DateTime(2026, 12, 1, 15, 21, 0);

        static ViajeBus Viaje(int hora, int minuto, double precio) => new(
            "ADO Primera",
            new DateTime(2026, 12, 1, hora, minuto, 0),
            new DateTime(2026, 12, 1, hora + 2, minuto, 0),
            precio,
            precio,
            40,
            "test",
            "",
            "test");

        var viajes = new List<ViajeBus>
        {
            Viaje(2, 0, 480),
            Viaje(6, 0, 302),
            Viaje(9, 0, 302),
            Viaje(10, 30, 314),
            Viaje(11, 0, 302),
            Viaje(12, 0, 266),
            Viaje(13, 0, 302),
            Viaje(14, 0, 362),
            Viaje(15, 0, 480),
            Viaje(16, 0, 302),
        };

        var seleccion = CalculoCostosRuta.SeleccionarCorridasBus(
            viajes, salidaPrevia, deadline, v => v.Llegada);

        // La mejor (13:00) encabeza; luego la más cercana a la salida (11:00),
        // una anterior a la ventana (10:30), la más barata (12:00) y vecinas.
        seleccion.Select(v => v.Salida.ToString("HH:mm")).Should().Equal(
            "13:00", "11:00", "10:30", "12:00", "14:00", "09:00");
    }
}
