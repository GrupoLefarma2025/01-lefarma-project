using FluentAssertions;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class TalleresServiceTests
{
    private const int IdEv = 500;
    private const int IdEp = 600;
    private const int IdEquipo = 1;
    private const int IdSeleccionHospital = 1;
    private const int IdHospitalAsokam = 100;
    private static readonly DateOnly Periodo = new(2026, 10, 1);

    private readonly WorkflowTestHarness _workflow;

    public TalleresServiceTests()
    {
        _workflow = WorkflowTestHarness.Crear();
        SembrarEscenarioBase();
    }

    private void SembrarEscenarioBase()
    {
        var contexto = _workflow.Context;
        contexto.TiposGerencia.Add(new TipoGerencia { IdTipoGerencia = 1, Descripcion = "IMSS", Activo = true });
        contexto.TiposGerencia.Add(new TipoGerencia { IdTipoGerencia = 2, Descripcion = "Descentralizado", Activo = true });
        // La FK id_region del equipo es requerida: sin el catálogo, el Include(Region) actúa como inner join en InMemory
        contexto.RegionesCat.Add(new RegionCatalogo { IdRegion = 1, IdTipoGerencia = 1, Nombre = "Región 1", Activo = true });
        contexto.EquiposPareo.Add(new EquipoPareo
        {
            IdEquipo = IdEquipo,
            IdRegion = 1,
            IdEjecutivo = IdEv,
            IdEspecialista = IdEp,
            Activo = true,
        });
        contexto.SeleccionesMensuales.Add(new SeleccionMensual
        {
            IdSeleccionMensual = 1,
            FechaSeleccion = new DateOnly(2026, 10, 15),
            IdTipoGerencia = 1,
            Estado = SeleccionMensual.EstadoAutorizada,
            Activo = true,
        });
        contexto.SeleccionesRegiones.Add(new SeleccionRegion
        {
            IdRegion = 1,
            IdSeleccionMensual = 1,
            CantidadHospitales = 1,
            IdEquipo = IdEquipo,
        });
        contexto.SeleccionesHospitales.Add(new SeleccionHospital
        {
            IdSeleccionHospital = IdSeleccionHospital,
            IdSeleccionMensual = 1,
            IdHospital = IdHospitalAsokam,
            Region = "1",
            EntidadFederativa = "CDMX",
            CiudadMunicipio = "Cuauhtémoc",
            IdRegion = 1,
        });
        contexto.SaveChanges();
    }

    private TalleresService CrearServicio()
    {
        return new TalleresService(
            _workflow.Context,
            _workflow.Asokam,
            _workflow.CreateResolverMock().Object,
            _workflow.JefeResolverMock.Object,
            NullLogger<TalleresService>.Instance);
    }

    private static CrearTallerRequest NuevaSolicitud() => new()
    {
        IdSeleccionHospital = IdSeleccionHospital,
        NumeroParticipantes = 20,
        Lugar = "Auditorio",
        FechaTaller = new DateOnly(2026, 10, 20),
        HoraTaller = new TimeOnly(9, 0),
        Recursos =
        [
            new GuardarTallerRecursoRequest { TipoRecurso = "Producto", IdProducto = "R-III", Cantidad = 30 },
        ],
    };

    private async Task<TallerDto> CapturarTallerAsync(TalleresService? servicio = null, int idUsuario = IdEv)
    {
        servicio ??= CrearServicio();
        return await servicio.CrearAsync(NuevaSolicitud(), idUsuario);
    }

    [Fact]
    public async Task Crear_Debe_DerivarGerenciaYMesYEnlazarMatrices()
    {
        var taller = await CapturarTallerAsync();

        taller.IdMatrizIndividual.Should().NotBeNull();
        taller.IdMatrizGeneral.Should().NotBeNull();

        var contexto = _workflow.Context;
        var individual = contexto.MatricesIndividuales.Single(m => m.IdMatrizIndividual == taller.IdMatrizIndividual);
        individual.IdEquipo.Should().Be(IdEquipo);
        individual.Periodo.Should().Be(Periodo);
        individual.Estado.Should().Be(MatrizIndividual.EstadoEnCaptura);

        // La general nace en el paso inicial del workflow de la gerencia (IMSS -> WfMatriz)
        var general = contexto.MatricesGenerales.Single(m => m.IdMatrizGeneral == taller.IdMatrizGeneral);
        general.IdTipoGerencia.Should().Be(1);
        general.Periodo.Should().Be(Periodo);
        general.IdWorkflow.Should().Be(_workflow.WfMatriz.IdWorkflow);
        general.IdPasoActual.Should().Be(_workflow.PasosMatriz["Concentracion"]);
    }

    [Fact]
    public async Task Crear_UsuarioQueNoEsDelEquipo_Debe_Fallar()
    {
        var servicio = CrearServicio();

        var act = () => servicio.CrearAsync(NuevaSolicitud(), idUsuario: 999);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Ejecutivo de Ventas o el Especialista*");
    }

    [Fact]
    public async Task Crear_SegundoTaller_Debe_ReutilizarLasMismasMatrices()
    {
        var primero = await CapturarTallerAsync();
        var segundo = await CapturarTallerAsync();

        segundo.IdMatrizIndividual.Should().Be(primero.IdMatrizIndividual);
        segundo.IdMatrizGeneral.Should().Be(primero.IdMatrizGeneral);
        _workflow.Context.MatricesIndividuales.Count().Should().Be(1);
        _workflow.Context.MatricesGenerales.Count().Should().Be(1);
    }

    [Fact]
    public async Task Actualizar_ConMatrizGeneralFueraDelPasoInicial_Debe_Fallar()
    {
        var taller = await CapturarTallerAsync();

        var general = _workflow.Context.MatricesGenerales.Single();
        general.IdPasoActual = _workflow.PasosMatriz["GvImss"];
        _workflow.Context.SaveChanges();

        var servicio = CrearServicio();
        var act = () => servicio.ActualizarAsync(taller.IdTaller, new ActualizarTallerRequest { Lugar = "Otro" }, IdEv);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Solo se pueden editar talleres en estado Creada.");
    }

    [Fact]
    public async Task Generar_Debe_BloquearLaCapturaDelEquipo()
    {
        var taller = await CapturarTallerAsync();
        var servicio = CrearServicio();

        var matriz = await servicio.GenerarMatrizIndividualAsync(taller.IdMatrizIndividual!.Value, IdEv);

        matriz.Estado.Should().Be(MatrizIndividual.EstadoGenerada);
        matriz.FechaGeneracion.Should().NotBeNull();

        var act = () => servicio.CrearAsync(NuevaSolicitud(), IdEv);
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*ya fue generada*reabr*");
    }

    [Fact]
    public async Task Generar_SinTalleres_Debe_Fallar()
    {
        var contexto = _workflow.Context;
        var individual = new MatrizIndividual
        {
            IdEquipo = IdEquipo,
            Periodo = Periodo,
            Estado = MatrizIndividual.EstadoEnCaptura,
        };
        contexto.MatricesIndividuales.Add(individual);
        contexto.SaveChanges();

        var servicio = CrearServicio();
        var act = () => servicio.GenerarMatrizIndividualAsync(individual.IdMatrizIndividual, IdEv);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*no tiene talleres capturados*");
    }

    [Fact]
    public async Task Reabrir_GvParticipante_Debe_ReabrirLaCaptura()
    {
        var taller = await CapturarTallerAsync();
        var servicio = CrearServicio();
        await servicio.GenerarMatrizIndividualAsync(taller.IdMatrizIndividual!.Value, IdEv);

        var matriz = await servicio.ReabrirMatrizIndividualAsync(taller.IdMatrizIndividual!.Value, _workflow.UsuarioGvImss);

        matriz.Estado.Should().Be(MatrizIndividual.EstadoEnCaptura);
        matriz.FechaGeneracion.Should().BeNull();
    }

    [Fact]
    public async Task Reabrir_UsuarioQueNoEsGvParticipante_Debe_Fallar()
    {
        var taller = await CapturarTallerAsync();
        var servicio = CrearServicio();
        await servicio.GenerarMatrizIndividualAsync(taller.IdMatrizIndividual!.Value, IdEv);

        // El propio EV que capturó NO puede reabrir (solo el GV participante del paso)
        var act = () => servicio.ReabrirMatrizIndividualAsync(taller.IdMatrizIndividual!.Value, IdEv);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Solo el Gerente de Ventas*");
    }

    [Fact]
    public async Task Eliminar_ConCapturaAbierta_Debe_BorrarTallerYRecursos()
    {
        var taller = await CapturarTallerAsync();
        var servicio = CrearServicio();

        await servicio.EliminarAsync(taller.IdTaller, IdEp);

        _workflow.Context.Talleres.Count().Should().Be(0);
        _workflow.Context.TalleresRecursos.Count().Should().Be(0);
    }

    [Fact]
    public async Task GetMisTalleres_Debe_DevolverEquipoMatrizYTalleres()
    {
        await CapturarTallerAsync();
        var servicio = CrearServicio();

        var resultado = await servicio.GetMisTalleresAsync(IdEp, "2026-10");

        resultado.IdEquipo.Should().Be(IdEquipo);
        resultado.Periodo.Should().Be(Periodo);
        resultado.Matriz.Should().NotBeNull();
        resultado.Matriz!.Estado.Should().Be(MatrizIndividual.EstadoEnCaptura);
        resultado.Talleres.Should().HaveCount(1);
    }
}
