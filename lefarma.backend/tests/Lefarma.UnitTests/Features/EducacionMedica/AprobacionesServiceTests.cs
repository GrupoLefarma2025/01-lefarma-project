using ErrorOr;
using FluentAssertions;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.Config.Workflows;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.EducacionMedica;
using Moq;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class AprobacionesServiceTests
{
    private static (
        AprobacionesService servicio,
        WorkflowTestHarness workflow,
        int idSelPendiente,
        int idSelBorrador)
        CrearEscenario()
    {
        var workflow = WorkflowTestHarness.Crear();
        var contexto = workflow.Context;

        var selPendiente = new SeleccionMensual
        {
            FechaSeleccion = new DateOnly(2026, 8, 15),
            Estado = SeleccionMensual.EstadoEnRevision,
            IdWorkflow = workflow.WfSeleccion.IdWorkflow,
            IdPasoActual = workflow.PasosSeleccion["Gg"],
            IdUsuarioCreacion = 99,
            Activo = true,
        };
        var selBorrador = new SeleccionMensual
        {
            FechaSeleccion = new DateOnly(2026, 9, 15),
            Estado = SeleccionMensual.EstadoBorrador,
            IdWorkflow = workflow.WfSeleccion.IdWorkflow,
            IdPasoActual = workflow.PasosSeleccion["Inicio"],
            IdUsuarioCreacion = 55,
            Activo = true,
        };
        contexto.SeleccionesMensuales.AddRange(selPendiente, selBorrador);
        contexto.SaveChanges();

        var verPendiente = new RutaVersion
        {
            IdSeleccionMensual = selPendiente.IdSeleccionMensual,
            Version = 1,
            Estado = RutaVersion.EstadoDraft,
            IdWorkflow = workflow.WfRutas.IdWorkflow,
            IdPasoActual = workflow.PasosRutas["Ca"],
            IdUsuarioCreacion = 99,
        };
        var verConfirmada = new RutaVersion
        {
            IdSeleccionMensual = selPendiente.IdSeleccionMensual,
            Version = 2,
            Estado = RutaVersion.EstadoConfirmada,
            IdWorkflow = workflow.WfRutas.IdWorkflow,
            IdPasoActual = workflow.PasosRutas["Final"],
            IdUsuarioCreacion = 99,
        };
        contexto.RutasVersiones.AddRange(verPendiente, verConfirmada);
        contexto.SaveChanges();

        // El query service (mock) devuelve una acción SOLO en pasos "de firma" (Gg y Ca)
        var pasosConAccion = new HashSet<int>
        {
            workflow.PasosSeleccion["Gg"],
            workflow.PasosRutas["Ca"],
        };

        var queryMock = new Mock<IWorkflowQueryService>();
        queryMock
            .Setup(q => q.GetAccionesDisponiblesAsync(
                It.IsAny<int>(),
                It.IsAny<int>(),
                It.IsAny<int>(),
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<Lefarma.API.Domain.Interfaces.Config.IWorkflowEntity>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((int _, int _, int idPasoActual, int _, string _, Lefarma.API.Domain.Interfaces.Config.IWorkflowEntity _, CancellationToken _) =>
            {
                if (!pasosConAccion.Contains(idPasoActual))
                {
                    return ErrorOrFactory.From<IEnumerable<AccionDisponibleResponse>>([]);
                }

                return ErrorOrFactory.From<IEnumerable<AccionDisponibleResponse>>(
                [
                    new AccionDisponibleResponse
                    {
                        IdAccion = 1000 + idPasoActual,
                        IdTipoAccion = 1,
                        TipoAccionCodigo = "AUTORIZAR",
                        TipoAccionNombre = "Autorizar",
                    },
                ]);
            });

        var servicio = new AprobacionesService(contexto, workflow.Asokam, queryMock.Object);
        return (servicio, workflow, selPendiente.IdSeleccionMensual, selBorrador.IdSeleccionMensual);
    }

    [Fact]
    public async Task GetDocumentosAsync_FiltroPendientes_Debe_DevolverSoloFirmasConAccionesDelUsuario()
    {
        var (servicio, _, idSelPendiente, _) = CrearEscenario();

        var documentos = await servicio.GetDocumentosAsync(idUsuario: 99, filtro: "pendientes");

        documentos.Should().HaveCount(2);
        documentos.Should().OnlyContain(d => d.Acciones.Count == 1);
        documentos.Should().Contain(d => d.Tipo == "seleccion" && d.IdEntidad == idSelPendiente);
        documentos.Should().Contain(d => d.Tipo == "rutas");
    }

    [Fact]
    public async Task GetDocumentosAsync_FiltroMios_Debe_FiltrarPorCreador()
    {
        var (servicio, _, idSelPendiente, idSelBorrador) = CrearEscenario();

        var documentos = await servicio.GetDocumentosAsync(idUsuario: 99, filtro: "mios");

        documentos.Should().HaveCount(3);
        documentos.Should().NotContain(d => d.Tipo == "seleccion" && d.IdEntidad == idSelBorrador);
        documentos.Where(d => d.Tipo == "seleccion").Should().ContainSingle()
            .Which.IdEntidad.Should().Be(idSelPendiente);
    }

    [Fact]
    public async Task GetDocumentosAsync_FiltroTodos_Debe_DevolverTodosConAccionesCalculadas()
    {
        var (servicio, _, _, _) = CrearEscenario();

        var documentos = await servicio.GetDocumentosAsync(idUsuario: 99, filtro: "todos");

        documentos.Should().HaveCount(4);
        documentos.Count(d => d.Acciones.Count > 0).Should().Be(2);
        documentos.Count(d => d.Acciones.Count == 0).Should().Be(2);

        // El nombre del paso se resuelve también para pasos de inicio/fin (no solo "de firma").
        documentos.Should().Contain(d =>
            d.Tipo == "seleccion" && d.Estado == SeleccionMensual.EstadoBorrador && d.PasoNombre == "Borrador");
        documentos.Should().Contain(d =>
            d.Tipo == "rutas" && d.Estado == RutaVersion.EstadoConfirmada && d.PasoNombre == "Confirmada");
    }

    [Fact]
    public async Task GetDocumentosAsync_FiltroInvalido_Debe_UsarPendientes()
    {
        var (servicio, _, _, _) = CrearEscenario();

        var documentos = await servicio.GetDocumentosAsync(idUsuario: 99, filtro: "lo-que-sea");

        documentos.Should().HaveCount(2);
        documentos.Should().OnlyContain(d => d.Acciones.Count > 0);
    }

    private static (
        AprobacionesService servicio,
        WorkflowTestHarness workflow,
        int idMatrizPendiente)
        CrearEscenarioConMatriz()
    {
        var workflow = WorkflowTestHarness.Crear();
        var contexto = workflow.Context;

        contexto.TiposGerencia.Add(new TipoGerencia { IdTipoGerencia = 1, Descripcion = "IMSS", Activo = true });
        // FK requerida de matrices_generales: sin el catálogo, el Include(TipoGerencia) actúa como inner join en InMemory
        contexto.TiposGerencia.Add(new TipoGerencia { IdTipoGerencia = 2, Descripcion = "Descentralizado", Activo = true });
        contexto.SaveChanges();

        var matrizPendiente = new MatrizGeneral
        {
            IdTipoGerencia = 1,
            Periodo = new DateOnly(2026, 10, 1),
            IdWorkflow = workflow.WfMatriz.IdWorkflow,
            IdPasoActual = workflow.PasosMatriz["Aem"],
            IdUsuarioCreacion = 99,
        };
        var matrizEnInicio = new MatrizGeneral
        {
            IdTipoGerencia = 2,
            Periodo = new DateOnly(2026, 10, 1),
            IdWorkflow = workflow.WfMatrizDesc.IdWorkflow,
            IdPasoActual = workflow.WfMatrizDesc.Pasos.First(p => p.EsInicio).IdPaso,
            IdUsuarioCreacion = 55,
        };
        contexto.MatricesGenerales.AddRange(matrizPendiente, matrizEnInicio);
        contexto.SaveChanges();

        // El query service (mock) devuelve una acción SOLO en el paso del AEM (pendiente)
        var pasosConAccion = new HashSet<int> { workflow.PasosMatriz["Aem"] };
        var queryMock = new Mock<IWorkflowQueryService>();
        queryMock
            .Setup(q => q.GetAccionesDisponiblesAsync(
                It.IsAny<int>(),
                It.IsAny<int>(),
                It.IsAny<int>(),
                It.IsAny<int>(),
                It.IsAny<string>(),
                It.IsAny<Lefarma.API.Domain.Interfaces.Config.IWorkflowEntity>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((int _, int _, int idPasoActual, int _, string _, Lefarma.API.Domain.Interfaces.Config.IWorkflowEntity _, CancellationToken _) =>
            {
                if (!pasosConAccion.Contains(idPasoActual))
                {
                    return ErrorOrFactory.From<IEnumerable<AccionDisponibleResponse>>([]);
                }

                return ErrorOrFactory.From<IEnumerable<AccionDisponibleResponse>>(
                [
                    new AccionDisponibleResponse
                    {
                        IdAccion = 1000 + idPasoActual,
                        IdTipoAccion = 1,
                        TipoAccionCodigo = "ENVIAR",
                        TipoAccionNombre = "Enviar",
                    },
                ]);
            });

        var servicio = new AprobacionesService(contexto, workflow.Asokam, queryMock.Object);
        return (servicio, workflow, matrizPendiente.IdMatrizGeneral);
    }

    [Fact]
    public async Task GetDocumentosAsync_FiltroPendientes_Debe_IncluirMatrizEnPasoIntermedio()
    {
        var (servicio, _, idMatrizPendiente) = CrearEscenarioConMatriz();

        // El paso del AEM es intermedio (no inicio ni final): la matriz aparece como pendiente
        var documentos = await servicio.GetDocumentosAsync(idUsuario: 60, filtro: "pendientes");

        var matriz = documentos.Should().ContainSingle(d => d.Tipo == "matriz").Which;
        matriz.IdMatrizGeneral.Should().Be(idMatrizPendiente);
        matriz.IdEntidad.Should().Be(idMatrizPendiente);
        matriz.Documento.Should().Be("Matriz de talleres 10/2026 – IMSS");
        matriz.PasoNombre.Should().Be("Registro de costos - AEM");
        matriz.Acciones.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetDocumentosAsync_FiltroTodos_Debe_IncluirMatricesConYPendientes()
    {
        var (servicio, _, idMatrizPendiente) = CrearEscenarioConMatriz();

        var documentos = await servicio.GetDocumentosAsync(idUsuario: 60, filtro: "todos");

        documentos.Where(d => d.Tipo == "matriz").Should().HaveCount(2);
        documentos.Should().Contain(d =>
            d.Tipo == "matriz" && d.IdMatrizGeneral == idMatrizPendiente && d.Acciones.Count == 1);
        documentos.Should().Contain(d =>
            d.Tipo == "matriz" && d.PasoNombre == "Concentración" && d.Acciones.Count == 0);
    }
}
