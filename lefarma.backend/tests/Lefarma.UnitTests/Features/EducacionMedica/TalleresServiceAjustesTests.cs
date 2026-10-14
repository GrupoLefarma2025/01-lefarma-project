using FluentAssertions;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Features.Notifications.DTOs;
using Lefarma.API.Services.Identity;
using Lefarma.API.Shared.Constants;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Lefarma.UnitTests.Features.EducacionMedica;

/// <summary>Ajustes post-cierre, solicitudes de cambio, extraordinarios y captura asistida (ADR-00010/00011).</summary>
public class TalleresServiceAjustesTests
{
    private const int IdEv = 500;
    private const int IdEp = 600;
    private const int IdCem = 800;
    private const int IdEquipo = 1;
    private const int IdTaller = 1;

    private readonly WorkflowTestHarness _workflow = WorkflowTestHarness.Crear();
    private readonly Mock<INotificationService> _notificationMock = new();

    public TalleresServiceAjustesTests()
    {
        _notificationMock
            .Setup(n => n.SendAsync(It.IsAny<SendNotificationRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SendNotificationResponse());
        _notificationMock
            .Setup(n => n.SendByRoleAsync(It.IsAny<RoleNotificationRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SendNotificationResponse());

        SembrarEscenarioBase();
    }

    private void SembrarEscenarioBase()
    {
        var contexto = _workflow.Context;
        contexto.TiposGerencia.Add(new TipoGerencia { IdTipoGerencia = 1, Descripcion = "IMSS", Activo = true });
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
            Estado = SeleccionMensual.EstadoCerrada,
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
            IdSeleccionHospital = 1,
            IdSeleccionMensual = 1,
            IdHospital = 100,
            Region = "1",
            EntidadFederativa = "CDMX",
            CiudadMunicipio = "Cuauhtémoc",
            IdRegion = 1,
        });
        contexto.Rutas.Add(new Ruta
        {
            IdRuta = 1,
            IdSeleccionMensual = 1,
            IdEquipo = IdEquipo,
            Version = 1,
            Estado = Ruta.EstadoCerrada,
            Nombre = "Ruta 1",
        });
        contexto.RutasVisitas.Add(new RutaVisita
        {
            IdRutaVisita = 1,
            IdRuta = 1,
            IdSeleccionHospital = 1,
            IdHospital = 100,
            FechaVisita = new DateOnly(2026, 10, 20),
            Orden = 1,
        });
        contexto.Talleres.Add(new Taller
        {
            IdTaller = IdTaller,
            IdSeleccionHospital = 1,
            IdHospital = 100,
            IdEjecutivo = IdEv,
            IdEspecialista = IdEp,
            FechaTaller = new DateOnly(2026, 10, 20),
            HoraTaller = new TimeOnly(9, 0),
            Lugar = "Auditorio",
            NumeroParticipantes = 20,
            Estado = Taller.EstadoProgramado,
            Activo = true,
            IdUsuarioCreacion = IdEv,
        });
        contexto.SaveChanges();
    }

    private TalleresService CrearServicio() => new(
        _workflow.Context,
        _workflow.Asokam,
        _workflow.CreateResolverMock().Object,
        _workflow.JefeResolverMock.Object,
        _notificationMock.Object,
        new UserPermissionService(_workflow.Asokam, new MemoryCache(new MemoryCacheOptions())),
        NullLogger<TalleresService>.Instance);

    private static ActualizarTallerRequest NuevoAjuste(DateOnly fecha, string? motivo = "Reagenda por imprevisto") => new()
    {
        FechaTaller = fecha,
        HoraTaller = new TimeOnly(10, 30),
        Lugar = "Aula 2",
        NumeroParticipantes = 25,
        Motivo = motivo,
    };

    // ----- Ajustes post-cierre del taller (ADR-00010) -----

    [Fact]
    public async Task AjustarTaller_Programado_ConPermisoYCambios_Debe_AplicarAuditarYSincronizarVisita()
    {
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.TalleresAjustar);
        var servicio = CrearServicio();

        var dto = await servicio.ActualizarAsync(IdTaller, NuevoAjuste(new DateOnly(2026, 10, 21)), IdCem);

        dto.FechaTaller.Should().Be(new DateOnly(2026, 10, 21));
        dto.HoraTaller.Should().Be(new TimeOnly(10, 30));
        dto.Lugar.Should().Be("Aula 2");
        dto.NumeroParticipantes.Should().Be(25);

        var ajuste = _workflow.Context.AjustesPostCierre.Single();
        ajuste.EntidadTipo.Should().Be(AjustePostCierre.EntidadTaller);
        ajuste.IdEntidad.Should().Be(IdTaller);
        ajuste.Accion.Should().Be(AjustePostCierre.AccionEditarTaller);
        ajuste.Motivo.Should().Be("Reagenda por imprevisto");
        ajuste.ValoresAntes.Should().Contain("2026-10-20");
        ajuste.ValoresDespues.Should().Contain("2026-10-21");

        // Sincronización taller → ruta: la visita activa se mueve en el mismo acto.
        _workflow.Context.RutasVisitas.Single().FechaVisita.Should().Be(new DateOnly(2026, 10, 21));
    }

    [Fact]
    public async Task AjustarTaller_SinPermisoDeAjuste_Debe_Fallar()
    {
        var servicio = CrearServicio();

        var act = () => servicio.ActualizarAsync(IdTaller, NuevoAjuste(new DateOnly(2026, 10, 21)), IdCem);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*permiso*ajustar*");
    }

    [Fact]
    public async Task AjustarTaller_SinMotivo_Debe_Fallar()
    {
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.TalleresAjustar);
        var servicio = CrearServicio();

        var act = () => servicio.ActualizarAsync(IdTaller, NuevoAjuste(new DateOnly(2026, 10, 21), motivo: null), IdCem);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*motivo*obligatorio*");
    }

    [Fact]
    public async Task AjustarTaller_EnCurso_Debe_Fallar()
    {
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.TalleresAjustar);
        var taller = _workflow.Context.Talleres.Single();
        taller.Estado = Taller.EstadoEnCurso;
        _workflow.Context.SaveChanges();
        var servicio = CrearServicio();

        var act = () => servicio.ActualizarAsync(IdTaller, NuevoAjuste(new DateOnly(2026, 10, 21)), IdCem);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*no se ajusta*");
    }

    [Fact]
    public async Task AjustarTaller_FueraDelLimiteTemporal_Debe_Fallar()
    {
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.TalleresAjustar);
        var taller = _workflow.Context.Talleres.Single();
        taller.FechaTaller = DateOnly.FromDateTime(DateTime.Today).AddDays(-60);
        _workflow.Context.SaveChanges();
        var servicio = CrearServicio();

        var act = () => servicio.ActualizarAsync(IdTaller, NuevoAjuste(new DateOnly(2026, 10, 21)), IdCem);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*límite de 45 días*");
    }

    [Fact]
    public async Task AjustarTaller_ConflictoDeCapacidadEnRuta_Debe_FallarSinCambioParcial()
    {
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.TalleresAjustar);
        // El día destino ya tiene 3 visitas (tope 3/día) en la ruta del equipo.
        _workflow.Context.RutasVisitas.AddRange(
            new RutaVisita { IdRuta = 1, IdSeleccionHospital = 2, IdHospital = 101, FechaVisita = new DateOnly(2026, 10, 21), Orden = 2 },
            new RutaVisita { IdRuta = 1, IdSeleccionHospital = 3, IdHospital = 102, FechaVisita = new DateOnly(2026, 10, 21), Orden = 3 },
            new RutaVisita { IdRuta = 1, IdSeleccionHospital = 4, IdHospital = 103, FechaVisita = new DateOnly(2026, 10, 21), Orden = 4 });
        _workflow.Context.SaveChanges();
        var servicio = CrearServicio();

        var act = () => servicio.ActualizarAsync(IdTaller, NuevoAjuste(new DateOnly(2026, 10, 21)), IdCem);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*máximo de 3 visitas*");
        _workflow.Context.Talleres.Single().FechaTaller.Should().Be(new DateOnly(2026, 10, 20));
        _workflow.Context.RutasVisitas.Single(v => v.IdRutaVisita == 1).FechaVisita.Should().Be(new DateOnly(2026, 10, 20));
        _workflow.Context.AjustesPostCierre.Count().Should().Be(0);
    }

    // ----- Solicitudes de cambio (ADR-00010, decisiones 13-15) -----

    [Fact]
    public async Task CrearSolicitud_MiembroDelEquipo_Debe_CrearPendienteYNotificarAlCem()
    {
        var servicio = CrearServicio();

        var solicitud = await servicio.CrearSolicitudCambioAsync(IdTaller, new CrearSolicitudCambioRequest
        {
            Motivo = "El hospital pidió cambiar la hora",
            HoraTaller = new TimeOnly(11, 0),
        }, IdEv);

        solicitud.Estado.Should().Be(TallerSolicitudCambio.EstadoPendiente);
        solicitud.DatosJson.Should().Contain("11:00");

        _notificationMock.Verify(n => n.SendAsync(
            It.Is<SendNotificationRequest>(r =>
                r.Category == "educacion-medica-solicitud-cambio" &&
                r.Channels.Any(c => c.ChannelType == "in-app" && c.RoleNames!.Contains("Coordinador de Educación Médica")) &&
                r.Channels.All(c => c.ChannelType != "email")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CrearSolicitud_SinCambios_Debe_Fallar()
    {
        var servicio = CrearServicio();

        var act = () => servicio.CrearSolicitudCambioAsync(IdTaller,
            new CrearSolicitudCambioRequest { Motivo = "Sin datos" }, IdEv);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*al menos un cambio*");
    }

    [Fact]
    public async Task CrearSolicitud_Duplicada_Debe_Fallar()
    {
        var servicio = CrearServicio();
        await servicio.CrearSolicitudCambioAsync(IdTaller,
            new CrearSolicitudCambioRequest { Motivo = "Primera", Lugar = "Aula 1" }, IdEv);

        var act = () => servicio.CrearSolicitudCambioAsync(IdTaller,
            new CrearSolicitudCambioRequest { Motivo = "Segunda", Lugar = "Aula 2" }, IdEp);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*ya tiene una solicitud*");
    }

    [Fact]
    public async Task ResolverSolicitud_Aprobar_Debe_AplicarAjusteYNotificarAlSolicitante()
    {
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.TalleresAjustar);
        var servicio = CrearServicio();
        var solicitud = await servicio.CrearSolicitudCambioAsync(IdTaller, new CrearSolicitudCambioRequest
        {
            Motivo = "Cambio de hora",
            HoraTaller = new TimeOnly(12, 0),
        }, IdEv);

        var resuelta = await servicio.ResolverSolicitudCambioAsync(solicitud.IdSolicitud,
            new ResolverSolicitudCambioRequest { Aprobar = true, Motivo = "Procede el cambio" }, IdCem);

        resuelta.Estado.Should().Be(TallerSolicitudCambio.EstadoAprobada);
        _workflow.Context.Talleres.Single().HoraTaller.Should().Be(new TimeOnly(12, 0));
        _workflow.Context.AjustesPostCierre.Single().Accion.Should().Be(AjustePostCierre.AccionEditarTaller);

        _notificationMock.Verify(n => n.SendAsync(
            It.Is<SendNotificationRequest>(r =>
                r.Channels.Any(c => c.UserIds != null && c.UserIds.Contains(IdEv)) &&
                r.Channels.All(c => c.ChannelType != "email")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ResolverSolicitud_Rechazar_NoDebe_AplicarElCambio()
    {
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.TalleresAjustar);
        var servicio = CrearServicio();
        var solicitud = await servicio.CrearSolicitudCambioAsync(IdTaller, new CrearSolicitudCambioRequest
        {
            Motivo = "Cambio de hora",
            HoraTaller = new TimeOnly(12, 0),
        }, IdEv);

        var resuelta = await servicio.ResolverSolicitudCambioAsync(solicitud.IdSolicitud,
            new ResolverSolicitudCambioRequest { Aprobar = false, Motivo = "No procede" }, IdCem);

        resuelta.Estado.Should().Be(TallerSolicitudCambio.EstadoRechazada);
        _workflow.Context.Talleres.Single().HoraTaller.Should().Be(new TimeOnly(9, 0));
        _workflow.Context.AjustesPostCierre.Count().Should().Be(0);
    }

    [Fact]
    public async Task ResolverSolicitud_SinPermisoDeAjuste_Debe_Fallar()
    {
        var servicio = CrearServicio();
        var solicitud = await servicio.CrearSolicitudCambioAsync(IdTaller,
            new CrearSolicitudCambioRequest { Motivo = "Cambio", Lugar = "Aula 1" }, IdEv);

        var act = () => servicio.ResolverSolicitudCambioAsync(solicitud.IdSolicitud,
            new ResolverSolicitudCambioRequest { Aprobar = true, Motivo = "Procede" }, IdCem);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*permiso*ajustar*");
    }

    // ----- Taller extraordinario y captura asistida (ADR-00011) -----

    [Fact]
    public async Task CrearExtraordinario_ConPermiso_Debe_NacerProgramadoConHistorialYMatrices()
    {
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.TalleresCapturarExtraordinarios);
        _workflow.Asokam.Hospitales.Add(new Lefarma.API.Domain.Entities.EducacionMedica.Hospital
        {
            CodigoContacto = 200,
            NombreContacto = "Hospital Extraordinario",
            Ciudad = "Toluca",
            CodigoEstado = "15",
        });
        _workflow.Asokam.SaveChanges();
        var servicio = CrearServicio();

        var dto = await servicio.CrearAsync(new CrearTallerRequest
        {
            EsExtraordinario = true,
            IdHospital = 200,
            IdEquipo = IdEquipo,
            FechaTaller = new DateOnly(2026, 10, 22),
            HoraTaller = new TimeOnly(9, 30),
            MotivoExtraordinario = "Imprevisto operativo del hospital",
        }, IdCem);

        dto.Estado.Should().Be(Taller.EstadoProgramado);
        dto.EsExtraordinario.Should().BeTrue();
        dto.MotivoExtraordinario.Should().Be("Imprevisto operativo del hospital");
        dto.IdSeleccionHospital.Should().BeNull();
        dto.IdHospital.Should().Be(200);

        var taller = _workflow.Context.Talleres.Single(t => t.IdTaller == dto.IdTaller);
        taller.IdEjecutivo.Should().Be(IdEv);
        taller.IdEspecialista.Should().Be(IdEp);

        var historial = _workflow.Context.TalleresEstadosHistorial.Single(h => h.IdTaller == dto.IdTaller);
        historial.EstadoNuevo.Should().Be(Taller.EstadoProgramado);
        historial.Origen.Should().Be(TallerEstadoHistorial.OrigenAutomatico);

        _workflow.Context.MatricesIndividuales.Should().Contain(m => m.IdEquipo == IdEquipo && m.Periodo == new DateOnly(2026, 10, 1));
        _workflow.Context.MatricesGenerales.Should().Contain(m => m.IdTipoGerencia == 1 && m.Periodo == new DateOnly(2026, 10, 1));
    }

    [Fact]
    public async Task CrearExtraordinario_SinPermiso_Debe_Fallar()
    {
        var servicio = CrearServicio();

        var act = () => servicio.CrearAsync(new CrearTallerRequest
        {
            EsExtraordinario = true,
            IdHospital = 200,
            IdEquipo = IdEquipo,
            FechaTaller = new DateOnly(2026, 10, 22),
            MotivoExtraordinario = "Motivo",
        }, IdEv);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*permiso*extraordinarios*");
    }

    [Fact]
    public async Task CrearExtraordinario_SinMotivo_Debe_Fallar()
    {
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.TalleresCapturarExtraordinarios);
        var servicio = CrearServicio();

        var act = () => servicio.CrearAsync(new CrearTallerRequest
        {
            EsExtraordinario = true,
            IdHospital = 200,
            IdEquipo = IdEquipo,
            FechaTaller = new DateOnly(2026, 10, 22),
        }, IdCem);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*motivo*obligatorio*");
    }

    [Fact]
    public async Task CapturaAsistida_CemConPermiso_Debe_CrearTallerParaOtroEquipo()
    {
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.TalleresCapturarAsistida);
        _workflow.Asokam.Usuarios.Add(new Lefarma.API.Domain.Entities.Auth.Usuario
        {
            IdUsuario = IdCem,
            NombreCompleto = "CEM Prueba",
            EsActivo = true,
        });
        _workflow.Asokam.SaveChanges();
        var servicio = CrearServicio();

        var dto = await servicio.CrearAsync(new CrearTallerRequest
        {
            IdSeleccionHospital = 1,
            IdEquipo = IdEquipo,
            NumeroParticipantes = 15,
            FechaTaller = new DateOnly(2026, 10, 23),
        }, IdCem);

        dto.IdTaller.Should().BeGreaterThan(0);
        dto.IdEjecutivo.Should().Be(IdEv);
        dto.CapturadoPor.Should().NotBeNull();

        var taller = _workflow.Context.Talleres.Single(t => t.IdTaller == dto.IdTaller);
        taller.IdUsuarioCreacion.Should().Be(IdCem);
        taller.Estado.Should().Be(Taller.EstadoCreada);
    }

    [Fact]
    public async Task CapturaNormal_UsuarioAjeno_SinPermisoAsistida_Debe_Fallar()
    {
        var servicio = CrearServicio();

        var act = () => servicio.CrearAsync(new CrearTallerRequest
        {
            IdSeleccionHospital = 1,
            NumeroParticipantes = 15,
            FechaTaller = new DateOnly(2026, 10, 23),
        }, 999);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Ejecutivo de Ventas o el Especialista*");
    }
}
