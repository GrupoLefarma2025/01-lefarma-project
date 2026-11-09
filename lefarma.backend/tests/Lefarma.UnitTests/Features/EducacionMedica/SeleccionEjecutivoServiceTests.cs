using FluentAssertions;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class SeleccionEjecutivoServiceTests
{
    [Fact]
    public async Task AsignarEjecutivoHospital_Debe_AceptarMismaRegionYRechazarOtraRegion()
    {
        var (app, asokam) = CrearContextos();
        SembrarBase(app, asokam);
        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = CrearServicio(app, asokam);
        var dto = await service.AsignarEjecutivoHospitalAsync(
            1, 1,
            new AsignarEjecutivoHospitalRequest { IdEjecutivo = 20 },
            idUsuario: 99);

        dto.Should().NotBeNull();
        dto!.IdEjecutivo.Should().Be(20);
        dto.NombreEjecutivo.Should().Be("Ejecutivo Mismo");

        var hospital = app.SeleccionesHospitales.Single(h => h.IdSeleccionHospital == 1);
        hospital.IdEjecutivo.Should().Be(20);

        var act = () => service.AsignarEjecutivoHospitalAsync(
            1, 1,
            new AsignarEjecutivoHospitalRequest { IdEjecutivo = 30 },
            idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*no tiene una región activa*");
    }

    [Fact]
    public async Task AsignarEjecutivoHospital_Debe_PermitirSuplenteYLimpiarOverride()
    {
        var (app, asokam) = CrearContextos();
        SembrarBase(app, asokam);
        app.EjecutivosSuplentes.Add(new EjecutivoSuplente
        {
            IdUsuario = 40,
            IdTipoGerencia = 1,
            IdRegionCatalogo = 1,
            Activo = true,
        });
        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = CrearServicio(app, asokam);
        var conSuplente = await service.AsignarEjecutivoHospitalAsync(
            1, 1,
            new AsignarEjecutivoHospitalRequest { IdEjecutivo = 40 },
            idUsuario: 99);

        conSuplente!.IdEjecutivo.Should().Be(40);
        conSuplente.NombreEjecutivo.Should().Be("Coordinador Suplente");

        var sinOverride = await service.AsignarEjecutivoHospitalAsync(
            1, 1,
            new AsignarEjecutivoHospitalRequest { IdEjecutivo = null },
            idUsuario: 99);

        sinOverride!.IdEjecutivo.Should().BeNull();
        app.SeleccionesHospitales.Single(h => h.IdSeleccionHospital == 1)
            .IdEjecutivo.Should().BeNull();
    }

    private static SeleccionEjecutivoService CrearServicio(
        ApplicationDbContext app,
        AsokamDbContext asokam)
    {
        return new SeleccionEjecutivoService(
            new SeleccionMensualRepository(app),
            app,
            asokam,
            new EjecutivoElegibilidadService(app));
    }

    private static void SembrarBase(ApplicationDbContext app, AsokamDbContext asokam)
    {
        app.TiposGerencia.Add(new TipoGerencia
        {
            IdTipoGerencia = 1,
            Descripcion = "IMSS",
            Activo = true,
        });
        app.RegionesCat.AddRange(
            new RegionCatalogo
            {
                IdRegion = 1,
                IdTipoGerencia = 1,
                Nombre = "Región 1",
                Activo = true,
            },
            new RegionCatalogo
            {
                IdRegion = 2,
                IdTipoGerencia = 1,
                Nombre = "Región 2",
                Activo = true,
            });
        app.SeleccionesMensuales.Add(new SeleccionMensual
        {
            IdSeleccionMensual = 1,
            FechaSeleccion = new DateOnly(2026, 10, 15),
            IdTipoGerencia = 1,
            Estado = SeleccionMensual.EstadoCreada,
            Activo = true,
        });
        app.SeleccionesRegiones.Add(new SeleccionRegion
        {
            IdRegion = 1,
            IdSeleccionMensual = 1,
            IdRegionCatalogo = 1,
            IdEjecutivo = 10,
            Nombre = "Región 1",
        });
        app.SeleccionesHospitales.Add(new SeleccionHospital
        {
            IdSeleccionHospital = 1,
            IdSeleccionMensual = 1,
            IdHospital = 100,
            IdRegion = 1,
        });
        app.EjecutivosRegion.AddRange(
            new EjecutivoRegion
            {
                IdUsuario = 20,
                IdRegionCatalogo = 1,
                Activo = true,
            },
            new EjecutivoRegion
            {
                IdUsuario = 30,
                IdRegionCatalogo = 2,
                Activo = true,
            });

        asokam.Usuarios.AddRange(
            new Usuario { IdUsuario = 10, NombreCompleto = "Ejecutivo Default" },
            new Usuario { IdUsuario = 20, NombreCompleto = "Ejecutivo Mismo" },
            new Usuario { IdUsuario = 30, NombreCompleto = "Ejecutivo Otra Región" },
            new Usuario { IdUsuario = 40, NombreCompleto = "Coordinador Suplente" });
    }

    private static (ApplicationDbContext App, AsokamDbContext Asokam) CrearContextos()
    {
        var app = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
        var asokam = new AsokamDbContext(new DbContextOptionsBuilder<AsokamDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
        return (app, asokam);
    }
}
