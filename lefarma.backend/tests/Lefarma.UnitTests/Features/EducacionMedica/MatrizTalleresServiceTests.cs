using FluentAssertions;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.Config.Workflows;
using Lefarma.API.Features.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Features.Profile;
using Lefarma.API.Shared.Constants;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class MatrizTalleresServiceTests
{
    private const int IdEv = 500;
    private const int IdEp = 600;
    private const int IdEquipo = 1;
    private static readonly DateOnly Periodo = new(2026, 10, 1);

    private readonly WorkflowTestHarness _workflow;
    private readonly Mock<IProfileService> _profileMock = new();

    public MatrizTalleresServiceTests()
    {
        _workflow = WorkflowTestHarness.Crear();
        _profileMock.Setup(p => p.HasFirmaAsync(It.IsAny<int>())).ReturnsAsync(true);
        SembrarEscenarioBase();
    }

    private void SembrarEscenarioBase()
    {
        var contexto = _workflow.Context;
        contexto.TiposGerencia.Add(new TipoGerencia { IdTipoGerencia = 1, Descripcion = "IMSS", Activo = true });
        // FKs requeridas: sin los catálogos, los Includes actúan como inner join en InMemory
        contexto.RegionesCat.Add(new RegionCatalogo { IdRegion = 1, IdTipoGerencia = 1, Nombre = "Región 1", Activo = true });
        contexto.RegionesCat.Add(new RegionCatalogo { IdRegion = 2, IdTipoGerencia = 1, Nombre = "Región 2", Activo = true });
        contexto.EquiposPareo.Add(new EquipoPareo
        {
            IdEquipo = IdEquipo,
            IdRegion = 1,
            IdEjecutivo = IdEv,
            IdEspecialista = IdEp,
            Activo = true,
        });
        contexto.SaveChanges();
    }

    private MatrizTalleresService CrearServicio()
    {
        return new MatrizTalleresService(
            _workflow.Context,
            _workflow.Asokam,
            _workflow.Engine,
            new Mock<IWorkflowQueryService>().Object,
            _profileMock.Object,
            _workflow.JefeResolverMock.Object,
            NullLogger<MatrizTalleresService>.Instance);
    }

    /// <summary>Matriz general en Concentración con 2 talleres sin costos (equipo 1).</summary>
    private MatrizGeneral SembrarMatrizEnConcentracion(int talleresSinCostos = 2)
    {
        var contexto = _workflow.Context;
        var pasoInicio = contexto.WorkflowPasos.Single(p => p.IdPaso == _workflow.PasosMatriz["Concentracion"]);

        var individual = new MatrizIndividual
        {
            IdEquipo = IdEquipo,
            Periodo = Periodo,
            Estado = MatrizIndividual.EstadoGenerada,
            FechaGeneracion = DateTime.UtcNow,
        };
        contexto.MatricesIndividuales.Add(individual);

        var general = new MatrizGeneral
        {
            IdTipoGerencia = 1,
            Periodo = Periodo,
            IdWorkflow = _workflow.WfMatriz.IdWorkflow,
            IdPasoActual = pasoInicio.IdPaso,
            IdEstado = pasoInicio.IdEstado,
            IdUsuarioCreacion = IdEv,
        };
        contexto.MatricesGenerales.Add(general);
        contexto.SaveChanges();

        for (var i = 1; i <= talleresSinCostos; i++)
        {
            var taller = new Taller
            {
                IdHospital = 100 + i,
                Region = "1",
                NumeroParticipantes = 15,
                FechaTaller = new DateOnly(2026, 10, 15 + i),
                Estado = Taller.EstadoBorrador,
                Activo = true,
                IdEjecutivo = IdEv,
                IdEspecialista = IdEp,
                IdMatrizIndividual = individual.IdMatrizIndividual,
                IdMatrizGeneral = general.IdMatrizGeneral,
            };
            taller.Recursos.Add(new TallerRecurso
            {
                TipoRecurso = TallerRecurso.RecursoProducto,
                IdProducto = "R-III",
                Cantidad = 30,
            });
            contexto.Talleres.Add(taller);
        }

        contexto.SaveChanges();
        return general;
    }

    private async Task MoverMatrizAPasoAsync(MatrizGeneral general, string claveAccion, int idUsuario, string? comentario = null)
    {
        var servicio = CrearServicio();
        await servicio.FirmarAsync(
            general.IdMatrizGeneral,
            new FirmarWorkflowRequest { IdAccion = _workflow.AccionesMatriz[claveAccion], Comentario = comentario },
            idUsuario);
    }

    private async Task CapturarCostosDeTodosLosTalleresAsync(MatrizGeneral general)
    {
        var servicio = CrearServicio();
        var talleres = _workflow.Context.Talleres
            .Where(t => t.IdMatrizGeneral == general.IdMatrizGeneral)
            .ToList();
        foreach (var taller in talleres)
        {
            await servicio.ActualizarCostosAsync(
                general.IdMatrizGeneral,
                taller.IdTaller,
                new ActualizarCostosTallerRequest
                {
                    Recursos =
                    [
                        new GuardarCostoRecursoRequest
                        {
                            TipoRecurso = TallerRecurso.RecursoProducto,
                            IdProducto = "R-III",
                            Cantidad = 30,
                            CostoUnitario = 100m,
                        },
                    ],
                },
                _workflow.UsuarioAem);
        }
    }

    [Fact]
    public async Task CadenaCompleta_GvAemCaDc_Debe_AutorizarTalleres()
    {
        var general = SembrarMatrizEnConcentracion();

        // GV envía a firma y firma
        await MoverMatrizAPasoAsync(general, "Enviar", _workflow.UsuarioGvImss);
        await MoverMatrizAPasoAsync(general, "GvImssAutorizar", _workflow.UsuarioGvImss);
        _workflow.Context.Entry(general).Reload();
        general.IdPasoActual.Should().Be(_workflow.PasosMatriz["Aem"]);

        // CA no puede firmar sin costos (salvaguarda) — se prueba llegando primero a su paso
        await MoverMatrizAPasoAsync(general, "AemEnviar", _workflow.UsuarioAem);
        var servicio = CrearServicio();
        var firmarSinCostos = () => servicio.FirmarAsync(
            general.IdMatrizGeneral,
            new FirmarWorkflowRequest { IdAccion = _workflow.AccionesMatriz["CaAutorizar"] },
            _workflow.UsuarioCa);
        await firmarSinCostos.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*no tienen costos capturados*");

        // CA devuelve al paso de costos; el AEM captura y reenvía
        await MoverMatrizAPasoAsync(general, "CaDevolver", _workflow.UsuarioCa, "Faltan costos");
        await CapturarCostosDeTodosLosTalleresAsync(general);
        await MoverMatrizAPasoAsync(general, "AemEnviar", _workflow.UsuarioAem);

        // CA firma y DC autoriza
        await MoverMatrizAPasoAsync(general, "CaAutorizar", _workflow.UsuarioCa);
        var detalle = await CrearServicio().FirmarAsync(
            general.IdMatrizGeneral,
            new FirmarWorkflowRequest { IdAccion = _workflow.AccionesMatriz["DcAutorizar"] },
            _workflow.UsuarioDc);

        detalle.IdPasoActual.Should().Be(_workflow.PasosMatriz["Final"]);
        detalle.EsFinal.Should().BeTrue();
        detalle.CostoTotal.Should().Be(2 * 30 * 100m);

        var talleres = _workflow.Context.Talleres
            .Where(t => t.IdMatrizGeneral == general.IdMatrizGeneral)
            .ToList();
        talleres.Should().OnlyContain(t => t.Estado == Taller.EstadoAutorizado);

        // El documento imprimible acumula las firmas de la bitácora
        var documento = await CrearServicio().GetDocumentoAsync(general.IdMatrizGeneral);
        documento.Titulo.Should().Be("Matriz de talleres 10/2026 – IMSS");
        documento.Firmas.Should().NotBeEmpty();
    }

    [Fact]
    public async Task Devolver_DelGv_Debe_RegresarAConcentracionEditable()
    {
        var general = SembrarMatrizEnConcentracion();
        await MoverMatrizAPasoAsync(general, "Enviar", _workflow.UsuarioGvImss);

        var detalle = await CrearServicio().FirmarAsync(
            general.IdMatrizGeneral,
            new FirmarWorkflowRequest { IdAccion = _workflow.AccionesMatriz["GvImssDevolver"], Comentario = "Corrige el hospital X" },
            _workflow.UsuarioGvImss);

        detalle.IdPasoActual.Should().Be(_workflow.PasosMatriz["Concentracion"]);
        detalle.EsEditable.Should().BeTrue();
    }

    [Fact]
    public async Task Devolver_DelDc_Debe_RegresarAlPasoDelCa()
    {
        var general = SembrarMatrizEnConcentracion();
        await MoverMatrizAPasoAsync(general, "Enviar", _workflow.UsuarioGvImss);
        await MoverMatrizAPasoAsync(general, "GvImssAutorizar", _workflow.UsuarioGvImss);
        await CapturarCostosDeTodosLosTalleresAsync(general);
        await MoverMatrizAPasoAsync(general, "AemEnviar", _workflow.UsuarioAem);
        await MoverMatrizAPasoAsync(general, "CaAutorizar", _workflow.UsuarioCa);

        var detalle = await CrearServicio().FirmarAsync(
            general.IdMatrizGeneral,
            new FirmarWorkflowRequest { IdAccion = _workflow.AccionesMatriz["DcDevolver"], Comentario = "Revisar box lunch" },
            _workflow.UsuarioDc);

        detalle.IdPasoActual.Should().Be(_workflow.PasosMatriz["Ca"]);
    }

    [Fact]
    public async Task Firmar_PasoDeFirma_SinFirmaDigital_Debe_Fallar()
    {
        var general = SembrarMatrizEnConcentracion();
        await MoverMatrizAPasoAsync(general, "Enviar", _workflow.UsuarioGvImss);

        _profileMock.Setup(p => p.HasFirmaAsync(_workflow.UsuarioGvImss)).ReturnsAsync(false);

        var servicio = CrearServicio();
        var act = () => servicio.FirmarAsync(
            general.IdMatrizGeneral,
            new FirmarWorkflowRequest { IdAccion = _workflow.AccionesMatriz["GvImssAutorizar"] },
            _workflow.UsuarioGvImss);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*no tiene una firma digital registrada*");
    }

    [Fact]
    public async Task ActualizarCostos_FueraDelPasoDeCostos_Debe_Fallar()
    {
        var general = SembrarMatrizEnConcentracion();
        var taller = _workflow.Context.Talleres.First();
        var servicio = CrearServicio();

        var act = () => servicio.ActualizarCostosAsync(
            general.IdMatrizGeneral,
            taller.IdTaller,
            new ActualizarCostosTallerRequest(),
            _workflow.UsuarioAem);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*paso de registro de costos*");
    }

    [Fact]
    public async Task ActualizarCostos_UsuarioNoParticipante_Debe_Fallar()
    {
        var general = SembrarMatrizEnConcentracion();
        await MoverMatrizAPasoAsync(general, "Enviar", _workflow.UsuarioGvImss);
        await MoverMatrizAPasoAsync(general, "GvImssAutorizar", _workflow.UsuarioGvImss);

        var taller = _workflow.Context.Talleres.First();
        var servicio = CrearServicio();
        var act = () => servicio.ActualizarCostosAsync(
            general.IdMatrizGeneral,
            taller.IdTaller,
            new ActualizarCostosTallerRequest(),
            idUsuario: 999);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*No eres participante*");
    }

    [Fact]
    public async Task ActualizarCostos_Debe_RecalcularSubtotales()
    {
        var general = SembrarMatrizEnConcentracion();
        await MoverMatrizAPasoAsync(general, "Enviar", _workflow.UsuarioGvImss);
        await MoverMatrizAPasoAsync(general, "GvImssAutorizar", _workflow.UsuarioGvImss);

        var taller = _workflow.Context.Talleres.First();
        var dto = await CrearServicio().ActualizarCostosAsync(
            general.IdMatrizGeneral,
            taller.IdTaller,
            new ActualizarCostosTallerRequest
            {
                Recursos =
                [
                    new GuardarCostoRecursoRequest { TipoRecurso = TallerRecurso.RecursoFolleto, Cantidad = 50, CostoUnitario = 12.5m },
                    new GuardarCostoRecursoRequest { TipoRecurso = TallerRecurso.RecursoBoxLunch, Cantidad = 20, CostoUnitario = 180m },
                ],
            },
            _workflow.UsuarioAem);

        dto.Recursos.Should().HaveCount(2);
        dto.CostoTotal.Should().Be(50 * 12.5m + 20 * 180m);
    }

    [Fact]
    public async Task GetConcentracion_Debe_ListarLasMatricesIndividualesPorEquipo()
    {
        var general = SembrarMatrizEnConcentracion();
        var contexto = _workflow.Context;

        // Segundo equipo con su matriz individual aún EnCaptura
        contexto.EquiposPareo.Add(new EquipoPareo { IdEquipo = 2, IdRegion = 2, IdEjecutivo = 700, IdEspecialista = 800, Activo = true });
        var individual2 = new MatrizIndividual { IdEquipo = 2, Periodo = Periodo, Estado = MatrizIndividual.EstadoEnCaptura };
        contexto.MatricesIndividuales.Add(individual2);
        contexto.SaveChanges();
        contexto.Talleres.Add(new Taller
        {
            IdHospital = 200,
            Estado = Taller.EstadoBorrador,
            Activo = true,
            IdMatrizIndividual = individual2.IdMatrizIndividual,
            IdMatrizGeneral = general.IdMatrizGeneral,
        });
        contexto.SaveChanges();

        var panel = await CrearServicio().GetConcentracionAsync(general.IdMatrizGeneral);

        panel.Should().HaveCount(2);
        panel.Should().Contain(e => e.IdEquipo == IdEquipo && e.Estado == MatrizIndividual.EstadoGenerada && e.TotalTalleres == 2);
        panel.Should().Contain(e => e.IdEquipo == 2 && e.Estado == MatrizIndividual.EstadoEnCaptura && e.TotalTalleres == 1);
    }

    [Fact]
    public async Task GetMatrices_Debe_FiltrarPorGerenciaYPeriodo()
    {
        SembrarMatrizEnConcentracion();

        var servicio = CrearServicio();
        var imssOct = await servicio.GetMatricesAsync(1, "2026-10");
        imssOct.Should().HaveCount(1);
        imssOct[0].TotalTalleres.Should().Be(2);

        var descOct = await servicio.GetMatricesAsync(2, "2026-10");
        descOct.Should().BeEmpty();

        var imssNov = await servicio.GetMatricesAsync(1, "2026-11");
        imssNov.Should().BeEmpty();
    }

    [Fact]
    public async Task Engine_Debe_ResolverElContextoDeLaMatrizParaAccionesDisponibles()
    {
        var general = SembrarMatrizEnConcentracion();

        // Participante del paso inicial (GV IMSS) ve el ENVIAR
        var accionesGv = await _workflow.Engine.GetAccionesDisponiblesAsync(
            _workflow.WfMatriz.IdWorkflow,
            general.IdMatrizGeneral,
            _workflow.UsuarioGvImss,
            CodigoProceso.EDUCACION_MEDICA_MATRIZ);
        accionesGv.Should().NotBeEmpty();

        // Un ajeno (ni creador ni participante) no ve acciones
        var accionesAjeno = await _workflow.Engine.GetAccionesDisponiblesAsync(
            _workflow.WfMatriz.IdWorkflow,
            general.IdMatrizGeneral,
            999,
            CodigoProceso.EDUCACION_MEDICA_MATRIZ);
        accionesAjeno.Should().BeEmpty();
    }
}
