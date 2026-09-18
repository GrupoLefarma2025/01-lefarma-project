using System.Reflection;
using ErrorOr;
using FluentAssertions;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Admin;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Profile;
using Lefarma.API.Features.Rh.IncidenciasChecado;
using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;
using Lefarma.API.Features.Rh.SolicitudesPersonal;
using Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;
using Lefarma.API.Features.Rh.SolicitudesPersonal.Settings;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Logging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Moq;

namespace Lefarma.UnitTests.Features.Rh.SolicitudesPersonal;

public class SolicitudPersonalServiceTests
{
    private static ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static AsokamDbContext CreateAsokamInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<AsokamDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new AsokamDbContext(options);
    }

    private static SolicitudPersonalService CreateService(
        ApplicationDbContext context,
        ITipoSolicitudRepository? tipoRepository = null,
        IEmpleadoRepository? empleadoRepository = null,
        IIncidenciasChecadoService? incidenciasChecadoService = null)
    {
        return new SolicitudPersonalService(
            Mock.Of<IAdminRepository>(),
            Mock.Of<ISolicitudPersonalRepository>(),
            tipoRepository ?? Mock.Of<ITipoSolicitudRepository>(),
            Mock.Of<IWorkflowResolver>(),
            context,
            CreateAsokamInMemoryContext(),
            Mock.Of<IJefeInmediatoResolver>(),
            Mock.Of<ISolicitudPersonalFirmasService>(),
            empleadoRepository ?? Mock.Of<IEmpleadoRepository>(),
            Mock.Of<IIncidenciasChecadoRepository>(),
            incidenciasChecadoService ?? Mock.Of<IIncidenciasChecadoService>(),
            Mock.Of<IProfileService>(),
            Options.Create(new SolicitudesPersonalSettings()),
            Mock.Of<IWideEventAccessor>());
    }

    [Fact]
    public async Task ObtenerLimitesSolicitudesAsync_Debe_Incluir_Saldo_De_Vacaciones_Del_Anio_Actual()
    {
        var context = CreateInMemoryContext();
        var idUsuario = 123;
        var anio = DateTime.Now.Year;

        context.SaldosVacacionesAnuales.Add(new SaldoVacacionesAnual
        {
            IdUsuario = idUsuario,
            IdEmpresa = 1,
            Anio = anio,
            DiasGenerados = 20,
            DiasVencidos = 0,
            DiasCompensados = 2,
            DiasAjustados = 1,
            DiasTomados = 5,
            DiasPendientes = 18,
            Activo = true
        });

        await context.SaveChangesAsync();

        var tipoRepoMock = new Mock<ITipoSolicitudRepository>();
        tipoRepoMock.Setup(r => r.GetTiposActivosAsync()).ReturnsAsync(new List<TipoSolicitud>());

        var service = CreateService(context, tipoRepoMock.Object);

        var result = await service.ObtenerLimitesSolicitudesAsync(idUsuario, idUsuario, false);

        result.IsError.Should().BeFalse();
        result.Value.SaldosVacaciones.Should().HaveCount(1);
        result.Value.SaldosVacaciones[0].DiasPendientes.Should().Be(18);
        result.Value.SaldosVacaciones[0].Anio.Should().Be(anio);
    }

    [Fact]
    public async Task ObtenerLimitesSolicitudesAsync_Debe_Incluir_Descuentos_Justificados_Del_Mes_Actual_Y_Anterior()
    {
        var context = CreateInMemoryContext();
        var idUsuario = 123;
        var ahora = DateTime.Now;

        var tipoRepoMock = new Mock<ITipoSolicitudRepository>();
        tipoRepoMock.Setup(r => r.GetTiposActivosAsync()).ReturnsAsync(new List<TipoSolicitud>
        {
            new()
            {
                IdTipoSolicitud = 10,
                Nombre = "Retardo mayor a 20 minutos",
                Categoria = CategoriaSolicitud.Incidencia,
                Activo = true
            }
        });

        var empleadoRepoMock = new Mock<IEmpleadoRepository>();
        empleadoRepoMock
            .Setup(r => r.ResolverNominaPorUsuarioAsync(idUsuario, It.IsAny<CancellationToken>()))
            .ReturnsAsync(999L);

        var incidenciasServiceMock = new Mock<IIncidenciasChecadoService>();
        incidenciasServiceMock
            .Setup(s => s.GetIncidenciasPorEmpleadoAsync(
                999L, It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<IncidenciaChecadoResponse>
            {
                new()
                {
                    Fecha = new DateTime(ahora.Year, ahora.Month, 1),
                    Nomina = 999,
                    Justificada = true,
                    IncidenciasCalculadas = new List<IncidenciaCalculadaDto>
                    {
                        new() { GeneraDescuento = true }
                    }
                }
            });

        var service = CreateService(
            context, tipoRepoMock.Object, empleadoRepoMock.Object, incidenciasServiceMock.Object);

        var result = await service.ObtenerLimitesSolicitudesAsync(idUsuario, idUsuario, true);

        result.IsError.Should().BeFalse();
        var descuentos = result.Value.LimitesPorTipo
            .Where(l => l.Tipo == "Descuentos justificados")
            .ToList();
        descuentos.Should().HaveCount(2);
        descuentos.Should().OnlyContain(l => l.Limite == 2);

        var mesActual = descuentos.Single(l =>
            l.PeriodoInicio.Year == ahora.Year && l.PeriodoInicio.Month == ahora.Month);
        mesActual.Usado.Should().Be(1);
        mesActual.Disponible.Should().Be(1);

        var mesAnterior = descuentos.Single(l => l.PeriodoInicio != mesActual.PeriodoInicio);
        mesAnterior.Usado.Should().Be(0);
        mesAnterior.Disponible.Should().Be(2);
    }

    private static IEmpleadoRepository MockEmpleado(long? nomina = 999)
    {
        var mock = new Mock<IEmpleadoRepository>();
        mock.Setup(r => r.ResolverNominaPorUsuarioAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(nomina);
        return mock.Object;
    }

    private static IIncidenciasChecadoService MockIncidencias(params IncidenciaChecadoResponse[] items)
    {
        var mock = new Mock<IIncidenciasChecadoService>();
        mock.Setup(s => s.GetIncidenciasPorEmpleadoAsync(
                It.IsAny<long>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(items.ToList());
        return mock.Object;
    }

    private static IIncidenciasChecadoService MockIncidenciasPorMes(
        Func<DateTime, List<IncidenciaChecadoResponse>> porMes)
    {
        var mock = new Mock<IIncidenciasChecadoService>();
        mock.Setup(s => s.GetIncidenciasPorEmpleadoAsync(
                It.IsAny<long>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .Returns((long nomina, DateTime inicio, DateTime fin, int limite, CancellationToken token) =>
                Task.FromResult<ErrorOr<List<IncidenciaChecadoResponse>>>(porMes(inicio)));
        return mock.Object;
    }

    private static IncidenciaChecadoResponse Incidencia(
        DateTime fecha, bool justificada = false, bool generaDescuento = false)
        => new()
        {
            Fecha = fecha,
            Nomina = 999,
            Justificada = justificada,
            IncidenciasCalculadas = new List<IncidenciaCalculadaDto>
            {
                new() { GeneraDescuento = generaDescuento }
            }
        };

    private static async Task<ErrorOr<Success>> ValidarDescuentosAsync(
        SolicitudPersonalService service,
        int idUsuario,
        IEnumerable<DateTime> fechas,
        int? excluirIdSolicitud = null)
    {
        var method = typeof(SolicitudPersonalService).GetMethod(
            "ValidarDescuentosJustificadosAsync", BindingFlags.NonPublic | BindingFlags.Instance);
        method.Should().NotBeNull();

        var task = (Task<ErrorOr<Success>>)method!.Invoke(
            service, new object?[] { idUsuario, fechas, excluirIdSolicitud, CancellationToken.None })!;
        return await task;
    }

    private static void SeedSolicitudVigente(
        ApplicationDbContext context,
        int idSolicitud,
        int idUsuario,
        TipoSolicitud tipo,
        WorkflowEstados estado,
        params DateTime[] fechas)
    {
        context.SolicitudesPersonal.Add(new SolicitudPersonal
        {
            IdSolicitud = idSolicitud,
            Folio = $"SOL-{idSolicitud}",
            IdEmpresa = 1,
            IdSucursal = 1,
            IdWorkflow = 1,
            IdUsuarioCreador = idUsuario,
            IdUsuarioSolicitante = idUsuario,
            IdTipoSolicitud = tipo.IdTipoSolicitud,
            TipoSolicitud = tipo,
            IdEstado = estado.IdEstado,
            Estado = estado,
            FechaInicio = fechas.Min(),
            FechaFin = fechas.Max(),
            FechaCreacion = DateTime.Now,
            Detalle = fechas
                .Select(f => new SolicitudPersonalDetalle
                {
                    IdSolicitud = idSolicitud,
                    Fecha = f,
                    FechaCreacion = DateTime.Now
                })
                .ToList()
        });
    }

    [Fact]
    public async Task ValidarSaldoVacacionesAsync_Saldo_Suficiente_Retorna_Exito()
    {
        var context = CreateInMemoryContext();
        var idUsuario = 123;
        var anio = DateTime.Now.Year;

        context.SaldosVacacionesAnuales.Add(new SaldoVacacionesAnual
        {
            IdUsuario = idUsuario,
            IdEmpresa = 1,
            Anio = anio,
            DiasGenerados = 10,
            DiasPendientes = 10,
            Activo = true
        });

        await context.SaveChangesAsync();

        var service = CreateService(context);
        var tipo = new TipoSolicitud { Clave = "vacaciones" };
        var solicitud = new SolicitudPersonal
        {
            FechaInicio = new DateTime(anio, 1, 1),
            FechaFin = new DateTime(anio, 1, 5)
        };

        var method = typeof(SolicitudPersonalService).GetMethod(
            "ValidarSaldoVacacionesAsync",
            BindingFlags.NonPublic | BindingFlags.Instance);

        method.Should().NotBeNull();

        var task = (Task<ErrorOr<Success>>)method!.Invoke(
            service,
            new object?[] { idUsuario, solicitud, tipo, null })!;

        var result = await task;

        result.IsError.Should().BeFalse();
    }

    [Fact]
    public async Task ValidarSaldoVacacionesAsync_Saldo_Insuficiente_Retorna_Error_De_Validacion()
    {
        var context = CreateInMemoryContext();
        var idUsuario = 123;
        var anio = DateTime.Now.Year;

        context.SaldosVacacionesAnuales.Add(new SaldoVacacionesAnual
        {
            IdUsuario = idUsuario,
            IdEmpresa = 1,
            Anio = anio,
            DiasGenerados = 3,
            DiasPendientes = 3,
            Activo = true
        });

        await context.SaveChangesAsync();

        var service = CreateService(context);
        var tipo = new TipoSolicitud { Clave = "vacaciones" };
        var solicitud = new SolicitudPersonal
        {
            FechaInicio = new DateTime(anio, 1, 1),
            FechaFin = new DateTime(anio, 1, 10)
        };

        var method = typeof(SolicitudPersonalService).GetMethod(
            "ValidarSaldoVacacionesAsync",
            BindingFlags.NonPublic | BindingFlags.Instance);

        var task = (Task<ErrorOr<Success>>)method!.Invoke(
            service,
            new object?[] { idUsuario, solicitud, tipo, null })!;

        var result = await task;

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Contain("Validation");
    }

    [Fact]
    public async Task ValidarSaldoVacacionesAsync_Sin_Saldo_Retorna_NotFound()
    {
        var context = CreateInMemoryContext();
        var service = CreateService(context);
        var tipo = new TipoSolicitud { Clave = "vacaciones" };
        var anio = DateTime.Now.Year;
        var solicitud = new SolicitudPersonal
        {
            FechaInicio = new DateTime(anio, 1, 1),
            FechaFin = new DateTime(anio, 1, 5)
        };

        var method = typeof(SolicitudPersonalService).GetMethod(
            "ValidarSaldoVacacionesAsync",
            BindingFlags.NonPublic | BindingFlags.Instance);

        var task = (Task<ErrorOr<Success>>)method!.Invoke(
            service,
            new object?[] { 123, solicitud, tipo, null })!;

        var result = await task;

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Contain("NotFound");
    }

    [Fact]
    public async Task ValidarDescuentos_Con_Dos_Ya_Cubiertos_Bloquea_Cualquier_Solicitud_Del_Mes()
    {
        var context = CreateInMemoryContext();
        var idUsuario = 123;
        var mes = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1);

        var service = CreateService(
            context,
            empleadoRepository: MockEmpleado(),
            incidenciasChecadoService: MockIncidencias(
                Incidencia(mes.AddDays(1), justificada: true, generaDescuento: true),
                Incidencia(mes.AddDays(2), justificada: true, generaDescuento: true)));

        var result = await ValidarDescuentosAsync(service, idUsuario, new[] { mes.AddDays(10) });

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Contain("DescuentosJustificados");
    }

    [Fact]
    public async Task ValidarDescuentos_Con_Un_Cubierto_Y_Seleccion_De_Un_Descuento_Retorna_Exito()
    {
        var context = CreateInMemoryContext();
        var idUsuario = 123;
        var mes = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1);

        var service = CreateService(
            context,
            empleadoRepository: MockEmpleado(),
            incidenciasChecadoService: MockIncidencias(
                Incidencia(mes.AddDays(1), justificada: true, generaDescuento: true),
                Incidencia(mes.AddDays(2), generaDescuento: true)));

        var result = await ValidarDescuentosAsync(service, idUsuario, new[] { mes.AddDays(2) });

        result.IsError.Should().BeFalse();
    }

    [Fact]
    public async Task ValidarDescuentos_Cuando_La_Seleccion_Excede_El_Tope_Retorna_Error()
    {
        var context = CreateInMemoryContext();
        var idUsuario = 123;
        var mes = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1);

        var service = CreateService(
            context,
            empleadoRepository: MockEmpleado(),
            incidenciasChecadoService: MockIncidencias(
                Incidencia(mes.AddDays(1), justificada: true, generaDescuento: true),
                Incidencia(mes.AddDays(2), generaDescuento: true),
                Incidencia(mes.AddDays(3), generaDescuento: true)));

        var result = await ValidarDescuentosAsync(service, idUsuario, new[] { mes.AddDays(2), mes.AddDays(3) });

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Contain("DescuentosJustificados");
    }

    [Fact]
    public async Task ValidarDescuentos_Cuenta_Los_Descuentos_Apartados_Por_Otras_Solicitudes_Vigentes()
    {
        var context = CreateInMemoryContext();
        var idUsuario = 123;
        var mes = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1);

        var tipo = new TipoSolicitud
        {
            IdTipoSolicitud = 10,
            Nombre = "Retardo",
            Descripcion = "Retardo",
            Clave = "retardo",
            Categoria = CategoriaSolicitud.Incidencia,
            Activo = true
        };
        var estado = new WorkflowEstados
        {
            IdEstado = 1,
            Codigo = "CREADA",
            Nombre = "Creada",
            Activo = true
        };
        context.TiposSolicitud.Add(tipo);
        context.WorkflowEstados.Add(estado);
        SeedSolicitudVigente(context, 5, idUsuario, tipo, estado, mes.AddDays(1), mes.AddDays(2));
        await context.SaveChangesAsync();

        var service = CreateService(
            context,
            empleadoRepository: MockEmpleado(),
            incidenciasChecadoService: MockIncidencias(
                Incidencia(mes.AddDays(1), generaDescuento: true),
                Incidencia(mes.AddDays(2), generaDescuento: true)));

        var result = await ValidarDescuentosAsync(service, idUsuario, new[] { mes.AddDays(10) });

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Contain("DescuentosJustificados");
    }

    [Fact]
    public async Task ValidarDescuentos_No_Cruza_Meses()
    {
        var context = CreateInMemoryContext();
        var idUsuario = 123;
        var ahora = DateTime.Now;
        var mesActual = new DateTime(ahora.Year, ahora.Month, 1);
        var mesAnterior = mesActual.AddMonths(-1);

        var service = CreateService(
            context,
            empleadoRepository: MockEmpleado(),
            incidenciasChecadoService: MockIncidenciasPorMes(inicio =>
                inicio.Year == mesAnterior.Year && inicio.Month == mesAnterior.Month
                    ? new List<IncidenciaChecadoResponse>
                    {
                        Incidencia(mesAnterior.AddDays(1), justificada: true, generaDescuento: true),
                        Incidencia(mesAnterior.AddDays(2), justificada: true, generaDescuento: true)
                    }
                    : new List<IncidenciaChecadoResponse>()));

        var result = await ValidarDescuentosAsync(service, idUsuario, new[] { mesActual.AddDays(5) });

        result.IsError.Should().BeFalse();
    }

    [Fact]
    public async Task ValidarDescuentos_Al_Editar_Excluye_La_Propia_Solicitud()
    {
        var context = CreateInMemoryContext();
        var idUsuario = 123;
        var mes = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1);

        var tipo = new TipoSolicitud
        {
            IdTipoSolicitud = 10,
            Nombre = "Retardo",
            Descripcion = "Retardo",
            Clave = "retardo",
            Categoria = CategoriaSolicitud.Incidencia,
            Activo = true
        };
        var estado = new WorkflowEstados
        {
            IdEstado = 1,
            Codigo = "CREADA",
            Nombre = "Creada",
            Activo = true
        };
        context.TiposSolicitud.Add(tipo);
        context.WorkflowEstados.Add(estado);
        SeedSolicitudVigente(context, 5, idUsuario, tipo, estado, mes.AddDays(1), mes.AddDays(2));
        await context.SaveChangesAsync();

        var service = CreateService(
            context,
            empleadoRepository: MockEmpleado(),
            incidenciasChecadoService: MockIncidencias(
                Incidencia(mes.AddDays(1), generaDescuento: true),
                Incidencia(mes.AddDays(2), generaDescuento: true)));

        var conExclusion = await ValidarDescuentosAsync(
            service, idUsuario, new[] { mes.AddDays(10) }, excluirIdSolicitud: 5);
        conExclusion.IsError.Should().BeFalse();

        var sinExclusion = await ValidarDescuentosAsync(service, idUsuario, new[] { mes.AddDays(10) });
        sinExclusion.IsError.Should().BeTrue();
    }
}
