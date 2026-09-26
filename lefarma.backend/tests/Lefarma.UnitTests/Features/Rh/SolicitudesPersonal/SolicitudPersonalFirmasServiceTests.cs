using System.Reflection;
using System.Text.Json;
using ErrorOr;
using FluentAssertions;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Config.Workflows;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.Profile;
using Lefarma.API.Features.Rh.SolicitudesPersonal;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Logging;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace Lefarma.UnitTests.Features.Rh.SolicitudesPersonal;

public class SolicitudPersonalFirmasServiceTests
{
    private static ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
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

    private static Mock<ITipoSolicitudRepository> CreateTipoRepositoryMock()
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
        return tipoRepository;
    }

    private static SolicitudPersonalFirmasService CreateService(ApplicationDbContext context)
        => CreateService(
            context,
            CreateAsokamInMemoryContext(),
            Mock.Of<ISolicitudPersonalRepository>(),
            CreateTipoRepositoryMock().Object,
            Mock.Of<IWorkflowEngine>(),
            Mock.Of<IWorkflowRepository>(),
            Mock.Of<IWorkflowQueryService>(),
            Mock.Of<IProfileService>());

    private static SolicitudPersonalFirmasService CreateService(
        ApplicationDbContext context,
        AsokamDbContext asokam,
        ISolicitudPersonalRepository solicitudRepo,
        ITipoSolicitudRepository tipoRepository,
        IWorkflowEngine engine,
        IWorkflowRepository workflowRepo,
        IWorkflowQueryService queryService,
        IProfileService profileService,
        IWideEventAccessor? wideEventAccessor = null)
        => new(
            context,
            asokam,
            solicitudRepo,
            tipoRepository,
            engine,
            workflowRepo,
            queryService,
            Mock.Of<IServiceScopeFactory>(),
            Mock.Of<IJefeInmediatoResolver>(),
            profileService,
            wideEventAccessor ?? Mock.Of<IWideEventAccessor>());

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

    [Fact]
    public async Task EnviarDirector_Guarda_Envio_Y_Documento_Con_Interfase_En_Asokam()
    {
        var context = CreateInMemoryContext();
        var asokam = CreateAsokamInMemoryContext();

        context.WorkflowTiposAccion.Add(new WorkflowTipoAccion
        {
            IdTipoAccion = 1,
            Codigo = "ENVIAR_DIRECTOR",
            Nombre = "Enviar al director",
            CodigoProceso = "SOLICITUD_PERSONAL",
            Activo = true
        });
        context.WorkflowAcciones.Add(new WorkflowAccion
        {
            IdAccion = 100,
            IdPasoOrigen = 10,
            IdTipoAccion = 1,
            Activo = true
        });
        context.WorkflowPasos.Add(new WorkflowPaso
        {
            IdPaso = 10,
            IdWorkflow = 1,
            Orden = 1,
            NombrePaso = "Inicio",
            EsInicio = true,
            Activo = true,
            RequiereAdjunto = false
        });
        context.Workflows.Add(new Workflow
        {
            IdWorkflow = 1,
            Nombre = "SP",
            CodigoProceso = "SOLICITUD_PERSONAL",
            Activo = true,
            Version = 1,
            FechaCreacion = DateTime.Now
        });
        var solicitud = new SolicitudPersonal
        {
            IdSolicitud = 1,
            Folio = "SOL-1",
            IdEmpresa = 1,
            IdSucursal = 1,
            IdUsuarioCreador = 123,
            IdUsuarioSolicitante = 123,
            IdEstado = 1,
            IdWorkflow = 1,
            IdPasoActual = 10,
            IdTipoSolicitud = 11,
            FechaCreacion = DateTime.Now
        };
        context.SolicitudesPersonal.Add(solicitud);
        await context.SaveChangesAsync();

        var solicitudRepo = new Mock<ISolicitudPersonalRepository>();
        solicitudRepo.Setup(r => r.GetByIdAsync(It.IsAny<int>())).ReturnsAsync(solicitud);

        var engine = new Mock<IWorkflowEngine>();
        engine.Setup(e => e.EjecutarAccionAsync(It.IsAny<WorkflowContext>()))
            .ReturnsAsync(new WorkflowEjecucionResult(
                Exitoso: true, Error: null, NuevoIdPaso: 10, NuevoIdEstado: null));

        var workflowRepo = new Mock<IWorkflowRepository>();
        workflowRepo.Setup(r => r.GetQueryable()).Returns(context.Workflows);

        var queryService = new Mock<IWorkflowQueryService>();
        queryService.Setup(q => q.GetAccionesDisponiblesAsync(
                It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<string>(),
                It.IsAny<IWorkflowEntity>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<AccionDisponibleResponse>
            {
                new() { IdAccion = 100, IdTipoAccion = 1, TipoAccionCodigo = "ENVIAR_DIRECTOR" }
            });

        var profileService = new Mock<IProfileService>();
        profileService.Setup(p => p.HasFirmaAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var wideEvent = new WideEvent();
        var wideEventAccessor = new Mock<IWideEventAccessor>();
        wideEventAccessor.Setup(a => a.Current).Returns(wideEvent);

        var service = CreateService(
            context, asokam, solicitudRepo.Object, CreateTipoRepositoryMock().Object,
            engine.Object, workflowRepo.Object, queryService.Object, profileService.Object,
            wideEventAccessor.Object);

        var pdfBytes = new byte[] { 0x25, 0x50, 0x44, 0x46 };
        var archivo = new Mock<IFormFile>();
        archivo.Setup(f => f.FileName).Returns("SOL-1.pdf");
        archivo.Setup(f => f.Length).Returns(pdfBytes.Length);
        archivo.Setup(f => f.CopyToAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
            .Returns<Stream, CancellationToken>((stream, _) =>
            {
                stream.Write(pdfBytes, 0, pdfBytes.Length);
                return Task.CompletedTask;
            });

        var result = await service.EnviarDirectorAsync(1, new EnviarDirectorRequest
        {
            IdAccion = 100,
            Comentario = "Envío de prueba",
            ArchivoPdf = archivo.Object
        }, idUsuario: 123);

        result.IsError.Should().BeFalse(
            $"errores: {string.Join(" | ", result.Errors.Select(e => $"{e.Code}: {e.Description}"))}; " +
            $"wideEvent: {JsonSerializer.Serialize(wideEvent.AdditionalContext)}");
        result.Value.Folio.Should().Be("SOL-1");
        result.Value.Estado.Should().Be("PENDIENTE");

        var envio = context.EnviosSolicitudes.Single();
        envio.IdSolicitud.Should().Be(1);
        envio.Estado.Should().Be("PENDIENTE");
        envio.TokenSeguridad.Should().NotBeNullOrEmpty();
        result.Value.IdEnvio.Should().Be(envio.IdEnvio);

        var documento = asokam.Documentos.Single();
        documento.NombreArchivo.Should().Be("SOL-1.pdf");
        documento.TamanoBytes.Should().Be(pdfBytes.Length);
        documento.PDFBinario.Should().Equal(pdfBytes);

        var interfase = asokam.DocumentosInterfaseSolicitud.Single();
        interfase.IdDocumentoFirmar.Should().Be(documento.Id);
        interfase.IdEnvio.Should().Be(envio.IdEnvio);
    }

    [Fact]
    public async Task ProcesarRespuesta_Autorizar_Ejecuta_Accion_AUTORIZAR()
    {
        var context = CreateInMemoryContext();
        var asokam = CreateAsokamInMemoryContext();

        context.WorkflowTiposAccion.Add(new WorkflowTipoAccion
        {
            IdTipoAccion = 2,
            Codigo = "AUTORIZAR",
            Nombre = "Autorizar",
            CodigoProceso = "SOLICITUD_PERSONAL",
            Activo = true
        });
        context.WorkflowAcciones.Add(new WorkflowAccion
        {
            IdAccion = 200,
            IdPasoOrigen = 10,
            IdTipoAccion = 2,
            Activo = true
        });
        context.WorkflowPasos.Add(new WorkflowPaso
        {
            IdPaso = 10,
            IdWorkflow = 1,
            Orden = 1,
            NombrePaso = "Aprobación Dirección Corporativa",
            EsInicio = true,
            Activo = true,
            RequiereAdjunto = false
        });
        context.Workflows.Add(new Workflow
        {
            IdWorkflow = 1,
            Nombre = "Vacaciones Especiales",
            CodigoProceso = "SOLICITUD_PERSONAL",
            Activo = true,
            Version = 1,
            FechaCreacion = DateTime.Now
        });
        var solicitud = new SolicitudPersonal
        {
            IdSolicitud = 1,
            Folio = "SOL-1",
            IdEmpresa = 1,
            IdSucursal = 1,
            IdUsuarioCreador = 123,
            IdUsuarioSolicitante = 123,
            IdEstado = 1,
            IdWorkflow = 1,
            IdPasoActual = 10,
            IdTipoSolicitud = 11,
            FechaCreacion = DateTime.Now
        };
        context.SolicitudesPersonal.Add(solicitud);
        var envio = new EnvioSolicitud
        {
            IdSolicitud = 1,
            IdUsuarioEnvio = 123,
            IdUsuarioSolicitante = 123,
            IdTipoSolicitud = 11,
            Estado = "PENDIENTE",
            TokenSeguridad = "token-prueba",
            FechaEnvio = DateTime.Now,
            FechaCreacion = DateTime.Now,
            Activo = true
        };
        context.EnviosSolicitudes.Add(envio);
        await context.SaveChangesAsync();

        var solicitudRepo = new Mock<ISolicitudPersonalRepository>();
        solicitudRepo.Setup(r => r.GetByIdAsync(It.IsAny<int>())).ReturnsAsync(solicitud);

        var engine = new Mock<IWorkflowEngine>();
        engine.Setup(e => e.EjecutarAccionAsync(It.IsAny<WorkflowContext>()))
            .ReturnsAsync(new WorkflowEjecucionResult(
                Exitoso: true, Error: null, NuevoIdPaso: 10, NuevoIdEstado: null));

        var workflowRepo = new Mock<IWorkflowRepository>();
        workflowRepo.Setup(r => r.GetQueryable()).Returns(context.Workflows);

        var queryService = new Mock<IWorkflowQueryService>();
        queryService.Setup(q => q.GetAccionesDisponiblesAsync(
                It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<string>(),
                It.IsAny<IWorkflowEntity>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<AccionDisponibleResponse>
            {
                new() { IdAccion = 200, IdTipoAccion = 2, TipoAccionCodigo = "AUTORIZAR" }
            });

        var profileService = new Mock<IProfileService>();
        profileService.Setup(p => p.HasFirmaAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var service = CreateService(
            context, asokam, solicitudRepo.Object, CreateTipoRepositoryMock().Object,
            engine.Object, workflowRepo.Object, queryService.Object, profileService.Object);

        var result = await service.ProcesarRespuestaAsync(new RespuestaSolicitudPersonalExternaRequest
        {
            IdEnvio = envio.IdEnvio,
            TokenSeguridad = "token-prueba",
            IdUsuario = 123,
            Accion = "AUTORIZAR",
            Comentario = "Aprobado por dirección"
        });

        result.IsError.Should().BeFalse(
            $"errores: {string.Join(" | ", result.Errors.Select(e => $"{e.Code}: {e.Description}"))}");
        engine.Verify(e => e.EjecutarAccionAsync(
            It.Is<WorkflowContext>(c => c.IdAccion == 200)), Times.Once);

        var envioActualizado = context.EnviosSolicitudes.Single();
        envioActualizado.Estado.Should().Be("APROBADO");
        envioActualizado.FechaRespuesta.Should().NotBeNull();
    }
}
