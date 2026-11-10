using FluentAssertions;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Features.Rh.IncidenciasChecado;
using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.UnitTests.Features.Rh.IncidenciasChecado;

public class IncidenciaChecadoConfigServiceTests
{
    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static async Task<ApplicationDbContext> CreateContextConReglaAsync()
    {
        var context = CreateContext();
        context.IncidenciasChecadoConfig.Add(new IncidenciaChecadoConfig
        {
            IdConfig = 1,
            Nombre = "Retardo de entrada menor a 20 min",
            Descripcion = "Retardo de entrada menor a 20 min",
            TipoIncidencia = "TARDANZA_ENTRADA",
            MinutosMin = 1,
            MinutosMax = 20,
            CantidadAcumulada = 3,
            Periodo = "mes",
            Prioridad = 10,
            Activo = true,
            ExcluirDiasHabilesConsumenSaldo = true
        });
        await context.SaveChangesAsync();
        return context;
    }

    private static IncidenciaChecadoResponse Retardo(DateTime fecha, bool justificada = false) => new()
    {
        Fecha = fecha,
        Nomina = 999,
        Nombre = "EMPLEADO PRUEBA",
        Checa = "Si",
        Entrada = new TimeSpan(8, 0, 0),
        Salida = new TimeSpan(18, 30, 0),
        Entro = new TimeSpan(8, 10, 0),
        Salio = new TimeSpan(18, 30, 0),
        Justificada = justificada
    };

    [Fact]
    public async Task EnriquecerDescuentos_Marca_Cada_Tercer_Retardo_Del_Mes()
    {
        var context = await CreateContextConReglaAsync();
        var service = new IncidenciaChecadoConfigService(context);

        var items = Enumerable.Range(1, 7)
            .Select(d => Retardo(new DateTime(2026, 9, d)))
            .ToList();

        await service.EnriquecerDescuentosAsync(items);

        items.Where(i => i.Descuento).Select(i => i.Fecha.Day).Should().Equal(3, 6);

        foreach (var item in items)
        {
            item.IncidenciasCalculadas.Should().ContainSingle();
            item.IncidenciasCalculadas[0].TipoIncidencia.Should().Be("TARDANZA_ENTRADA");
            item.IncidenciasCalculadas[0].GeneraDescuentoTeorico.Should().Be(item.Fecha.Day is 3 or 6);
            item.IncidenciasCalculadas[0].PosicionAcumulacion.Should().Be(item.Fecha.Day);
            item.IncidenciasCalculadas[0].CantidadAcumulada.Should().Be(3);
            item.IncidenciasCalculadas[0].EtiquetaPeriodo.Should().Be("septiembre de 2026");
        }
    }

    [Fact]
    public async Task EnriquecerDescuentos_No_Cuenta_Dias_Justificados_Para_La_Acumulacion()
    {
        var context = await CreateContextConReglaAsync();
        var service = new IncidenciaChecadoConfigService(context);

        var items = Enumerable.Range(1, 7)
            .Select(d => Retardo(new DateTime(2026, 9, d), justificada: d <= 4))
            .ToList();

        await service.EnriquecerDescuentosAsync(items);

        // 4 justificados: los 3 restantes (5, 6 y 7) generan 1 descuento, en el 3.º (día 7)
        items.Where(i => i.Descuento).Select(i => i.Fecha.Day).Should().Equal(7);

        var dia3 = items.Single(i => i.Fecha.Day == 3);
        dia3.IncidenciasCalculadas.Should().ContainSingle();
        dia3.IncidenciasCalculadas[0].GeneraDescuento.Should().BeFalse();
        dia3.IncidenciasCalculadas[0].GeneraDescuentoTeorico.Should().BeTrue();
        dia3.IncidenciasCalculadas[0].PosicionAcumulacion.Should().BeNull();

        var dia5 = items.Single(i => i.Fecha.Day == 5);
        dia5.IncidenciasCalculadas[0].PosicionAcumulacion.Should().Be(1);

        var dia7 = items.Single(i => i.Fecha.Day == 7);
        dia7.IncidenciasCalculadas[0].PosicionAcumulacion.Should().Be(3);
        dia7.IncidenciasCalculadas[0].CantidadAcumulada.Should().Be(3);
        dia7.IncidenciasCalculadas[0].EtiquetaPeriodo.Should().Be("septiembre de 2026");

        items.Where(i => i.Fecha.Day is 3 or 6)
            .SelectMany(i => i.IncidenciasCalculadas)
            .Should().OnlyContain(c => c.GeneraDescuentoTeorico);

        items.Where(i => i.Fecha.Day is not 3 and not 6)
            .SelectMany(i => i.IncidenciasCalculadas)
            .Should().OnlyContain(c => !c.GeneraDescuentoTeorico);
    }

    [Fact]
    public async Task EnriquecerDescuentos_Dias_Justificados_Se_Muestran_Sin_Descuento()
    {
        var context = await CreateContextConReglaAsync();
        var service = new IncidenciaChecadoConfigService(context);

        var items = Enumerable.Range(1, 3)
            .Select(d => Retardo(new DateTime(2026, 9, d), justificada: true))
            .ToList();

        await service.EnriquecerDescuentosAsync(items);

        items.Should().OnlyContain(i => !i.Descuento);
        items.SelectMany(i => i.IncidenciasCalculadas).Should().NotBeEmpty();
        items.SelectMany(i => i.IncidenciasCalculadas).Should().OnlyContain(c => !c.GeneraDescuento);
    }

    private static async Task<ApplicationDbContext> CreateContextConReglaSalidaAnticipadaAsync()
    {
        var context = CreateContext();
        context.IncidenciasChecadoConfig.Add(new IncidenciaChecadoConfig
        {
            IdConfig = 5,
            Nombre = "Salida anticipada",
            Descripcion = "Una salida anticipada de 20 minutos o más en el mes genera descuento.",
            TipoIncidencia = "SALIDA_ANTICIPADA",
            MinutosMin = 20,
            MinutosMax = null,
            CantidadAcumulada = 1,
            Periodo = "mes",
            Prioridad = 50,
            Activo = true
        });
        await context.SaveChangesAsync();
        return context;
    }

    private static IncidenciaChecadoResponse SalidaAnticipada(DateTime fecha, TimeSpan salio) => new()
    {
        Fecha = fecha,
        Nomina = 1418286,
        Nombre = "ADRIANA ARREDONDO ORTIZ",
        Checa = "Si",
        Entrada = new TimeSpan(8, 0, 0),
        Salida = new TimeSpan(18, 30, 0),
        Entro = new TimeSpan(7, 55, 21),
        Salio = salio
    };

    [Fact]
    public async Task EnriquecerDescuentos_Cuenta_Salida_Anticipada_De_19m03s_Como_20_Minutos_De_Reloj()
    {
        var context = await CreateContextConReglaSalidaAnticipadaAsync();
        var service = new IncidenciaChecadoConfigService(context);
        var dia23 = SalidaAnticipada(new DateTime(2026, 10, 23), new TimeSpan(18, 10, 57));

        await service.EnriquecerDescuentosAsync(new List<IncidenciaChecadoResponse> { dia23 });

        // 18:10:57 contra horario 18:30:00 son 20 minutos de reloj (DATEDIFF MINUTE).
        // Antes el calendario truncaba la diferencia a 19 y no la mostraba.
        dia23.IncidenciasCalculadas.Should().ContainSingle()
            .Which.TipoIncidencia.Should().Be("SALIDA_ANTICIPADA");
        dia23.Descuento.Should().BeTrue();
    }

    [Fact]
    public async Task EnriquecerDescuentos_No_Cuenta_Salida_Anticipada_De_19_Minutos_Clavados()
    {
        var context = await CreateContextConReglaSalidaAnticipadaAsync();
        var service = new IncidenciaChecadoConfigService(context);
        var dia24 = SalidaAnticipada(new DateTime(2026, 10, 24), new TimeSpan(18, 11, 0));

        await service.EnriquecerDescuentosAsync(new List<IncidenciaChecadoResponse> { dia24 });

        dia24.IncidenciasCalculadas.Should().BeEmpty();
        dia24.Descuento.Should().BeFalse();
    }

    [Fact]
    public async Task EnriquecerDescuentos_Calendario_Y_Notificacion_Calculan_Igual()
    {
        var context = await CreateContextConReglaSalidaAnticipadaAsync();
        var service = new IncidenciaChecadoConfigService(context);

        var dias = new[]
        {
            (Fecha: new DateTime(2026, 10, 23), Salio: new TimeSpan(18, 10, 57)), // 20 min de reloj
            (Fecha: new DateTime(2026, 10, 24), Salio: new TimeSpan(18, 11, 0)),  // 19 min
            (Fecha: new DateTime(2026, 10, 27), Salio: new TimeSpan(18, 0, 0)),   // 30 min
        };

        var calendario = dias.Select(d => SalidaAnticipada(d.Fecha, d.Salio)).ToList();
        var notificacion = dias.Select(d => new NotificarIncidenciaItemRequest
        {
            Nomina = 1418286,
            Fecha = d.Fecha,
            Nombre = "ADRIANA ARREDONDO ORTIZ",
            Entrada = new TimeSpan(8, 0, 0).ToString(@"hh\:mm"),
            Salida = new TimeSpan(18, 30, 0).ToString(@"hh\:mm"),
            Entro = new TimeSpan(7, 55, 21).ToString(@"hh\:mm"),
            Salio = d.Salio.ToString(@"hh\:mm")
        }).ToList();

        await service.EnriquecerDescuentosAsync(calendario);
        await service.EnriquecerDescuentosAsync(notificacion);

        static string Resumen(DateTime fecha, IReadOnlyList<IncidenciaCalculadaDto> calculadas, bool descuento) =>
            $"{fecha:yyyy-MM-dd}|{string.Join(",", calculadas.Select(c => c.TipoIncidencia))}|{descuento}";

        calendario.Select(i => Resumen(i.Fecha, i.IncidenciasCalculadas, i.Descuento))
            .Should().Equal(notificacion.Select(i => Resumen(i.Fecha, i.IncidenciasCalculadas, i.Descuento)));
    }
}
