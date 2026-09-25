using System.Reflection;
using ErrorOr;
using FluentAssertions;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Config.Workflows;
using Lefarma.API.Features.Profile;
using Lefarma.API.Features.Rh.SolicitudesPersonal;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Logging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace Lefarma.UnitTests.Features.Rh.SolicitudesPersonal;

public class SolicitudPersonalFirmasServiceTests
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

    private static SolicitudPersonalFirmasService CreateService(ApplicationDbContext context)
    {
        var tipo = new TipoSolicitud
        {
            IdTipoSolicitud = 11,
            Nombre = "Vacaciones",
            Clave = "vacaciones",
            Categoria = CategoriaSolicitud.Vacaciones,
            Activo = true
        };
        var tipoRepository = new Mock<ITipoSolicitudRepository>();
        tipoRepository.Setup(r => r.GetByIdAsync(It.IsAny<int>())).ReturnsAsync(tipo);

        return new SolicitudPersonalFirmasService(
            context,
            CreateAsokamInMemoryContext(),
            Mock.Of<ISolicitudPersonalRepository>(),
            tipoRepository.Object,
            Mock.Of<IWorkflowEngine>(),
            Mock.Of<IWorkflowRepository>(),
            Mock.Of<IWorkflowQueryService>(),
            Mock.Of<IServiceScopeFactory>(),
            Mock.Of<IJefeInmediatoResolver>(),
            Mock.Of<IProfileService>(),
            Mock.Of<IWideEventAccessor>());
    }

    private static async Task<ErrorOr<bool>> ProcesarVacacionesAsync(
        SolicitudPersonalFirmasService service, SolicitudPersonal solicitud)
    {
        var method = typeof(SolicitudPersonalFirmasService).GetMethod(
            "ProcesarVacacionesAprobadasAsync", BindingFlags.NonPublic | BindingFlags.Instance);
        method.Should().NotBeNull();

        var task = (Task<ErrorOr<bool>>)method!.Invoke(service, new object?[] { solicitud })!;
        return await task;
    }

    private static SolicitudPersonal SolicitudVacaciones(DateTime inicio, DateTime fin, int idUsuario = 123)
        => new()
        {
            IdSolicitud = 1,
            Folio = "SOL-1",
            IdEmpresa = 1,
            IdSucursal = 1,
            IdUsuarioCreador = idUsuario,
            IdUsuarioSolicitante = idUsuario,
            IdTipoSolicitud = 11,
            FechaInicio = inicio,
            FechaFin = fin,
            FechaCreacion = DateTime.Now
        };

    [Fact]
    public async Task Cierre_Vacaciones_Con_Saldo_Insuficiente_Deja_Saldo_Negativo()
    {
        var context = CreateInMemoryContext();
        var anio = DateTime.Now.Year;

        context.SaldosVacacionesAnuales.Add(new SaldoVacacionesAnual
        {
            IdUsuario = 123,
            IdEmpresa = 1,
            Anio = anio,
            DiasGenerados = 5,
            DiasPendientes = 5,
            Activo = true
        });
        await context.SaveChangesAsync();

        var service = CreateService(context);
        var result = await ProcesarVacacionesAsync(
            service, SolicitudVacaciones(new DateTime(anio, 1, 1), new DateTime(anio, 1, 10)));

        result.IsError.Should().BeFalse();
        var saldo = context.SaldosVacacionesAnuales.Single();
        saldo.DiasTomados.Should().Be(10);
    }

    [Fact]
    public async Task Cierre_Vacaciones_Sin_Fila_De_Saldo_Crea_Saldo_En_Cero_Y_Descuenta()
    {
        var context = CreateInMemoryContext();
        var anio = DateTime.Now.Year;

        var service = CreateService(context);
        var result = await ProcesarVacacionesAsync(
            service, SolicitudVacaciones(new DateTime(anio, 1, 1), new DateTime(anio, 1, 5)));

        result.IsError.Should().BeFalse();
        var saldo = context.SaldosVacacionesAnuales.Single();
        saldo.IdUsuario.Should().Be(123);
        saldo.Anio.Should().Be(anio);
        saldo.DiasGenerados.Should().Be(0);
        saldo.DiasTomados.Should().Be(5);
    }

    [Fact]
    public async Task Cierre_Vacaciones_Excluye_Dias_Oficiales_Que_No_Consumen()
    {
        var context = CreateInMemoryContext();
        var anio = DateTime.Now.Year;

        context.SaldosVacacionesAnuales.Add(new SaldoVacacionesAnual
        {
            IdUsuario = 123,
            IdEmpresa = 1,
            Anio = anio,
            DiasGenerados = 10,
            DiasPendientes = 10,
            Activo = true
        });
        context.DiasHabiles.Add(new DiaHabil
        {
            IdEmpresa = 1,
            Anio = anio,
            Mes = 1,
            Dia = 3,
            Fecha = new DateTime(anio, 1, 3),
            Descripcion = "Día oficial",
            ConsumeSaldo = false,
            Activo = true,
            FechaCreacion = DateTime.Now
        });
        await context.SaveChangesAsync();

        var service = CreateService(context);
        var result = await ProcesarVacacionesAsync(
            service, SolicitudVacaciones(new DateTime(anio, 1, 1), new DateTime(anio, 1, 5)));

        result.IsError.Should().BeFalse();
        var saldo = context.SaldosVacacionesAnuales.Single(s => s.IdUsuario == 123);
        saldo.DiasTomados.Should().Be(4);
    }
}
