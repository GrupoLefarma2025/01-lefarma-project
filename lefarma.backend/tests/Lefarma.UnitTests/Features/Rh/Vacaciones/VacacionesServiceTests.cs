using FluentAssertions;
using Lefarma.API.Domain.Entities.Asistencias;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Admin;
using Lefarma.API.Features.Rh.Vacaciones;
using Lefarma.API.Features.Rh.Vacaciones.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Logging;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace Lefarma.UnitTests.Features.Rh.Vacaciones;

public class VacacionesServiceTests
{
    private static ApplicationDbContext CreateAppContext()
        => new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static AsokamDbContext CreateAsokamContext()
        => new(new DbContextOptionsBuilder<AsokamDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static AsistenciasDbContext CreateAsistenciasContext()
        => new TestableAsistenciasDbContext(new DbContextOptionsBuilder<AsistenciasDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private sealed class TestableAsistenciasDbContext : AsistenciasDbContext
    {
        public TestableAsistenciasDbContext(DbContextOptions<AsistenciasDbContext> options) : base(options) { }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            // La vista real es keyless; para pruebas InMemory necesita clave.
            modelBuilder.Ignore<VwEmpleado>();
            modelBuilder.Entity<VwEmpleado>().HasKey(e => e.Id);
        }
    }

    private static VacacionesService CreateService(
        ApplicationDbContext context, AsistenciasDbContext asistencias, AsokamDbContext asokam)
        => new(
            Mock.Of<IAdminRepository>(),
            context,
            asistencias,
            asokam,
            Mock.Of<IWideEventAccessor>());

    private static SaldoVacacionesAnual SeedSaldo(
        ApplicationDbContext context, int idUsuario = 1, int anio = 2026)
    {
        var saldo = new SaldoVacacionesAnual
        {
            IdUsuario = idUsuario,
            IdEmpresa = 1,
            Anio = anio,
            DiasGenerados = 12m,
            DiasTomados = 2m,
            Activo = true,
            FechaCreacion = DateTime.Now
        };
        context.SaldosVacacionesAnuales.Add(saldo);
        context.SaveChanges();
        return saldo;
    }

    private static SolicitudPersonal Solicitud(
        int id, string folio, int idUsuario, int idTipo, int idEstado, DateTime inicio, DateTime fin)
        => new()
        {
            IdSolicitud = id,
            Folio = folio,
            IdEmpresa = 1,
            IdSucursal = 1,
            IdUsuarioCreador = idUsuario,
            IdUsuarioSolicitante = idUsuario,
            IdTipoSolicitud = idTipo,
            IdEstado = idEstado,
            IdWorkflow = 1,
            FechaInicio = inicio,
            FechaFin = fin,
            FechaCreacion = DateTime.Now
        };

    [Fact]
    public async Task AjustarSaldo_ActualizaValoresYAuditoria()
    {
        var context = CreateAppContext();
        var saldo = SeedSaldo(context);
        var service = CreateService(context, CreateAsistenciasContext(), CreateAsokamContext());

        var result = await service.AjustarSaldoAsync(saldo.IdSaldo, new SaldoVacacionesAjusteRequest
        {
            DiasAjustados = 3m,
            DiasVencidos = 1m,
            DiasCompensados = 2m,
            Motivo = "  Corrección RH  "
        }, idUsuario: 99);

        result.IsError.Should().BeFalse();

        var actualizado = await context.SaldosVacacionesAnuales.FindAsync(saldo.IdSaldo);
        actualizado!.DiasAjustados.Should().Be(3m);
        actualizado.DiasVencidos.Should().Be(1m);
        actualizado.DiasCompensados.Should().Be(2m);
        actualizado.IdUsuarioModificacion.Should().Be(99);
        actualizado.FechaModificacion.Should().NotBeNull();
        actualizado.MotivoAjuste.Should().Be("Corrección RH");
    }

    [Fact]
    public async Task AjustarSaldo_PermiteAjustadosNegativos()
    {
        var context = CreateAppContext();
        var saldo = SeedSaldo(context);
        var service = CreateService(context, CreateAsistenciasContext(), CreateAsokamContext());

        var result = await service.AjustarSaldoAsync(saldo.IdSaldo, new SaldoVacacionesAjusteRequest
        {
            DiasAjustados = -2m,
            Motivo = "Se restan días por error de captura"
        }, idUsuario: 99);

        result.IsError.Should().BeFalse();
        var actualizado = await context.SaldosVacacionesAnuales.FindAsync(saldo.IdSaldo);
        actualizado!.DiasAjustados.Should().Be(-2m);
    }

    [Fact]
    public async Task AjustarSaldo_ValoresConDecimales_RetornaErrorDeValidacion()
    {
        var context = CreateAppContext();
        var saldo = SeedSaldo(context);
        var service = CreateService(context, CreateAsistenciasContext(), CreateAsokamContext());

        var result = await service.AjustarSaldoAsync(saldo.IdSaldo, new SaldoVacacionesAjusteRequest
        {
            DiasAjustados = 1.5m,
            Motivo = "Intento con decimales"
        }, idUsuario: 99);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Validation.ajuste");
    }

    [Fact]
    public async Task AjustarSaldo_SinMotivo_RetornaErrorDeValidacion()
    {
        var context = CreateAppContext();
        var saldo = SeedSaldo(context);
        var service = CreateService(context, CreateAsistenciasContext(), CreateAsokamContext());

        var result = await service.AjustarSaldoAsync(saldo.IdSaldo, new SaldoVacacionesAjusteRequest
        {
            DiasAjustados = 1m,
            Motivo = "   "
        }, idUsuario: 99);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Validation.motivo");
    }

    [Fact]
    public async Task AjustarSaldo_SinValores_RetornaErrorDeValidacion()
    {
        var context = CreateAppContext();
        var saldo = SeedSaldo(context);
        var service = CreateService(context, CreateAsistenciasContext(), CreateAsokamContext());

        var result = await service.AjustarSaldoAsync(saldo.IdSaldo, new SaldoVacacionesAjusteRequest
        {
            Motivo = "Ajuste sin valores"
        }, idUsuario: 99);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Validation.ajuste");
    }

    [Fact]
    public async Task AjustarSaldo_VencidosNegativos_RetornaErrorDeValidacion()
    {
        var context = CreateAppContext();
        var saldo = SeedSaldo(context);
        var service = CreateService(context, CreateAsistenciasContext(), CreateAsokamContext());

        var result = await service.AjustarSaldoAsync(saldo.IdSaldo, new SaldoVacacionesAjusteRequest
        {
            DiasVencidos = -1m,
            Motivo = "Intento inválido"
        }, idUsuario: 99);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("Validation.diasVencidos");
    }

    [Fact]
    public async Task AjustarSaldo_SaldoInexistente_RetornaNotFound()
    {
        var context = CreateAppContext();
        var service = CreateService(context, CreateAsistenciasContext(), CreateAsokamContext());

        var result = await service.AjustarSaldoAsync(999, new SaldoVacacionesAjusteRequest
        {
            DiasAjustados = 1m,
            Motivo = "No existe"
        }, idUsuario: 99);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("SaldoVacacionesAnual.NotFound");
    }

    [Fact]
    public async Task ObtenerDetalle_ListaDiasTomadosDeSolicitudesCerradas_ExcluyendoOficiales()
    {
        var context = CreateAppContext();
        var saldo = SeedSaldo(context, idUsuario: 7);
        saldo.IdUsuarioModificacion = 99;
        saldo.FechaModificacion = new DateTime(2026, 2, 1);
        saldo.MotivoAjuste = "Ajuste previo";
        context.SaveChanges();

        var asokam = CreateAsokamContext();
        asokam.Usuarios.Add(new Usuario
        {
            IdUsuario = 7,
            Correo = "empleado@test.com",
            NombreCompleto = "Juan Pérez"
        });
        asokam.Usuarios.Add(new Usuario
        {
            IdUsuario = 99,
            Correo = "rh@test.com",
            NombreCompleto = "RH Admin"
        });
        asokam.SaveChanges();

        var asistencias = CreateAsistenciasContext();
        asistencias.VwEmpleados.Add(new VwEmpleado
        {
            Id = 1,
            Nombre = "Juan",
            Apellidos = "Pérez",
            Correo = "empleado@test.com",
            Nomina = 555,
            Puesto = "Analista",
            Departamento = "TI",
            Empresa = "Lefarma",
            Fechaingreso = new DateTime(2020, 1, 15),
            Antiguedad = 6,
            Vacacionesxantiguedad = 12
        });
        asistencias.SaveChanges();

        context.TiposSolicitud.Add(new TipoSolicitud
        {
            IdTipoSolicitud = 11,
            Nombre = "Vacaciones",
            Descripcion = "Vacaciones",
            Clave = "vacaciones",
            Categoria = CategoriaSolicitud.Vacaciones,
            Activo = true
        });
        context.WorkflowEstados.Add(new WorkflowEstados
        {
            IdEstado = 5,
            Codigo = "CERRADA",
            Nombre = "Cerrada"
        });
        context.SolicitudesPersonal.Add(new SolicitudPersonal
        {
            IdSolicitud = 1,
            Folio = "SOL-1",
            IdEmpresa = 1,
            IdSucursal = 1,
            IdUsuarioCreador = 7,
            IdUsuarioSolicitante = 7,
            IdTipoSolicitud = 11,
            IdEstado = 5,
            IdWorkflow = 1,
            FechaInicio = new DateTime(2026, 1, 5),
            FechaFin = new DateTime(2026, 1, 9),
            FechaCreacion = DateTime.Now
        });
        context.DiasHabiles.Add(new DiaHabil
        {
            IdEmpresa = 1,
            Anio = 2026,
            Mes = 1,
            Dia = 7,
            Fecha = new DateTime(2026, 1, 7),
            ConsumeSaldo = false,
            Activo = true
        });
        context.SaveChanges();

        var service = CreateService(context, asistencias, asokam);

        var result = await service.ObtenerDetalleSaldoAsync(saldo.IdSaldo);

        result.IsError.Should().BeFalse();
        var detalle = result.Value;
        detalle.UsuarioNombre.Should().Be("Juan Pérez");
        detalle.Nomina.Should().Be(555);
        detalle.Puesto.Should().Be("Analista");
        detalle.AjustadoPor.Should().Be("RH Admin");
        detalle.Solicitudes.Should().ContainSingle();
        detalle.Solicitudes[0].Dias.Should().Be(4);
        detalle.Solicitudes[0].Fechas.Should().HaveCount(4);
        detalle.Solicitudes[0].Fechas.Should().NotContain(new DateTime(2026, 1, 7));
    }

    [Fact]
    public async Task ObtenerDetalle_ReportaSolicitudesEnTramiteYProyeccion()
    {
        var context = CreateAppContext();
        var saldo = new SaldoVacacionesAnual
        {
            IdUsuario = 7,
            IdEmpresa = 1,
            Anio = 2026,
            DiasGenerados = 12m,
            DiasTomados = 2m,
            DiasPendientes = 10m,
            Activo = true,
            FechaCreacion = DateTime.Now
        };
        context.SaldosVacacionesAnuales.Add(saldo);

        context.TiposSolicitud.Add(new TipoSolicitud
        {
            IdTipoSolicitud = 11,
            Nombre = "Vacaciones",
            Descripcion = "Vacaciones",
            Clave = "vacaciones",
            Categoria = CategoriaSolicitud.Vacaciones,
            Activo = true
        });
        context.WorkflowEstados.AddRange(
            new WorkflowEstados { IdEstado = 2, Codigo = "CREADA", Nombre = "Creada" },
            new WorkflowEstados { IdEstado = 5, Codigo = "CERRADA", Nombre = "Cerrada" },
            new WorkflowEstados { IdEstado = 8, Codigo = "RECHAZADA", Nombre = "Rechazada" });

        context.SolicitudesPersonal.AddRange(
            Solicitud(1, "SOL-CERRADA", 7, 11, 5, new DateTime(2026, 1, 5), new DateTime(2026, 1, 9)),
            Solicitud(2, "SOL-TRAMITE", 7, 11, 2, new DateTime(2026, 2, 2), new DateTime(2026, 2, 6)),
            Solicitud(3, "SOL-RECHAZADA", 7, 11, 8, new DateTime(2026, 3, 2), new DateTime(2026, 3, 4)));

        context.DiasHabiles.Add(new DiaHabil
        {
            IdEmpresa = 1,
            Anio = 2026,
            Mes = 1,
            Dia = 7,
            Fecha = new DateTime(2026, 1, 7),
            ConsumeSaldo = false,
            Activo = true
        });
        context.SaveChanges();

        var service = CreateService(context, CreateAsistenciasContext(), CreateAsokamContext());

        var result = await service.ObtenerDetalleSaldoAsync(saldo.IdSaldo);

        result.IsError.Should().BeFalse();
        var detalle = result.Value;

        detalle.Solicitudes.Should().HaveCount(2);
        detalle.Solicitudes.Should().NotContain(s => s.Folio == "SOL-RECHAZADA");

        var cerrada = detalle.Solicitudes.Single(s => s.Folio == "SOL-CERRADA");
        cerrada.EnTramite.Should().BeFalse();
        cerrada.Dias.Should().Be(4);
        cerrada.EstadoCodigo.Should().Be("CERRADA");

        var enTramite = detalle.Solicitudes.Single(s => s.Folio == "SOL-TRAMITE");
        enTramite.EnTramite.Should().BeTrue();
        enTramite.Dias.Should().Be(5);
        enTramite.EstadoCodigo.Should().Be("CREADA");
        enTramite.EstadoNombre.Should().Be("Creada");

        detalle.DiasEnTramite.Should().Be(5);
        detalle.DiasPendientesProyectado.Should().Be(5m);
    }

    [Fact]
    public async Task ObtenerDetalle_IncluyeHistorialDeTodosLosAniosDelUsuario()
    {
        var context = CreateAppContext();
        var saldoActual = SeedSaldo(context, idUsuario: 7, anio: 2026);

        context.SaldosVacacionesAnuales.Add(new SaldoVacacionesAnual
        {
            IdUsuario = 7,
            IdEmpresa = 1,
            Anio = 2025,
            DiasGenerados = 12m,
            DiasTomados = 5m,
            Activo = true,
            FechaCreacion = DateTime.Now
        });
        context.SaldosVacacionesAnuales.Add(new SaldoVacacionesAnual
        {
            IdUsuario = 7,
            IdEmpresa = 1,
            Anio = 2024,
            DiasGenerados = 10m,
            DiasTomados = 10m,
            Activo = true,
            FechaCreacion = DateTime.Now
        });
        context.SaldosVacacionesAnuales.Add(new SaldoVacacionesAnual
        {
            IdUsuario = 8,
            IdEmpresa = 1,
            Anio = 2025,
            DiasGenerados = 12m,
            Activo = true,
            FechaCreacion = DateTime.Now
        });
        context.SaldosVacacionesAnuales.Add(new SaldoVacacionesAnual
        {
            IdUsuario = 7,
            IdEmpresa = 1,
            Anio = 2023,
            DiasGenerados = 12m,
            Activo = false,
            FechaCreacion = DateTime.Now
        });
        context.SaveChanges();

        var service = CreateService(context, CreateAsistenciasContext(), CreateAsokamContext());

        var result = await service.ObtenerDetalleSaldoAsync(saldoActual.IdSaldo);

        result.IsError.Should().BeFalse();
        var historial = result.Value.Historial;
        historial.Should().HaveCount(3);
        historial.Select(h => h.Anio).Should().ContainInOrder(2026, 2025, 2024);
        historial.Should().OnlyContain(h => h.Anio != 2023);
        historial[0].IdSaldo.Should().Be(saldoActual.IdSaldo);
    }

    [Fact]
    public async Task ObtenerDetalle_SaldoInexistente_RetornaNotFound()
    {
        var context = CreateAppContext();
        var service = CreateService(context, CreateAsistenciasContext(), CreateAsokamContext());

        var result = await service.ObtenerDetalleSaldoAsync(999);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("SaldoVacacionesAnual.NotFound");
    }
}
