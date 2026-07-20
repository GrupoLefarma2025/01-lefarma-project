using System.Reflection;
using ErrorOr;
using FluentAssertions;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Profile;
using Lefarma.API.Features.Rh.SolicitudesPersonal;
using Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Logging;
using Microsoft.EntityFrameworkCore;
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
        ApplicationDbContext context, ITipoSolicitudRepository? tipoRepository = null)
    {
        return new SolicitudPersonalService(
            Mock.Of<ISolicitudPersonalRepository>(),
            tipoRepository ?? Mock.Of<ITipoSolicitudRepository>(),
            Mock.Of<IWorkflowResolver>(),
            context,
            CreateAsokamInMemoryContext(),
            Mock.Of<IJefeInmediatoResolver>(),
            Mock.Of<ISolicitudPersonalFirmasService>(),
            Mock.Of<IEmpleadoRepository>(),
            Mock.Of<IIncidenciasChecadoRepository>(),
            Mock.Of<IProfileService>(),
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
}
