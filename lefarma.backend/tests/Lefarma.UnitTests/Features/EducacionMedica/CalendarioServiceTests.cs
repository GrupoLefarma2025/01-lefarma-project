using FluentAssertions;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class CalendarioServiceTests
{
    private static readonly DateOnly Fecha = new(2026, 10, 21);

    [Fact]
    public async Task GetCalendarioAsync_Debe_UnificarVisitaYTallerConNombresYCandado()
    {
        var (app, asokam) = CrearContextos();
        SeedBase(app);
        SeedAsokam(asokam);
        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = new CalendarioService(app, asokam);

        var items = await service.GetCalendarioAsync(new CalendarioFiltro
        {
            IdSeleccion = 1,
        });

        var item = items.Should().ContainSingle().Subject;
        item.IdRutaVisita.Should().Be(1);
        item.IdTaller.Should().Be(1);
        item.Hospital.Should().Be("Hospital Central");
        item.Institucion.Should().Be("Institución Padre");
        item.Region.Should().Be("Región Norte");
        item.Gerencia.Should().Be("IMSS");
        item.NombreEjecutivo.Should().Be("Ejecutivo Diez");
        item.NombreEspecialista.Should().Be("Especialista Veinte");
        item.TipoVisita.Should().Be("Taller");
        item.Tema.Should().Be("Tema de prueba");
        item.Producto.Should().Be("Producto Cinco");
        item.Cantidad.Should().Be(2);
        item.Participantes.Should().Be(25);
        item.Estado.Should().Be(Taller.EstadoProgramado);
        item.Bloqueado.Should().BeTrue();
        item.SolicitudCambioPendiente.Should().BeTrue();
        item.Conflictos.Should().BeEmpty();
    }

    [Fact]
    public async Task GetCalendarioAsync_Debe_ReportarCapacidadExcedidaYSinEspecialista()
    {
        var (app, asokam) = CrearContextos();
        SeedBase(app);
        SeedAsokam(asokam);

        for (var i = 2; i <= 4; i++)
        {
            app.RutasVisitas.Add(new RutaVisita
            {
                IdRutaVisita = i,
                IdRuta = 1,
                IdSeleccionHospital = 1,
                IdHospital = 100,
                IdEjecutivo = 10,
                IdEspecialista = 20,
                IdTipoVisita = 1,
                FechaVisita = Fecha,
                HoraSalida = new TimeOnly(8 + i, 0),
                Orden = i,
            });
        }

        app.RutasVisitas.Add(new RutaVisita
        {
            IdRutaVisita = 5,
            IdRuta = 1,
            IdSeleccionHospital = 1,
            IdHospital = 100,
            IdEjecutivo = 10,
            IdTipoVisita = 1,
            FechaVisita = Fecha.AddDays(1),
            Orden = 1,
        });

        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = new CalendarioService(app, asokam);

        var items = await service.GetCalendarioAsync(new CalendarioFiltro
        {
            IdSeleccion = 1,
        });

        items.Should().HaveCount(5);
        items.Where(i => i.IdRutaVisita <= 4).Should().OnlyContain(i =>
            i.Conflictos.Contains("Capacidad diaria excedida (4/3)"));
        items.Single(i => i.IdRutaVisita == 5).Conflictos
            .Should().Contain("Hospital sin especialista");
    }

    [Fact]
    public async Task GetItemAsync_Debe_RetornarNullSiNoExisteLaVisita()
    {
        var (app, asokam) = CrearContextos();
        var service = new CalendarioService(app, asokam);

        var item = await service.GetItemAsync(999);

        item.Should().BeNull();
    }

    private static void SeedBase(ApplicationDbContext app)
    {
        app.TiposGerencia.Add(new TipoGerencia
        {
            IdTipoGerencia = 1,
            Descripcion = "IMSS",
            Activo = true,
        });
        app.TiposVisita.Add(new TipoVisita
        {
            IdTipoVisita = 1,
            Clave = "TALLER",
            Descripcion = "Taller",
            EsTaller = true,
            Activo = true,
        });
        app.TemasTaller.Add(new TemaTaller
        {
            IdTemaTaller = 1,
            Clave = "TEMA",
            Descripcion = "Tema de prueba",
            Activo = true,
        });
        app.ParametrosModulo.AddRange(
            new ParametroModulo { Clave = "max_visitas_dia", Valor = 3, Activo = true },
            new ParametroModulo { Clave = "max_visitas_semana", Valor = 8, Activo = true });
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
            Estado = Ruta.EstadoCreada,
        });
        app.RutasVisitas.Add(new RutaVisita
        {
            IdRutaVisita = 1,
            IdRuta = 1,
            IdSeleccionHospital = 1,
            IdHospital = 100,
            IdEjecutivo = 10,
            IdEspecialista = 20,
            IdTipoVisita = 1,
            FechaVisita = Fecha,
            HoraSalida = new TimeOnly(9, 0),
            Orden = 1,
        });
        app.Talleres.Add(new Taller
        {
            IdTaller = 1,
            IdSeleccionHospital = 1,
            IdHospital = 100,
            IdRutaVisita = 1,
            IdTemaTaller = 1,
            IdEjecutivo = 10,
            IdEspecialista = 20,
            NumeroParticipantes = 25,
            FechaTaller = Fecha,
            HoraTaller = new TimeOnly(9, 0),
            Estado = Taller.EstadoProgramado,
            Recursos =
            [
                new TallerRecurso
                {
                    IdTallerRecurso = 1,
                    IdTaller = 1,
                    TipoRecurso = TallerRecurso.RecursoProducto,
                    IdProducto = "5",
                    Cantidad = 2,
                },
            ],
        });
        app.TalleresSolicitudesCambio.Add(new TallerSolicitudCambio
        {
            IdSolicitud = 1,
            IdTaller = 1,
            Estado = TallerSolicitudCambio.EstadoPendiente,
        });
        app.EspecialistasGerencia.Add(new EspecialistaGerencia
        {
            IdEspecialistaGerencia = 1,
            IdUsuario = 20,
            IdTipoGerencia = 1,
            Activo = true,
        });
    }

    private static void SeedAsokam(AsokamDbContext asokam)
    {
        asokam.Usuarios.AddRange(
            new Usuario { IdUsuario = 10, NombreCompleto = "Ejecutivo Diez" },
            new Usuario { IdUsuario = 20, NombreCompleto = "Especialista Veinte" });
        asokam.Hospitales.AddRange(
            new Hospital
            {
                CodigoContacto = 100,
                NombreContacto = "Hospital Central",
                CodigoContactoPrincipal = 99,
            },
            new Hospital
            {
                CodigoContacto = 99,
                NombreContacto = "Institución Padre",
            });
        asokam.Productos.Add(new Producto
        {
            CodigoProducto = 5,
            NombreInternoProducto = "Producto Cinco",
        });
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
