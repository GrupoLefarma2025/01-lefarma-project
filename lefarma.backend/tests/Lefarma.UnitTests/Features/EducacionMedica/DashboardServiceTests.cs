using FluentAssertions;
using Lefarma.API.Features.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Moq;

namespace Lefarma.UnitTests.Features.EducacionMedica;

/// <summary>Resumen agregado del dashboard (ADR-00012, Fase 2).</summary>
public class DashboardServiceTests
{
    private const int IdUsuario = 70;

    private readonly Mock<ITalleresService> _talleres = new();
    private readonly Mock<IRutasService> _rutas = new();
    private readonly Mock<IAprobacionesService> _aprobaciones = new();
    private readonly Mock<IMatrizTalleresService> _matrices = new();

    public DashboardServiceTests()
    {
        _aprobaciones
            .Setup(a => a.GetDocumentosAsync(
                IdUsuario, AprobacionesService.FiltroPendientes, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
    }

    private DashboardService CrearServicio() =>
        new(_talleres.Object, _rutas.Object, _aprobaciones.Object, _matrices.Object);

    [Fact]
    public async Task SinPermisos_DevuelveSoloPendientes()
    {
        var resumen = await CrearServicio()
            .GetResumenAsync(IdUsuario, "2026-10", incluirTalleres: false, incluirVisitas: false);

        resumen.Periodo.Should().Be("2026-10");
        resumen.MisTalleres.Should().BeNull();
        resumen.Asignaciones.Should().BeEmpty();
        resumen.Matrices.Should().BeEmpty();
        resumen.TalleresPeriodo.Should().BeEmpty();
        resumen.Solicitudes.Should().BeEmpty();
        _aprobaciones.Verify(a => a.GetDocumentosAsync(
            IdUsuario, AprobacionesService.FiltroPendientes, It.IsAny<CancellationToken>()), Times.Once);
        _talleres.VerifyNoOtherCalls();
        _rutas.VerifyNoOtherCalls();
        _matrices.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ConTalleres_DevuelveEquipoMatricesYTalleresDelPeriodo()
    {
        var tallerConSolicitud = new TallerDto
        {
            IdTaller = 1,
            NombreHospital = "Hospital A",
            SolicitudCambioPendiente = new TallerSolicitudCambioResumenDto
            {
                IdSolicitud = 9,
                NombreSolicitante = "EV",
            },
        };
        var tallerSinSolicitud = new TallerDto { IdTaller = 2, NombreHospital = "Hospital B" };

        _talleres
            .Setup(t => t.GetMisTalleresAsync(IdUsuario, "2026-10", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MisTalleresResponse
            {
                IdEquipo = 4,
                Periodo = new DateOnly(2026, 10, 1),
            });
        _matrices
            .Setup(m => m.GetMatricesAsync(null, "2026-10", It.IsAny<CancellationToken>()))
            .ReturnsAsync([new MatrizGeneralResumenDto { IdMatrizGeneral = 2, TotalTalleres = 2 }]);
        _matrices
            .Setup(m => m.GetMatrizAsync(2, IdUsuario, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MatrizTalleresDetalleDto
            {
                IdMatrizGeneral = 2,
                Talleres = [tallerConSolicitud, tallerSinSolicitud],
            });

        var resumen = await CrearServicio()
            .GetResumenAsync(IdUsuario, "2026-10", incluirTalleres: true, incluirVisitas: false);

        resumen.MisTalleres.Should().NotBeNull();
        resumen.MisTalleres!.IdEquipo.Should().Be(4);
        resumen.Matrices.Should().ContainSingle();
        resumen.TalleresPeriodo.Should().HaveCount(2);
        resumen.Solicitudes.Should().ContainSingle().Which.IdTaller.Should().Be(1);
        _rutas.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ConVisitas_DevuelveAsignaciones()
    {
        _rutas
            .Setup(r => r.GetAsignacionesAsync(IdUsuario, null, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync([new AsignacionDto { IdRutaVisita = 1, NombreHospital = "Hospital A" }]);

        var resumen = await CrearServicio()
            .GetResumenAsync(IdUsuario, "2026-10", incluirTalleres: false, incluirVisitas: true);

        resumen.Asignaciones.Should().ContainSingle();
        _talleres.VerifyNoOtherCalls();
        _matrices.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task PeriodoInvalido_UsaMesActual()
    {
        var resumen = await CrearServicio()
            .GetResumenAsync(IdUsuario, "no-es-periodo", incluirTalleres: false, incluirVisitas: false);

        resumen.Periodo.Should().MatchRegex(@"^\d{4}-\d{2}$");
    }
}
