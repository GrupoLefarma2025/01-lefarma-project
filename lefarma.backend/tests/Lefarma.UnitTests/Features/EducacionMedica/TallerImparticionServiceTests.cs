using FluentAssertions;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Features.Profile;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class TallerImparticionServiceTests
{
    private const int IdEv = 500;
    private const int IdEp = 600;
    private const int IdGv = 700;
    private const int IdAjeno = 999;
    private const int IdTaller = 1;

    private readonly WorkflowTestHarness _workflow = WorkflowTestHarness.Crear();

    public TallerImparticionServiceTests()
    {
        SembrarTaller(Taller.EstadoProgramado);
        _workflow.Context.UsuariosDetalle.Add(new UsuarioDetalle
        {
            IdUsuario = IdEv,
            FirmaPath = "/media/firmas/ev.png",
        });
        _workflow.Context.SaveChanges();
    }

    private void SembrarTaller(string estado)
    {
        _workflow.Context.Talleres.Add(new Taller
        {
            IdTaller = IdTaller,
            IdHospital = 100,
            IdEjecutivo = IdEv,
            IdEspecialista = IdEp,
            FechaTaller = new DateOnly(2026, 10, 20),
            HoraTaller = new TimeOnly(9, 0),
            Lugar = "Auditorio",
            Estado = estado,
            Activo = true,
            IdUsuarioCreacion = IdEv,
        });
        _workflow.Context.SaveChanges();
    }

    private TallerImparticionService CrearServicio(Mock<IProfileService>? profileService = null)
    {
        if (profileService is null)
        {
            profileService = new Mock<IProfileService>();
            profileService
                .Setup(p => p.HasFirmaAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);
        }

        return new TallerImparticionService(
            _workflow.Context,
            _workflow.Asokam,
            profileService.Object,
            NullLogger<TallerImparticionService>.Instance);
    }

    private static GuardarTallerMaterialRequest NuevoMaterial() => new()
    {
        FechaEntrega = new DateOnly(2026, 10, 15),
        CargoPuesto = "Ejecutivo de Ventas",
        NombreProducto = "R-III",
        CantidadProducto = 30,
        IncluyeListaAsistencia = true,
        IncluyeFlayers = true,
        NombreEjecutivoRecepcion = "EV Prueba",
    };

    private static GuardarTallerAsistenciaRequest NuevaAsistencia(int numero = 1) => new()
    {
        Numero = numero,
        NombreMedico = $"Dr. Prueba {numero}",
        PuestoMedico = "Anestesiólogo",
    };

    // ----- Material -----

    [Fact]
    public async Task GuardarMaterial_Debe_HacerUpsertUnoAUno()
    {
        var servicio = CrearServicio();

        var primero = await servicio.GuardarMaterialAsync(IdTaller, NuevoMaterial(), IdAjeno);
        var segundo = await servicio.GuardarMaterialAsync(IdTaller, new GuardarTallerMaterialRequest
        {
            FechaEntrega = new DateOnly(2026, 10, 16),
            NombreProducto = "R-IV",
            CantidadProducto = 10,
        }, IdAjeno);

        primero.IdTallerMaterial.Should().Be(segundo.IdTallerMaterial);
        _workflow.Context.TalleresMateriales.Count().Should().Be(1);
        segundo.NombreProducto.Should().Be("R-IV");
        segundo.Confirmado.Should().BeFalse();
    }

    [Fact]
    public async Task ConfirmarMaterial_Debe_EstamparFirmaFechaYUsuario()
    {
        var servicio = CrearServicio();
        await servicio.GuardarMaterialAsync(IdTaller, NuevoMaterial(), IdAjeno);

        var confirmado = await servicio.ConfirmarMaterialAsync(IdTaller, new ConfirmarMaterialRequest(), IdEv);

        confirmado.Confirmado.Should().BeTrue();
        confirmado.FirmaUrl.Should().Be("/media/firmas/ev.png");
        confirmado.FechaRecepcion.Should().NotBeNull();
        confirmado.IdUsuarioRecepcion.Should().Be(IdEv);
    }

    [Fact]
    public async Task ConfirmarMaterial_SinFirmaDigital_Debe_Fallar()
    {
        var servicio = CrearServicio();
        await servicio.GuardarMaterialAsync(IdTaller, NuevoMaterial(), IdAjeno);

        var profile = new Mock<IProfileService>();
        profile.Setup(p => p.HasFirmaAsync(It.IsAny<int>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        var servicioSinFirma = CrearServicio(profile);

        var act = () => servicioSinFirma.ConfirmarMaterialAsync(IdTaller, new ConfirmarMaterialRequest(), IdEv);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*firma digital*");
    }

    [Fact]
    public async Task ConfirmarMaterial_DosVeces_Debe_Fallar()
    {
        var servicio = CrearServicio();
        await servicio.GuardarMaterialAsync(IdTaller, NuevoMaterial(), IdAjeno);
        await servicio.ConfirmarMaterialAsync(IdTaller, new ConfirmarMaterialRequest(), IdEv);

        var act = () => servicio.ConfirmarMaterialAsync(IdTaller, new ConfirmarMaterialRequest(), IdEv);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*ya fue confirmada*");
    }

    [Fact]
    public async Task ConfirmarMaterial_NoMiembroDelEquipo_Debe_Fallar()
    {
        var servicio = CrearServicio();
        await servicio.GuardarMaterialAsync(IdTaller, NuevoMaterial(), IdAjeno);

        var act = () => servicio.ConfirmarMaterialAsync(IdTaller, new ConfirmarMaterialRequest(), IdAjeno);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Ejecutivo de Ventas o el Especialista*");
    }

    // ----- Asistencias -----

    [Fact]
    public async Task CrearAsistencia_Debe_LimitarAMaximo20()
    {
        var servicio = CrearServicio();
        for (var i = 1; i <= 20; i++)
        {
            await servicio.CrearAsistenciaAsync(IdTaller, NuevaAsistencia(i), IdEp);
        }

        var act = () => servicio.CrearAsistenciaAsync(IdTaller, NuevaAsistencia(21), IdEp);

        // El DTO valida 1..20; el servicio además corta al llegar a 20 con número válido.
        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*máximo de 20*");
    }

    [Fact]
    public async Task CrearAsistencia_NumeroDuplicado_Debe_Fallar()
    {
        var servicio = CrearServicio();
        await servicio.CrearAsistenciaAsync(IdTaller, NuevaAsistencia(1), IdEp);

        var act = () => servicio.CrearAsistenciaAsync(IdTaller, NuevaAsistencia(1), IdEp);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*ya está usado*");
    }

    [Fact]
    public async Task CrearAsistencia_TallerRealizado_Debe_Fallar()
    {
        var servicio = CrearServicio();
        var taller = _workflow.Context.Talleres.Single();
        taller.Estado = Taller.EstadoRealizado;
        _workflow.Context.SaveChanges();

        var act = () => servicio.CrearAsistenciaAsync(IdTaller, NuevaAsistencia(1), IdEp);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Programado o En curso*");
    }

    [Fact]
    public async Task EliminarAsistencia_Debe_BorrarFisicamente()
    {
        var servicio = CrearServicio();
        var asistencia = await servicio.CrearAsistenciaAsync(IdTaller, NuevaAsistencia(1), IdEp);

        await servicio.EliminarAsistenciaAsync(IdTaller, asistencia.IdAsistencia, IdEp);

        _workflow.Context.TalleresAsistencias.Count().Should().Be(0);
    }

    // ----- Evidencias -----

    [Fact]
    public async Task AgregarEvidencia_TallerProgramado_Debe_Fallar()
    {
        var servicio = CrearServicio();

        var act = () => servicio.AgregarEvidenciaAsync(IdTaller, new GuardarTallerEvidenciaRequest
        {
            TipoEvidencia = "foto",
            ArchivoUrl = "/media/evidencias/1.jpg",
        }, IdEp);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*En curso*");
    }

    [Fact]
    public async Task AgregarEvidencia_EnCurso_Debe_Agregar()
    {
        var servicio = CrearServicio();
        var taller = _workflow.Context.Talleres.Single();
        taller.Estado = Taller.EstadoEnCurso;
        _workflow.Context.SaveChanges();

        var evidencia = await servicio.AgregarEvidenciaAsync(IdTaller, new GuardarTallerEvidenciaRequest
        {
            TipoEvidencia = "foto",
            ArchivoUrl = "/media/evidencias/1.jpg",
            Descripcion = "Sala llena",
        }, IdEp);

        evidencia.IdEvidencia.Should().BeGreaterThan(0);
        _workflow.Context.TalleresEvidencias.Count().Should().Be(1);
    }

    [Fact]
    public async Task AgregarEvidencia_TipoInvalido_Debe_Fallar()
    {
        var servicio = CrearServicio();
        var taller = _workflow.Context.Talleres.Single();
        taller.Estado = Taller.EstadoEnCurso;
        _workflow.Context.SaveChanges();

        var act = () => servicio.AgregarEvidenciaAsync(IdTaller, new GuardarTallerEvidenciaRequest
        {
            TipoEvidencia = "holograma",
            ArchivoUrl = "/media/evidencias/1.jpg",
        }, IdEp);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Tipo de evidencia desconocido*");
    }

    // ----- Máquina de estados -----

    [Fact]
    public async Task CambiarEstado_ProgramadoAEnCurso_Debe_RegistrarHistorialManual()
    {
        var servicio = CrearServicio();

        var dto = await servicio.CambiarEstadoAsync(IdTaller,
            new CambiarEstadoTallerRequest { NuevoEstado = Taller.EstadoEnCurso }, IdEv);

        dto.Estado.Should().Be(Taller.EstadoEnCurso);
        var historial = _workflow.Context.TalleresEstadosHistorial.Single();
        historial.EstadoAnterior.Should().Be(Taller.EstadoProgramado);
        historial.EstadoNuevo.Should().Be(Taller.EstadoEnCurso);
        historial.Origen.Should().Be(TallerEstadoHistorial.OrigenManual);
        historial.IdUsuario.Should().Be(IdEv);
    }

    [Fact]
    public async Task CambiarEstado_NoMiembro_Debe_Fallar()
    {
        var servicio = CrearServicio();

        var act = () => servicio.CambiarEstadoAsync(IdTaller,
            new CambiarEstadoTallerRequest { NuevoEstado = Taller.EstadoEnCurso }, IdAjeno);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Ejecutivo de Ventas o el Especialista*");
    }

    [Fact]
    public async Task CambiarEstado_Realizado_SinEvidenciasNiAsistencias_Debe_Fallar()
    {
        var servicio = CrearServicio();
        await servicio.CambiarEstadoAsync(IdTaller,
            new CambiarEstadoTallerRequest { NuevoEstado = Taller.EstadoEnCurso }, IdEv);

        var act = () => servicio.CambiarEstadoAsync(IdTaller,
            new CambiarEstadoTallerRequest { NuevoEstado = Taller.EstadoRealizado }, IdEv);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*1 evidencia y 1 asistencia*");
    }

    [Fact]
    public async Task CambiarEstado_Realizado_ConEvidenciaYAsistencia_Debe_EscribirFechaRealizado()
    {
        var servicio = CrearServicio();
        await servicio.CambiarEstadoAsync(IdTaller,
            new CambiarEstadoTallerRequest { NuevoEstado = Taller.EstadoEnCurso }, IdEv);
        await servicio.CrearAsistenciaAsync(IdTaller, NuevaAsistencia(1), IdEv);
        await servicio.AgregarEvidenciaAsync(IdTaller, new GuardarTallerEvidenciaRequest
        {
            TipoEvidencia = "foto",
            ArchivoUrl = "/media/evidencias/1.jpg",
        }, IdEv);

        var dto = await servicio.CambiarEstadoAsync(IdTaller,
            new CambiarEstadoTallerRequest { NuevoEstado = Taller.EstadoRealizado }, IdEp);

        dto.Estado.Should().Be(Taller.EstadoRealizado);
        dto.FechaRealizado.Should().Be(DateOnly.FromDateTime(DateTime.Today));
    }

    [Fact]
    public async Task CambiarEstado_Cancelado_SinMotivo_Debe_Fallar()
    {
        var servicio = CrearServicio();
        SembrarRol(IdGv, "Gerente de Ventas");

        var act = () => servicio.CambiarEstadoAsync(IdTaller,
            new CambiarEstadoTallerRequest { NuevoEstado = Taller.EstadoCancelado }, IdGv);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*motivo*obligatorio*");
    }

    [Fact]
    public async Task CambiarEstado_Cancelado_PorGerenteDeVentasConMotivo_Debe_Cancelar()
    {
        var servicio = CrearServicio();
        SembrarRol(IdGv, "Gerente de Ventas");

        var dto = await servicio.CambiarEstadoAsync(IdTaller,
            new CambiarEstadoTallerRequest { NuevoEstado = Taller.EstadoCancelado, Motivo = "Hospital cerrado" }, IdGv);

        dto.Estado.Should().Be(Taller.EstadoCancelado);
        var historial = _workflow.Context.TalleresEstadosHistorial.Single();
        historial.Motivo.Should().Be("Hospital cerrado");
        historial.Origen.Should().Be(TallerEstadoHistorial.OrigenManual);
    }

    [Fact]
    public async Task CambiarEstado_Cancelado_PorRolNoAutorizado_Debe_Fallar()
    {
        var servicio = CrearServicio();
        SembrarRol(IdAjeno, "Especialista de Producto");

        var act = () => servicio.CambiarEstadoAsync(IdTaller,
            new CambiarEstadoTallerRequest { NuevoEstado = Taller.EstadoCancelado, Motivo = "Motivo" }, IdAjeno);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Gerente de Ventas*");
    }

    [Fact]
    public async Task CambiarEstado_TransicionInvalida_Debe_Fallar()
    {
        var servicio = CrearServicio();

        // Programado → Realizado no es una transición permitida (debe pasar por EnCurso).
        var act = () => servicio.CambiarEstadoAsync(IdTaller,
            new CambiarEstadoTallerRequest { NuevoEstado = Taller.EstadoRealizado }, IdEv);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Transición no permitida*");
    }

    private void SembrarRol(int idUsuario, string nombreRol)
    {
        var rol = new Rol
        {
            IdRol = 8000 + idUsuario,
            NombreRol = nombreRol,
            EsActivo = true,
        };
        _workflow.Asokam.Roles.Add(rol);
        _workflow.Asokam.UsuariosRoles.Add(new UsuarioRol
        {
            IdUsuarioRol = 8000 + idUsuario,
            IdUsuario = idUsuario,
            IdRol = rol.IdRol,
            Rol = rol,
        });
        _workflow.Asokam.SaveChanges();
    }
}
