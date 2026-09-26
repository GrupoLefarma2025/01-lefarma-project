using System.Reflection;
using ErrorOr;
using FluentAssertions;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Admin;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.Config.Workflows.Handlers;
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
        IIncidenciasChecadoService? incidenciasChecadoService = null,
        IWorkflowResolver? workflowResolver = null,
        ISolicitudPersonalFirmasService? firmasService = null,
        IAdminRepository? adminRepository = null,
        IProfileService? profileService = null,
        ISolicitudPersonalRepository? repository = null)
    {
        return new SolicitudPersonalService(
            adminRepository ?? Mock.Of<IAdminRepository>(),
            repository ?? Mock.Of<ISolicitudPersonalRepository>(),
            tipoRepository ?? Mock.Of<ITipoSolicitudRepository>(),
            workflowResolver ?? Mock.Of<IWorkflowResolver>(),
            context,
            CreateAsokamInMemoryContext(),
            Mock.Of<IJefeInmediatoResolver>(),
            firmasService ?? Mock.Of<ISolicitudPersonalFirmasService>(),
            empleadoRepository ?? Mock.Of<IEmpleadoRepository>(),
            Mock.Of<IIncidenciasChecadoRepository>(),
            incidenciasChecadoService ?? Mock.Of<IIncidenciasChecadoService>(),
            profileService ?? Mock.Of<IProfileService>(),
            new HandlerConditionEvaluator(context),
            Options.Create(new SolicitudesPersonalSettings()),
            Mock.Of<IWideEventAccessor>());
    }

    private static (Mock<IWorkflowResolver> Resolver, Mock<ISolicitudPersonalFirmasService> Firmas, WorkflowAccion AccionEnviar)
        PrepararWorkflowConEnviar(int idAccion)
    {
        var accion = new WorkflowAccion
        {
            IdAccion = idAccion,
            IdPasoOrigen = 10,
            IdTipoAccion = 1,
            Activo = true,
            TipoAccion = new WorkflowTipoAccion { IdTipoAccion = 1, Codigo = "ENVIAR", Activo = true, CodigoProceso = "SOLICITUD_PERSONAL" }
        };
        var paso = new WorkflowPaso
        {
            IdPaso = 10,
            IdWorkflow = 5,
            Orden = 1,
            NombrePaso = "Captura",
            EsInicio = true,
            Activo = true,
            AccionesOrigen = new List<WorkflowAccion> { accion }
        };
        var workflow = new Workflow
        {
            IdWorkflow = 5,
            Nombre = "Permisos",
            CodigoProceso = "SOLICITUD_PERSONAL",
            Activo = true,
            Pasos = new List<WorkflowPaso> { paso }
        };

        var resolver = new Mock<IWorkflowResolver>();
        resolver
            .Setup(r => r.ResolveWorkflowIdAsync(It.IsAny<string>(), It.IsAny<Dictionary<string, int?>>()))
            .ReturnsAsync(workflow);

        var firmas = new Mock<ISolicitudPersonalFirmasService>();
        firmas
            .Setup(f => f.FirmarAsync(It.IsAny<int>(), It.IsAny<FirmarRequest>(), It.IsAny<int>()))
            .ReturnsAsync(new FirmarResponse { Exitoso = true });

        return (resolver, firmas, accion);
    }

    private static (SolicitudPersonalService Service, Mock<ISolicitudPersonalFirmasService> Firmas) PrepararCreateConHandlerDocumento(
        ApplicationDbContext context,
        string? configuracionJson)
    {
        const int idTipo = 7;
        const int idAccion = 176;

        var (resolver, firmas, _) = PrepararWorkflowConEnviar(idAccion);

        context.WorkflowEstados.Add(new WorkflowEstados
        {
            IdEstado = 1,
            Codigo = "CREADA",
            Nombre = "Creada",
            Activo = true
        });
        context.WorkflowAccionHandlers.Add(new WorkflowAccionHandler
        {
            IdHandler = 1,
            IdAccion = idAccion,
            HandlerKey = "Archivo",
            Requerido = true,
            Activo = true,
            ConfiguracionJson = configuracionJson
        });
        context.SaveChanges();

        var tipo = new TipoSolicitud
        {
            IdTipoSolicitud = idTipo,
            Nombre = "Permiso sin goce",
            Descripcion = "Permiso sin goce",
            Clave = "permiso-sin-goce",
            Categoria = CategoriaSolicitud.Permiso,
            Activo = true,
            PermiteFechasPasadas = true,
            PermiteFechasFuturas = true
        };
        var tipoRepository = new Mock<ITipoSolicitudRepository>();
        tipoRepository.Setup(r => r.GetByIdAsync(idTipo)).ReturnsAsync(tipo);

        var adminRepository = new Mock<IAdminRepository>();
        adminRepository
            .Setup(r => r.GetUsuarioDetalleAsync(It.IsAny<int>()))
            .ReturnsAsync(new UsuarioDetalle { IdUsuario = 1, IdEmpresa = 1, IdSucursal = 1, IdArea = 1 });

        var profileService = new Mock<IProfileService>();
        profileService
            .Setup(p => p.HasFirmaAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var service = CreateService(
            context,
            tipoRepository: tipoRepository.Object,
            workflowResolver: resolver.Object,
            firmasService: firmas.Object,
            adminRepository: adminRepository.Object,
            profileService: profileService.Object);

        return (service, firmas);
    }

    private static CreateSolicitudPersonalRequest RequestPermiso(int idTipo = 7) => new()
    {
        IdTipoSolicitud = idTipo,
        Motivo = "Motivo de prueba con mas de diez caracteres",
        Detalle = new List<SolicitudPersonalDetalleDto> { new() { Fecha = DateTime.Today.AddDays(1) } }
    };

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
                        new() { GeneraDescuento = true, GeneraDescuentoTeorico = true }
                    }
                }
            });

        context.IncidenciasChecadoConfig.Add(new IncidenciaChecadoConfig
        {
            IdConfig = 1,
            Nombre = "Retardo de entrada menor a 20 min",
            Descripcion = "Retardo de entrada menor a 20 min",
            TipoIncidencia = "TARDANZA_ENTRADA",
            CantidadAcumulada = 3,
            Periodo = "mes",
            Prioridad = 10,
            Activo = true
        });
        await context.SaveChangesAsync();

        var service = CreateService(
            context, tipoRepoMock.Object, empleadoRepoMock.Object, incidenciasServiceMock.Object);

        var result = await service.ObtenerLimitesSolicitudesAsync(idUsuario, idUsuario, true);

        result.IsError.Should().BeFalse();
        var descuentos = result.Value.LimitesPorTipo
            .Where(l => l.Tipo == "Descuentos justificados")
            .ToList();
        descuentos.Should().HaveCount(2);
        descuentos.Should().OnlyContain(l => l.Limite == 2);
        result.Value.ReglasDescuento.Should().Be(
            "Cada 3 \"Retardo de entrada menor a 20 min\" en el mes generan 1 descuento.");

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
                new() { GeneraDescuento = generaDescuento, GeneraDescuentoTeorico = generaDescuento }
            }
        };

    private static IncidenciaChecadoResponse IncidenciaDoble(DateTime fecha, bool justificada = false)
        => new()
        {
            Fecha = fecha,
            Nomina = 999,
            Justificada = justificada,
            IncidenciasCalculadas = new List<IncidenciaCalculadaDto>
            {
                new() { GeneraDescuentoTeorico = true },
                new() { GeneraDescuentoTeorico = true }
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

    private static (SolicitudPersonalService Service, Mock<ISolicitudPersonalFirmasService> Firmas) PrepararCreateVacaciones(
        ApplicationDbContext context)
    {
        const int idTipo = 11;
        const int idAccion = 200;

        var (resolver, firmas, _) = PrepararWorkflowConEnviar(idAccion);

        context.WorkflowEstados.Add(new WorkflowEstados
        {
            IdEstado = 1,
            Codigo = "CREADA",
            Nombre = "Creada",
            Activo = true
        });
        context.SaveChanges();

        var tipo = new TipoSolicitud
        {
            IdTipoSolicitud = idTipo,
            Nombre = "Vacaciones",
            Descripcion = "Vacaciones",
            Clave = "vacaciones",
            Categoria = CategoriaSolicitud.Vacaciones,
            Activo = true,
            RequiereFechaFin = true,
            PermiteFechasPasadas = true,
            PermiteFechasFuturas = true
        };
        var tipoRepository = new Mock<ITipoSolicitudRepository>();
        tipoRepository.Setup(r => r.GetByIdAsync(idTipo)).ReturnsAsync(tipo);

        var adminRepository = new Mock<IAdminRepository>();
        adminRepository
            .Setup(r => r.GetUsuarioDetalleAsync(It.IsAny<int>()))
            .ReturnsAsync(new UsuarioDetalle { IdUsuario = 1, IdEmpresa = 1, IdSucursal = 1, IdArea = 1 });

        var profileService = new Mock<IProfileService>();
        profileService
            .Setup(p => p.HasFirmaAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var service = CreateService(
            context,
            tipoRepository: tipoRepository.Object,
            workflowResolver: resolver.Object,
            firmasService: firmas.Object,
            adminRepository: adminRepository.Object,
            profileService: profileService.Object);

        return (service, firmas);
    }

    private static CreateSolicitudPersonalRequest RequestVacaciones(DateTime inicio, DateTime fin) => new()
    {
        IdTipoSolicitud = 11,
        Motivo = "Motivo de prueba con mas de diez caracteres",
        FechaInicio = inicio,
        FechaFin = fin
    };

    [Fact]
    public async Task CreateAsync_Vacaciones_Sin_Saldo_Retorna_Exito()
    {
        var context = CreateInMemoryContext();
        var (service, _) = PrepararCreateVacaciones(context);

        var anio = DateTime.Now.Year;
        var result = await service.CreateAsync(
            RequestVacaciones(new DateTime(anio, 1, 1), new DateTime(anio, 1, 5)),
            idUsuario: 1, puedeCrearParaOtro: false);

        result.IsError.Should().BeFalse();
    }

    [Fact]
    public async Task CreateAsync_Vacaciones_Con_Saldo_Insuficiente_Retorna_Exito()
    {
        var context = CreateInMemoryContext();
        var anio = DateTime.Now.Year;

        context.SaldosVacacionesAnuales.Add(new SaldoVacacionesAnual
        {
            IdUsuario = 1,
            IdEmpresa = 1,
            Anio = anio,
            DiasGenerados = 3,
            DiasPendientes = 3,
            Activo = true
        });
        await context.SaveChangesAsync();

        var (service, _) = PrepararCreateVacaciones(context);

        var result = await service.CreateAsync(
            RequestVacaciones(new DateTime(anio, 1, 1), new DateTime(anio, 1, 10)),
            idUsuario: 1, puedeCrearParaOtro: false);

        result.IsError.Should().BeFalse();
    }

    [Fact]
    public async Task GetByIdAsync_Vacaciones_Adjunta_Bloque_De_Saldo_Con_Negativo()
    {
        var context = CreateInMemoryContext();
        var anio = DateTime.Now.Year;

        context.SaldosVacacionesAnuales.Add(new SaldoVacacionesAnual
        {
            IdUsuario = 123,
            IdEmpresa = 1,
            Anio = anio,
            DiasGenerados = 2,
            DiasPendientes = 2,
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

        var solicitud = new SolicitudPersonal
        {
            IdSolicitud = 9,
            Folio = "SOL-9",
            IdEmpresa = 1,
            IdSucursal = 1,
            IdUsuarioCreador = 123,
            IdUsuarioSolicitante = 123,
            IdTipoSolicitud = 11,
            FechaInicio = new DateTime(anio, 1, 1),
            FechaFin = new DateTime(anio, 1, 5),
            FechaCreacion = DateTime.Now
        };

        var repository = new Mock<ISolicitudPersonalRepository>();
        repository.Setup(r => r.GetWithDetalleAsync(9)).ReturnsAsync(solicitud);

        var tipo = new TipoSolicitud
        {
            IdTipoSolicitud = 11,
            Nombre = "Vacaciones",
            Clave = "vacaciones",
            Categoria = CategoriaSolicitud.Vacaciones,
            Activo = true
        };
        var tipoRepository = new Mock<ITipoSolicitudRepository>();
        tipoRepository.Setup(r => r.GetByIdAsync(11)).ReturnsAsync(tipo);

        var service = CreateService(context, tipoRepository: tipoRepository.Object, repository: repository.Object);

        var result = await service.GetByIdAsync(9);

        result.IsError.Should().BeFalse();
        var saldo = result.Value.SaldoVacaciones;
        saldo.Should().NotBeNull();
        saldo!.DiasQueDescuentan.Should().Be(4);
        saldo.DiasPendientes.Should().Be(2);
        saldo.SaldoResultante.Should().Be(-2);
        saldo.QuedaNegativo.Should().BeTrue();
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
    public async Task ValidarDescuentos_Un_Dia_Con_Dos_Incidencias_Cuenta_Como_Un_Solo_Justificante()
    {
        var context = CreateInMemoryContext();
        var idUsuario = 123;
        var mes = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1);

        // Día 1 justificado con omisión de entrada + salida (2 incidencias) y día 2 igual:
        // al contar por día son 2 justificantes, dentro del tope de 2.
        var service = CreateService(
            context,
            empleadoRepository: MockEmpleado(),
            incidenciasChecadoService: MockIncidencias(
                IncidenciaDoble(mes.AddDays(1), justificada: true),
                IncidenciaDoble(mes.AddDays(2))));

        var result = await ValidarDescuentosAsync(service, idUsuario, new[] { mes.AddDays(2) });

        result.IsError.Should().BeFalse();
    }

    [Fact]
    public async Task ValidarDescuentos_Tres_Dias_Con_Descuento_Exceden_El_Tope()
    {
        var context = CreateInMemoryContext();
        var idUsuario = 123;
        var mes = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1);

        var service = CreateService(
            context,
            empleadoRepository: MockEmpleado(),
            incidenciasChecadoService: MockIncidencias(
                IncidenciaDoble(mes.AddDays(1), justificada: true),
                IncidenciaDoble(mes.AddDays(2)),
                IncidenciaDoble(mes.AddDays(3))));

        var result = await ValidarDescuentosAsync(
            service, idUsuario, new[] { mes.AddDays(2), mes.AddDays(3) });

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

    [Fact]
    public async Task CreateAsync_AutoEnvia_Cuando_HandlerDocumento_NoAplica_AlTipo()
    {
        var context = CreateInMemoryContext();
        var (service, firmas) = PrepararCreateConHandlerDocumento(
            context, """{"aplica":{"tipoSolicitud":[999]}}""");

        var result = await service.CreateAsync(RequestPermiso(), idUsuario: 1, puedeCrearParaOtro: false);

        result.IsError.Should().BeFalse();
        firmas.Verify(
            f => f.FirmarAsync(It.IsAny<int>(), It.IsAny<FirmarRequest>(), It.IsAny<int>()),
            Times.Once);
    }

    [Fact]
    public async Task CreateAsync_NoAutoEnvia_Cuando_HandlerDocumento_Aplica_AlTipo()
    {
        var context = CreateInMemoryContext();
        var (service, firmas) = PrepararCreateConHandlerDocumento(
            context, """{"aplica":{"tipoSolicitud":[7]}}""");

        var result = await service.CreateAsync(RequestPermiso(), idUsuario: 1, puedeCrearParaOtro: false);

        result.IsError.Should().BeFalse();
        firmas.Verify(
            f => f.FirmarAsync(It.IsAny<int>(), It.IsAny<FirmarRequest>(), It.IsAny<int>()),
            Times.Never);
    }

    [Fact]
    public async Task CreateAsync_NoAutoEnvia_Cuando_HandlerDocumento_SinCondiciones()
    {
        var context = CreateInMemoryContext();
        var (service, firmas) = PrepararCreateConHandlerDocumento(context, configuracionJson: null);

        var result = await service.CreateAsync(RequestPermiso(), idUsuario: 1, puedeCrearParaOtro: false);

        result.IsError.Should().BeFalse();
        firmas.Verify(
            f => f.FirmarAsync(It.IsAny<int>(), It.IsAny<FirmarRequest>(), It.IsAny<int>()),
            Times.Never);
    }
}
