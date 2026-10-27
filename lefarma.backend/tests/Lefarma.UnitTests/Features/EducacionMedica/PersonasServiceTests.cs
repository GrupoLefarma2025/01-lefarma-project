using FluentAssertions;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class PersonasServiceTests
{
    [Fact]
    public async Task CrearEjecutivoAsync_Debe_Rechazar_RegionesDeOtraGerencia()
    {
        var (app, asokam) = CrearContextos();
        SeedCatalogos(app);
        asokam.Usuarios.Add(new Usuario { IdUsuario = 10, NombreCompleto = "Ejecutivo 10" });
        await asokam.SaveChangesAsync();

        var service = new PersonasService(app, asokam);

        await service.CrearEjecutivoAsync(new CrearEjecutivoRegionRequest
        {
            IdUsuario = 10,
            IdRegionCatalogo = 1,
        }, idUsuario: 99);

        var act = () => service.CrearEjecutivoAsync(new CrearEjecutivoRegionRequest
        {
            IdUsuario = 10,
            IdRegionCatalogo = 2,
        }, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*misma gerencia*");
    }

    [Fact]
    public async Task GuardarEspecialistaAsync_Debe_ReemplazarGerenciasYRegion()
    {
        var (app, asokam) = CrearContextos();
        SeedCatalogos(app);
        asokam.Usuarios.Add(new Usuario { IdUsuario = 20, NombreCompleto = "Especialista 20" });
        await asokam.SaveChangesAsync();

        var service = new PersonasService(app, asokam);

        var inicial = await service.GuardarEspecialistaAsync(new GuardarEspecialistaRequest
        {
            IdUsuario = 20,
            IdsTipoGerencia = [1, 2],
            IdRegionCatalogo = 1,
        }, idUsuario: 99);

        inicial.Gerencias.Where(g => g.Activo).Should().HaveCount(2);
        inicial.RegionPreferida!.IdRegionCatalogo.Should().Be(1);

        var actualizado = await service.GuardarEspecialistaAsync(new GuardarEspecialistaRequest
        {
            IdUsuario = 20,
            IdsTipoGerencia = [2, 3],
            IdRegionCatalogo = null,
        }, idUsuario: 99);

        actualizado.Gerencias.Where(g => g.Activo).Select(g => g.IdTipoGerencia)
            .Should().BeEquivalentTo([2, 3]);
        actualizado.Gerencias.Should().Contain(g => g.IdTipoGerencia == 1 && !g.Activo);
        actualizado.RegionPreferida.Should().NotBeNull();
        actualizado.RegionPreferida!.Activo.Should().BeFalse();
    }

    [Fact]
    public async Task CrearEjecutivoSuplente_Debe_DerivarGerenciaDeRegionYListar()
    {
        var (app, asokam) = CrearContextos();
        SeedCatalogos(app);
        asokam.Usuarios.Add(new Usuario { IdUsuario = 30, NombreCompleto = "Coordinador 30" });
        await asokam.SaveChangesAsync();

        var service = new PersonasService(app, asokam);
        var creado = await service.CrearEjecutivoSuplenteAsync(new CrearEjecutivoSuplenteRequest
        {
            IdUsuario = 30,
            IdRegionCatalogo = 1,
        }, idUsuario: 99);

        creado.IdTipoGerencia.Should().Be(1);
        creado.NombreGerencia.Should().Be("IMSS");
        creado.NombreRegion.Should().Be("Región IMSS");
        creado.Activo.Should().BeTrue();

        var listado = await service.GetEjecutivosSuplentesAsync(null, null, true);
        listado.Should().ContainSingle(s =>
            s.IdUsuario == 30
            && s.IdTipoGerencia == 1
            && s.IdRegionCatalogo == 1);
    }

    [Fact]
    public async Task CrearEjecutivoSuplente_Debe_PermitirCoberturaTotalYRechazarGerenciaIncompatible()
    {
        var (app, asokam) = CrearContextos();
        SeedCatalogos(app);
        asokam.Usuarios.Add(new Usuario { IdUsuario = 31, NombreCompleto = "Coordinador 31" });
        await asokam.SaveChangesAsync();

        var service = new PersonasService(app, asokam);
        var total = await service.CrearEjecutivoSuplenteAsync(new CrearEjecutivoSuplenteRequest
        {
            IdUsuario = 31,
        }, idUsuario: 99);

        total.IdTipoGerencia.Should().BeNull();
        total.NombreGerencia.Should().Be("Todas");
        total.NombreRegion.Should().Be("Todas");

        var act = () => service.CrearEjecutivoSuplenteAsync(new CrearEjecutivoSuplenteRequest
        {
            IdUsuario = 31,
            IdTipoGerencia = 2,
            IdRegionCatalogo = 1,
        }, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*no pertenece a la gerencia*");
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

    private static void SeedCatalogos(ApplicationDbContext app)
    {
        app.TiposGerencia.AddRange(
            new TipoGerencia { IdTipoGerencia = 1, Descripcion = "IMSS", Activo = true },
            new TipoGerencia { IdTipoGerencia = 2, Descripcion = "Descentralizado", Activo = true },
            new TipoGerencia { IdTipoGerencia = 3, Descripcion = "IMSS Bienestar", Activo = true });

        app.RegionesCat.AddRange(
            new RegionCatalogo { IdRegion = 1, IdTipoGerencia = 1, Nombre = "Región IMSS", Activo = true },
            new RegionCatalogo { IdRegion = 2, IdTipoGerencia = 2, Nombre = "Región Desc.", Activo = true });

        app.SaveChanges();
    }
}
