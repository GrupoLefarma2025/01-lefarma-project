using FluentAssertions;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.ValueObjects.Config;
using Lefarma.API.Features.Config.Engine;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace Lefarma.UnitTests.Features.Config.Engine;

public class WorkflowEngineAutoSkipTests
{
    private class EntidadPrueba : IWorkflowEntity
    {
        public int Id { get; set; } = 1;
        public int IdWorkflow { get; set; } = 1;
        public int? IdPasoActual { get; set; } = 10;
        public int IdEstado { get; set; } = 1;
        public int IdUsuarioCreador { get; set; } = 55;
        public string ObtenerTipoEntidad() => "ORDEN_COMPRA";
    }

    private static (ApplicationDbContext app, AsokamDbContext asokam) CrearContextos()
    {
        var app = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var asokam = new AsokamDbContext(new DbContextOptionsBuilder<AsokamDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        return (app, asokam);
    }

    private static void SembrarWorkflow(ApplicationDbContext ctx, bool pasoMixto = false)
    {
        ctx.Workflows.Add(new Workflow { IdWorkflow = 1, Nombre = "Test", CodigoProceso = "ORDEN_COMPRA", Activo = true });
        ctx.WorkflowPasos.AddRange(
            new WorkflowPaso { IdPaso = 10, IdWorkflow = 1, Orden = 1, NombrePaso = "Inicio", EsInicio = true, Activo = true },
            new WorkflowPaso { IdPaso = 20, IdWorkflow = 1, Orden = 2, NombrePaso = "Gerente", Activo = true },
            new WorkflowPaso { IdPaso = 30, IdWorkflow = 1, Orden = 3, NombrePaso = "Fin", EsFinal = true, Activo = true });

        ctx.WorkflowAcciones.AddRange(
            new WorkflowAccion { IdAccion = 100, IdPasoOrigen = 10, IdPasoDestino = 20, IdTipoAccion = 1, Activo = true },
            new WorkflowAccion { IdAccion = 200, IdPasoOrigen = 20, IdPasoDestino = 30, IdTipoAccion = 1, Activo = true });

        ctx.WorkflowParticipantes.Add(new WorkflowParticipante
        { IdParticipante = 1, IdPaso = 20, RequiereJefeInmediato = true, NivelJefe = 2, Activo = true });

        if (pasoMixto)
            ctx.WorkflowParticipantes.Add(new WorkflowParticipante
            { IdParticipante = 2, IdPaso = 20, IdUsuario = 99, Activo = true });

        ctx.SaveChanges();
    }

    private static WorkflowEngine CrearEngine(
        ApplicationDbContext app, AsokamDbContext asokam, IJefeInmediatoResolver resolver)
    {
        var repoMock = new Mock<IWorkflowRepository>();
        repoMock.Setup(r => r.GetQueryable()).Returns(app.Workflows);

        return new WorkflowEngine(repoMock.Object, app, asokam, Mock.Of<IServiceProvider>(), resolver);
    }

    private static WorkflowContext CrearCtx()
        => new(IdWorkflow: 1, IdEntidad: 1, TipoEntidad: "ORDEN_COMPRA",
               Entidad: new EntidadPrueba(), IdAccion: 100, IdUsuario: 55,
               Orden: null!, Comentario: null);

    private static Mock<IJefeInmediatoResolver> ResolverMock(JefeEfectivoResult resultado)
    {
        var mock = new Mock<IJefeInmediatoResolver>();
        mock.Setup(r => r.ResolverJefeEfectivoAsync(
                It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(resultado);
        return mock;
    }

    [Fact]
    public async Task Nivel_No_Aplica_Paso_Se_Omite_Y_Queda_En_Bitacora()
    {
        var (app, asokam) = CrearContextos();
        SembrarWorkflow(app);
        var engine = CrearEngine(app, asokam,
            ResolverMock(new JefeEfectivoResult(null, MotivoOmisionJefe.ConfigNoAplica)).Object);

        var resultado = await engine.EjecutarAccionAsync(CrearCtx());

        resultado.Exitoso.Should().BeTrue();
        resultado.NuevoIdPaso.Should().Be(30); // saltó el paso 20

        var omision = app.WorkflowBitacoras.Local
            .FirstOrDefault(b => b.Comentario != null && b.Comentario.Contains("omitido"));
        omision.Should().NotBeNull();
        omision!.DatosSnapshot.Should().Contain("omisionAutomatica");
        omision.DatosSnapshot.Should().Contain("ConfigNoAplica");
    }

    [Fact]
    public async Task Jefe_Excluido_Paso_Se_Omite_Con_Motivo_Excluido()
    {
        var (app, asokam) = CrearContextos();
        SembrarWorkflow(app);
        var engine = CrearEngine(app, asokam,
            ResolverMock(new JefeEfectivoResult(null, MotivoOmisionJefe.Excluido)).Object);

        var resultado = await engine.EjecutarAccionAsync(CrearCtx());

        resultado.Exitoso.Should().BeTrue();
        resultado.NuevoIdPaso.Should().Be(30);

        var omision = app.WorkflowBitacoras.Local
            .FirstOrDefault(b => b.Comentario != null && b.Comentario.Contains("omitido"));
        omision.Should().NotBeNull();
        omision!.DatosSnapshot.Should().Contain("Excluido");
    }

    [Fact]
    public async Task Nivel_Con_Jefe_Efectivo_Paso_NO_Se_Omite()
    {
        var (app, asokam) = CrearContextos();
        SembrarWorkflow(app);
        var engine = CrearEngine(app, asokam,
            ResolverMock(new JefeEfectivoResult(88, null)).Object);

        var resultado = await engine.EjecutarAccionAsync(CrearCtx());

        resultado.Exitoso.Should().BeTrue();
        resultado.NuevoIdPaso.Should().Be(20); // se detiene en el paso del gerente
    }

    [Fact]
    public async Task Paso_Mixto_Nunca_Se_Omite()
    {
        var (app, asokam) = CrearContextos();
        SembrarWorkflow(app, pasoMixto: true);
        var engine = CrearEngine(app, asokam,
            ResolverMock(new JefeEfectivoResult(null, MotivoOmisionJefe.ConfigNoAplica)).Object);

        var resultado = await engine.EjecutarAccionAsync(CrearCtx());

        resultado.Exitoso.Should().BeTrue();
        resultado.NuevoIdPaso.Should().Be(20); // el participante directo 99 conserva el paso
    }
}
