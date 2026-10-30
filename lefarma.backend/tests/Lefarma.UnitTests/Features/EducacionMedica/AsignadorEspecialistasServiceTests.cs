using FluentAssertions;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class AsignadorEspecialistasServiceTests
{
    private static readonly DateOnly Fecha = new(2026, 10, 21);

    [Fact]
    public async Task AsignarEspecialista_Debe_MoverLaVisitaALaRutaDelEspecialista()
    {
        var app = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
        var asokam = new AsokamDbContext(new DbContextOptionsBuilder<AsokamDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
        var ahora = DateTime.UtcNow;

        app.SeleccionesMensuales.Add(new SeleccionMensual
        {
            IdSeleccionMensual = 1,
            FechaSeleccion = Fecha,
            FechaInicioVigencia = new DateOnly(2026, 10, 1),
            FechaFinVigencia = new DateOnly(2026, 10, 31),
            IdTipoGerencia = 1,
            Activo = true,
        });
        app.SeleccionesRegiones.Add(new SeleccionRegion
        {
            IdRegion = 1,
            IdSeleccionMensual = 1,
            Nombre = "Región Norte",
            IdEjecutivo = 10,
            IdEspecialista = 20,
        });
        app.SeleccionesHospitales.Add(new SeleccionHospital
        {
            IdSeleccionHospital = 1,
            IdSeleccionMensual = 1,
            IdHospital = 100,
            IdRegion = 1,
            IdEjecutivo = 10,
            IdEspecialista = 20,
        });
        app.Rutas.Add(new Ruta
        {
            IdRuta = 1,
            IdSeleccionMensual = 1,
            IdEspecialista = 20,
            Version = 1,
            Nombre = "Ruta Especialista 20",
            Estado = Ruta.EstadoCreada,
            FechaCreacion = ahora,
            FechaModificacion = ahora,
        });
        app.RutasVisitas.Add(new RutaVisita
        {
            IdRutaVisita = 1,
            IdRuta = 1,
            IdSeleccionHospital = 1,
            IdHospital = 100,
            IdEjecutivo = 10,
            IdEspecialista = 20,
            FechaVisita = Fecha,
            Orden = 1,
            FechaCreacion = ahora,
            FechaModificacion = ahora,
        });
        app.EspecialistasGerencia.Add(new EspecialistaGerencia
        {
            IdEspecialistaGerencia = 1,
            IdUsuario = 30,
            IdTipoGerencia = 1,
            Activo = true,
        });
        app.ParametrosModulo.AddRange(
            new ParametroModulo { Clave = "max_visitas_dia", Valor = 3, Activo = true },
            new ParametroModulo { Clave = "max_visitas_semana", Valor = 8, Activo = true });
        asokam.Usuarios.Add(new Usuario { IdUsuario = 30, NombreCompleto = "Especialista Treinta" });

        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = new AsignadorEspecialistasService(app, asokam);
        var asignada = await service.AsignarEspecialistaAsync(
            1,
            new AsignarEspecialistaVisitaRequest { IdEspecialista = 30 },
            idUsuario: 99);

        asignada.Should().BeTrue();
        var visita = await app.RutasVisitas.SingleAsync(v => v.IdRutaVisita == 1);
        visita.IdEspecialista.Should().Be(30);
        visita.IdRuta.Should().NotBe(1);

        var rutaDestino = await app.Rutas.SingleAsync(r => r.IdRuta == visita.IdRuta);
        rutaDestino.IdEspecialista.Should().Be(30);
        rutaDestino.Version.Should().Be(1);
    }
}
