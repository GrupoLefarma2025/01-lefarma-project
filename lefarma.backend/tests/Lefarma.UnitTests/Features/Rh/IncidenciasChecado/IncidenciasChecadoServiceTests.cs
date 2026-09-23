using FluentAssertions;
using Lefarma.API.Domain.Entities.Asistencias;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Rh.IncidenciasChecado;
using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;
using Lefarma.API.Features.Rh.SolicitudesPersonal.Settings;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Logging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Moq;

namespace Lefarma.UnitTests.Features.Rh.IncidenciasChecado;

public class IncidenciasChecadoServiceTests
{
    private const long Nomina = 1313127;
    private const int IdUsuario = 133;

    private static ApplicationDbContext CreateLefarmaContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static AsistenciasDbContext CreateAsistenciasContext()
    {
        var options = new DbContextOptionsBuilder<AsistenciasDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new TestAsistenciasDbContext(options);
    }

    private class TestAsistenciasDbContext : AsistenciasDbContext
    {
        public TestAsistenciasDbContext(DbContextOptions<AsistenciasDbContext> options)
            : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<Lefarma.API.Domain.Entities.Asistencias.IncidenciasChecado>()
                .HasKey(e => new { e.Fecha, e.Nomina });
        }
    }

    private static IEmpleadoRepository MockEmpleado()
    {
        var empleado = new Mock<IEmpleadoRepository>();
        empleado
            .Setup(r => r.ResolverIdsUsuarioPorNominasAsync(It.IsAny<IEnumerable<long>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<long, int> { [Nomina] = IdUsuario });
        return empleado.Object;
    }

    private static IncidenciasChecadoService CreateService(
        AsistenciasDbContext asistencias,
        ApplicationDbContext lefarma)
    {
        var repository = new Mock<IIncidenciasChecadoRepository>();
        repository
            .Setup(r => r.GetQueryable())
            .Returns(asistencias.IncidenciasChecados.AsQueryable());

        var descuentos = new Mock<IIncidenciaChecadoConfigService>();
        descuentos
            .Setup(s => s.EnriquecerDescuentosAsync(
                It.IsAny<List<IncidenciaChecadoResponse>>(),
                It.IsAny<CancellationToken>()))
            .Callback<List<IncidenciaChecadoResponse>, CancellationToken>((items, _) =>
            {
                foreach (var item in items)
                {
                    item.IncidenciasCalculadas.Add(new IncidenciaCalculadaDto
                    {
                        TipoIncidencia = "TARDANZA_ENTRADA",
                        Nombre = "Retardo de entrada",
                        GeneraDescuento = false
                    });
                }
            })
            .Returns(Task.CompletedTask);

        return new IncidenciasChecadoService(
            repository.Object,
            MockEmpleado(),
            descuentos.Object,
            lefarma,
            Options.Create(new SolicitudesPersonalSettings()),
            Mock.Of<IWideEventAccessor>());
    }

    private static void SeedIncidencia(AsistenciasDbContext context, DateTime fecha)
    {
        context.IncidenciasChecados.Add(new Lefarma.API.Domain.Entities.Asistencias.IncidenciasChecado
        {
            Fecha = fecha,
            Nomina = Nomina,
            Nombre = "EMPLEADO PRUEBA",
            Checa = "Si",
            Entrada = new TimeSpan(8, 0, 0),
            Salida = new TimeSpan(18, 30, 0),
            Entro = new TimeSpan(8, 10, 0),
            Salio = new TimeSpan(18, 30, 0)
        });
    }

    private static void SeedSolicitud(
        ApplicationDbContext context,
        int idSolicitud,
        DateTime fechaInicio,
        DateTime? fechaFin,
        string estadoCodigo,
        params DateTime[] detalle)
    {
        if (!context.WorkflowEstados.Local.Any(e => e.Codigo == estadoCodigo))
        {
            context.WorkflowEstados.Add(new WorkflowEstados
            {
                IdEstado = 1,
                Codigo = estadoCodigo,
                Nombre = estadoCodigo,
                Activo = true
            });
        }

        if (!context.TiposSolicitud.Local.Any(t => t.IdTipoSolicitud == 3))
        {
            context.TiposSolicitud.Add(new TipoSolicitud
            {
                IdTipoSolicitud = 3,
                Nombre = "Retardo menor a 20 minutos",
                Descripcion = "Retardo menor a 20 minutos",
                Clave = "RETARDO_MENOR_20",
                Categoria = CategoriaSolicitud.Incidencia,
                Activo = true
            });
        }

        context.SolicitudesPersonal.Add(new SolicitudPersonal
        {
            IdSolicitud = idSolicitud,
            Folio = $"SOL-{idSolicitud}",
            IdEstado = 1,
            IdTipoSolicitud = 3,
            IdEmpresa = 1,
            IdSucursal = 1,
            IdUsuarioCreador = IdUsuario,
            IdUsuarioSolicitante = IdUsuario,
            Motivo = "Motivo de prueba",
            FechaInicio = fechaInicio,
            FechaFin = fechaFin,
            FechaCreacion = DateTime.Now
        });

        foreach (var fecha in detalle)
        {
            context.SolicitudesPersonalDetalle.Add(new SolicitudPersonalDetalle
            {
                IdSolicitud = idSolicitud,
                Fecha = fecha,
                FechaCreacion = DateTime.Now
            });
        }

        context.SaveChanges();
    }

    private static void SeedSolicitudVacaciones(
        ApplicationDbContext context,
        int idSolicitud,
        DateTime fechaInicio,
        DateTime? fechaFin,
        string estadoCodigo,
        params DateTime[] detalle)
    {
        if (!context.WorkflowEstados.Local.Any(e => e.Codigo == estadoCodigo))
        {
            context.WorkflowEstados.Add(new WorkflowEstados
            {
                IdEstado = 1,
                Codigo = estadoCodigo,
                Nombre = estadoCodigo,
                Activo = true
            });
        }

        if (!context.TiposSolicitud.Local.Any(t => t.IdTipoSolicitud == 11))
        {
            context.TiposSolicitud.Add(new TipoSolicitud
            {
                IdTipoSolicitud = 11,
                Nombre = "Vacaciones",
                Descripcion = "Vacaciones",
                Clave = "VACACIONES",
                Categoria = CategoriaSolicitud.Vacaciones,
                Activo = true
            });
        }

        context.SolicitudesPersonal.Add(new SolicitudPersonal
        {
            IdSolicitud = idSolicitud,
            Folio = $"SOL-{idSolicitud}",
            IdEstado = 1,
            IdTipoSolicitud = 11,
            IdEmpresa = 1,
            IdSucursal = 1,
            IdUsuarioCreador = IdUsuario,
            IdUsuarioSolicitante = IdUsuario,
            Motivo = "Motivo de prueba",
            FechaInicio = fechaInicio,
            FechaFin = fechaFin,
            FechaCreacion = DateTime.Now
        });

        foreach (var fecha in detalle)
        {
            context.SolicitudesPersonalDetalle.Add(new SolicitudPersonalDetalle
            {
                IdSolicitud = idSolicitud,
                Fecha = fecha,
                FechaCreacion = DateTime.Now
            });
        }

        context.SaveChanges();
    }

    [Fact]
    public async Task GetIncidenciasPorEmpleadoAsync_Solo_Justifica_Las_Fechas_Del_Detalle()
    {
        var asistencias = CreateAsistenciasContext();
        foreach (var fecha in new[]
                 {
                     new DateTime(2026, 9, 2),
                     new DateTime(2026, 9, 3),
                     new DateTime(2026, 9, 9),
                     new DateTime(2026, 9, 12),
                     new DateTime(2026, 9, 16)
                 })
        {
            SeedIncidencia(asistencias, fecha);
        }
        await asistencias.SaveChangesAsync();

        var lefarma = CreateLefarmaContext();
        SeedSolicitud(lefarma, 18, new DateTime(2026, 9, 2), null, "CERRADA", new DateTime(2026, 9, 2));

        var service = CreateService(asistencias, lefarma);

        var result = await service.GetIncidenciasPorEmpleadoAsync(
            Nomina, new DateTime(2026, 9, 1), new DateTime(2026, 9, 30), 100);

        result.IsError.Should().BeFalse();
        result.Value
            .Where(i => i.Justificada)
            .Select(i => i.Fecha.Date)
            .Should().Equal(new DateTime(2026, 9, 2));

        foreach (var fecha in new[]
                 {
                     new DateTime(2026, 9, 3),
                     new DateTime(2026, 9, 9),
                     new DateTime(2026, 9, 12),
                     new DateTime(2026, 9, 16)
                 })
        {
            var item = result.Value.Single(i => i.Fecha.Date == fecha);
            item.EnTramite.Should().BeFalse();
            item.IdSolicitud.Should().BeNull();
        }
    }

    [Fact]
    public async Task GetIncidenciasPorEmpleadoAsync_Justifica_El_Rango_Cuando_Hay_Fecha_Fin()
    {
        var asistencias = CreateAsistenciasContext();
        foreach (var fecha in new[]
                 {
                     new DateTime(2026, 9, 2),
                     new DateTime(2026, 9, 3),
                     new DateTime(2026, 9, 4),
                     new DateTime(2026, 9, 5)
                 })
        {
            SeedIncidencia(asistencias, fecha);
        }
        await asistencias.SaveChangesAsync();

        var lefarma = CreateLefarmaContext();
        SeedSolicitud(
            lefarma, 20, new DateTime(2026, 9, 2), new DateTime(2026, 9, 4), "CERRADA",
            new DateTime(2026, 9, 2), new DateTime(2026, 9, 3), new DateTime(2026, 9, 4));

        var service = CreateService(asistencias, lefarma);

        var result = await service.GetIncidenciasPorEmpleadoAsync(
            Nomina, new DateTime(2026, 9, 1), new DateTime(2026, 9, 30), 100);

        result.IsError.Should().BeFalse();
        result.Value
            .Where(i => i.Justificada)
            .Select(i => i.Fecha.Date)
            .Should().BeEquivalentTo(new[]
            {
                new DateTime(2026, 9, 2),
                new DateTime(2026, 9, 3),
                new DateTime(2026, 9, 4)
            });

        result.Value.Single(i => i.Fecha.Date == new DateTime(2026, 9, 5)).Justificada.Should().BeFalse();
    }

    [Fact]
    public async Task GetIncidenciasPorEmpleadoAsync_Sin_Detalle_Usa_El_Rango()
    {
        var asistencias = CreateAsistenciasContext();
        foreach (var fecha in new[]
                 {
                     new DateTime(2026, 9, 2),
                     new DateTime(2026, 9, 3),
                     new DateTime(2026, 9, 5)
                 })
        {
            SeedIncidencia(asistencias, fecha);
        }
        await asistencias.SaveChangesAsync();

        var lefarma = CreateLefarmaContext();
        SeedSolicitud(lefarma, 21, new DateTime(2026, 9, 2), new DateTime(2026, 9, 3), "CERRADA");

        var service = CreateService(asistencias, lefarma);

        var result = await service.GetIncidenciasPorEmpleadoAsync(
            Nomina, new DateTime(2026, 9, 1), new DateTime(2026, 9, 30), 100);

        result.IsError.Should().BeFalse();
        result.Value
            .Where(i => i.Justificada)
            .Select(i => i.Fecha.Date)
            .Should().BeEquivalentTo(new[]
            {
                new DateTime(2026, 9, 2),
                new DateTime(2026, 9, 3)
            });

        result.Value.Single(i => i.Fecha.Date == new DateTime(2026, 9, 5)).Justificada.Should().BeFalse();
    }

    [Fact]
    public async Task GetIncidenciasPorEmpleadoAsync_Sin_Detalle_Y_Sin_Fecha_Fin_Solo_Justifica_El_Inicio()
    {
        var asistencias = CreateAsistenciasContext();
        foreach (var fecha in new[]
                 {
                     new DateTime(2026, 9, 2),
                     new DateTime(2026, 9, 9)
                 })
        {
            SeedIncidencia(asistencias, fecha);
        }
        await asistencias.SaveChangesAsync();

        var lefarma = CreateLefarmaContext();
        SeedSolicitud(lefarma, 22, new DateTime(2026, 9, 2), null, "CERRADA");

        var service = CreateService(asistencias, lefarma);

        var result = await service.GetIncidenciasPorEmpleadoAsync(
            Nomina, new DateTime(2026, 9, 1), new DateTime(2026, 9, 30), 100);

        result.IsError.Should().BeFalse();
        result.Value
            .Where(i => i.Justificada)
            .Select(i => i.Fecha.Date)
            .Should().Equal(new DateTime(2026, 9, 2));

        result.Value.Single(i => i.Fecha.Date == new DateTime(2026, 9, 9)).Justificada.Should().BeFalse();
    }

    [Fact]
    public async Task GetReglasDescuentoAsync_Debe_Retornar_Reglas_Activas_Y_El_Tope()
    {
        var asistencias = CreateAsistenciasContext();
        var lefarma = CreateLefarmaContext();

        lefarma.IncidenciasChecadoConfig.Add(new IncidenciaChecadoConfig
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
            Activo = true
        });
        lefarma.IncidenciasChecadoConfig.Add(new IncidenciaChecadoConfig
        {
            IdConfig = 2,
            Nombre = "Regla inactiva",
            Descripcion = "Regla inactiva",
            TipoIncidencia = "OMISION_SALIDA",
            CantidadAcumulada = 1,
            Periodo = "quincena",
            Prioridad = 5,
            Activo = false
        });
        await lefarma.SaveChangesAsync();

        var service = CreateService(asistencias, lefarma);

        var result = await service.GetReglasDescuentoAsync();

        result.IsError.Should().BeFalse();
        result.Value.Reglas.Should().ContainSingle();
        result.Value.Reglas[0].Nombre.Should().Be("Retardo de entrada menor a 20 min");
        result.Value.Reglas[0].CantidadAcumulada.Should().Be(3);
        result.Value.LimiteDescuentosJustificadosMes.Should().Be(2);
    }

    [Fact]
    public async Task GetIncidenciasPorEmpleadoAsync_Marca_EnTramite_Cuando_No_Esta_Cerrada()
    {
        var asistencias = CreateAsistenciasContext();
        SeedIncidencia(asistencias, new DateTime(2026, 9, 2));
        await asistencias.SaveChangesAsync();

        var lefarma = CreateLefarmaContext();
        SeedSolicitud(lefarma, 23, new DateTime(2026, 9, 2), null, "EN_PROCESO", new DateTime(2026, 9, 2));

        var service = CreateService(asistencias, lefarma);

        var result = await service.GetIncidenciasPorEmpleadoAsync(
            Nomina, new DateTime(2026, 9, 1), new DateTime(2026, 9, 30), 100);

        result.IsError.Should().BeFalse();
        var item = result.Value.Single();
        item.EnTramite.Should().BeTrue();
        item.Justificada.Should().BeFalse();
        item.IdSolicitud.Should().Be(23);
    }

    [Fact]
    public async Task GetIncidenciasPorEmpleadoAsync_No_Justifica_Con_Solicitudes_De_Otra_Categoria()
    {
        var asistencias = CreateAsistenciasContext();
        SeedIncidencia(asistencias, new DateTime(2026, 9, 12));
        await asistencias.SaveChangesAsync();

        var lefarma = CreateLefarmaContext();
        SeedSolicitudVacaciones(
            lefarma, 30, new DateTime(2026, 9, 12), null, "CERRADA", new DateTime(2026, 9, 12));

        var service = CreateService(asistencias, lefarma);

        var result = await service.GetIncidenciasPorEmpleadoAsync(
            Nomina, new DateTime(2026, 9, 1), new DateTime(2026, 9, 30), 100);

        result.IsError.Should().BeFalse();
        var item = result.Value.Single();
        item.Justificada.Should().BeFalse();
        item.EnTramite.Should().BeFalse();
        item.IdSolicitud.Should().BeNull();
    }
}
