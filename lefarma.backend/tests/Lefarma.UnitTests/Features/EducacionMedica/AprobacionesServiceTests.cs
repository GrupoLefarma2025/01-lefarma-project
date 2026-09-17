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
}
