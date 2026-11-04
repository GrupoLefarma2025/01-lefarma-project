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

    [Fact]
    public async Task AsignarEspecialista_RutaArchivada_Debe_Fallar()
    {
        var (app, asokam) = CrearContextos();
        app.Rutas.Add(new Ruta
        {
            IdRuta = 1,
            IdSeleccionMensual = 1,
            Version = 1,
            Estado = Ruta.EstadoArchivada,
            Nombre = "Ruta archivada",
        });
        app.RutasVisitas.Add(new RutaVisita
        {
            IdRutaVisita = 1,
            IdRuta = 1,
            FechaVisita = new DateOnly(2026, 11, 2),
            Orden = 1,
        });
        await app.SaveChangesAsync();

        var service = new AsignadorEspecialistasService(app, asokam);
        var act = () => service.AsignarEspecialistaAsync(
            1,
            new AsignarEspecialistaVisitaRequest { IdEspecialista = 30 },
            idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*solo lectura*");
    }

    [Fact]
    public async Task GetSugerenciasAsync_Debe_IgnorarVisitasDeRutasArchivadas()
    {
        var (app, asokam) = CrearContextos();
        var dia2 = new DateOnly(2026, 11, 2);
        var dia3 = new DateOnly(2026, 11, 3);

        SeedSeleccion(app, asokam);
        app.Rutas.AddRange(
            new Ruta
            {
                IdRuta = 1,
                IdSeleccionMensual = 1,
                IdEspecialista = 30,
                Version = 1,
                Estado = Ruta.EstadoArchivada,
                Nombre = "Ruta archivada",
            },
            new Ruta
            {
                IdRuta = 2,
                IdSeleccionMensual = 1,
                IdEspecialista = 20,
                Version = 2,
                Estado = Ruta.EstadoCreada,
                Nombre = "Ruta activa",
            });
        app.RutasVisitas.AddRange(
            new RutaVisita
            {
                IdRutaVisita = 1,
                IdRuta = 1,
                IdSeleccionHospital = 1,
                IdHospital = 100,
                IdEjecutivo = 10,
                IdEspecialista = 30,
                FechaVisita = dia3,
                Orden = 1,
            },
            new RutaVisita
            {
                IdRutaVisita = 2,
                IdRuta = 2,
                IdSeleccionHospital = 1,
                IdHospital = 100,
                IdEjecutivo = 10,
                IdEspecialista = 20,
                FechaVisita = dia2,
                Orden = 1,
            },
            new RutaVisita
            {
                IdRutaVisita = 3,
                IdRuta = 2,
                IdSeleccionHospital = 1,
                IdHospital = 100,
                IdEjecutivo = 10,
                FechaVisita = dia3,
                Orden = 1,
            });
        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = new AsignadorEspecialistasService(app, asokam);
        var sugerencias = await service.GetSugerenciasAsync(
            1, new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 30));

        var sugerencia = sugerencias.Single(s => s.IdRutaVisita == 3);
        sugerencia.IdEspecialista.Should().Be(30);
        sugerencia.CargaDia.Should().Be(0);
        sugerencia.CargaSemana.Should().Be(0);
        sugerencia.Motivo.Should().Be("Menor carga semanal");
    }

    [Fact]
    public async Task GetSugerenciasAsync_Debe_MostrarHistorialDeTalleresRealizados()
    {
        var (app, asokam) = CrearContextos();
        var dia3 = new DateOnly(2026, 11, 3);

        SeedSeleccion(app, asokam);
        app.Rutas.Add(new Ruta
        {
            IdRuta = 2,
            IdSeleccionMensual = 1,
            IdEspecialista = 20,
            Version = 2,
            Estado = Ruta.EstadoCreada,
            Nombre = "Ruta activa",
        });
        app.RutasVisitas.Add(new RutaVisita
        {
            IdRutaVisita = 3,
            IdRuta = 2,
            IdSeleccionHospital = 1,
            IdHospital = 100,
            IdEjecutivo = 10,
            FechaVisita = dia3,
            Orden = 1,
        });
        app.Talleres.Add(new Taller
        {
            IdTaller = 1,
            IdHospital = 100,
            IdEspecialista = 30,
            FechaTaller = new DateOnly(2026, 9, 15),
            FechaRealizado = new DateOnly(2026, 9, 15),
            Estado = Taller.EstadoRealizado,
            Activo = true,
        });
        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = new AsignadorEspecialistasService(app, asokam);
        var sugerencias = await service.GetSugerenciasAsync(
            1, new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 30));

        var sugerencia = sugerencias.Single(s => s.IdRutaVisita == 3);
        sugerencia.IdEspecialista.Should().Be(30);
        sugerencia.HaVisitadoHospital.Should().BeTrue();
        sugerencia.VisitasRealizadasHospital.Should().Be(1);
        sugerencia.UltimaVisitaHospital.Should().Be(new DateOnly(2026, 9, 15));
    }

    [Fact]
    public async Task GetSugerenciasAsync_Debe_CalcularCargaMensualYDiaConsecutivo()
    {
        var (app, asokam) = CrearContextos();
        var dia2 = new DateOnly(2026, 11, 2);
        var dia3 = new DateOnly(2026, 11, 3);
        var dia10 = new DateOnly(2026, 11, 10);

        SeedSeleccion(app, asokam);
        app.Rutas.AddRange(
            new Ruta
            {
                IdRuta = 2,
                IdSeleccionMensual = 1,
                IdEspecialista = 20,
                Version = 2,
                Estado = Ruta.EstadoCreada,
                Nombre = "Ruta activa",
            },
            new Ruta
            {
                IdRuta = 3,
                IdSeleccionMensual = 1,
                IdEspecialista = 30,
                Version = 2,
                Estado = Ruta.EstadoCreada,
                Nombre = "Ruta especialista 30",
            });
        app.RutasVisitas.AddRange(
            new RutaVisita
            {
                IdRutaVisita = 3,
                IdRuta = 2,
                IdSeleccionHospital = 1,
                IdHospital = 100,
                IdEjecutivo = 10,
                FechaVisita = dia3,
                Orden = 1,
            },
            new RutaVisita
            {
                IdRutaVisita = 4,
                IdRuta = 3,
                IdHospital = 101,
                IdEjecutivo = 10,
                IdEspecialista = 30,
                FechaVisita = dia2,
                Orden = 1,
            },
            new RutaVisita
            {
                IdRutaVisita = 5,
                IdRuta = 3,
                IdHospital = 101,
                IdEjecutivo = 10,
                IdEspecialista = 30,
                FechaVisita = dia10,
                Orden = 2,
            });
        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = new AsignadorEspecialistasService(app, asokam);
        var sugerencias = await service.GetSugerenciasAsync(
            1, new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 30));

        var sugerencia = sugerencias.Single(s => s.IdRutaVisita == 3);
        sugerencia.IdEspecialista.Should().Be(30);
        sugerencia.CargaMes.Should().Be(2);
        sugerencia.TieneDiaConsecutivo.Should().BeTrue();
        sugerencia.MismaInstitucion.Should().BeTrue();
        sugerencia.Institucion.Should().Be("Institución Padre");
    }

    [Fact]
    public async Task GetSugerenciasAsync_Debe_UsarPesosConfigurados()
    {
        var (app, asokam) = CrearContextos();
        var dia3 = new DateOnly(2026, 11, 3);

        SeedSeleccion(app, asokam);
        app.EspecialistasGerencia.Add(new EspecialistaGerencia
        {
            IdEspecialistaGerencia = 2,
            IdUsuario = 40,
            IdTipoGerencia = 1,
            Activo = true,
        });
        app.Rutas.AddRange(
            new Ruta
            {
                IdRuta = 2,
                IdSeleccionMensual = 1,
                IdEspecialista = 20,
                Version = 2,
                Estado = Ruta.EstadoCreada,
                Nombre = "Ruta activa",
            },
            new Ruta
            {
                IdRuta = 3,
                IdSeleccionMensual = 1,
                IdEspecialista = 30,
                Version = 2,
                Estado = Ruta.EstadoCreada,
                Nombre = "Ruta especialista 30",
            });
        app.RutasVisitas.AddRange(
            new RutaVisita
            {
                IdRutaVisita = 3,
                IdRuta = 2,
                IdSeleccionHospital = 1,
                IdHospital = 100,
                IdEjecutivo = 10,
                FechaVisita = dia3,
                Orden = 1,
            },
            new RutaVisita
            {
                IdRutaVisita = 4,
                IdRuta = 3,
                IdSeleccionHospital = 1,
                IdHospital = 100,
                IdEjecutivo = 10,
                IdEspecialista = 30,
                FechaVisita = dia3,
                Orden = 1,
            });
        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = new AsignadorEspecialistasService(app, asokam);
        var porDefecto = await service.GetSugerenciasAsync(
            1, new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 30));

        porDefecto.Single(s => s.IdRutaVisita == 3).IdEspecialista.Should().Be(30);

        app.ParametrosModulo.AddRange(
            new ParametroModulo
            {
                Clave = "sugerencia_peso_misma_ciudad_dia",
                Valor = 0,
                Activo = true,
            },
            new ParametroModulo
            {
                Clave = "sugerencia_peso_misma_ciudad_cerca",
                Valor = 0,
                Activo = true,
            },
            new ParametroModulo
            {
                Clave = "sugerencia_peso_misma_institucion",
                Valor = 0,
                Activo = true,
            });
        await app.SaveChangesAsync();

        var personalizado = await service.GetSugerenciasAsync(
            1, new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 30));

        personalizado.Single(s => s.IdRutaVisita == 3).IdEspecialista.Should().Be(40);
    }

    [Fact]
    public async Task GetSugerenciasAsync_Debe_UsarVentanaDeCercaniaConfigurada()
    {
        var (app, asokam) = CrearContextos();
        var dia3 = new DateOnly(2026, 11, 3);
        var dia5 = new DateOnly(2026, 11, 5);

        SeedSeleccion(app, asokam);
        app.EspecialistasGerencia.Add(new EspecialistaGerencia
        {
            IdEspecialistaGerencia = 2,
            IdUsuario = 40,
            IdTipoGerencia = 1,
            Activo = true,
        });
        app.Rutas.AddRange(
            new Ruta
            {
                IdRuta = 2,
                IdSeleccionMensual = 1,
                IdEspecialista = 20,
                Version = 2,
                Estado = Ruta.EstadoCreada,
                Nombre = "Ruta activa",
            },
            new Ruta
            {
                IdRuta = 3,
                IdSeleccionMensual = 1,
                IdEspecialista = 30,
                Version = 2,
                Estado = Ruta.EstadoCreada,
                Nombre = "Ruta especialista 30",
            });
        app.RutasVisitas.AddRange(
            new RutaVisita
            {
                IdRutaVisita = 3,
                IdRuta = 2,
                IdSeleccionHospital = 1,
                IdHospital = 100,
                IdEjecutivo = 10,
                FechaVisita = dia3,
                Orden = 1,
            },
            new RutaVisita
            {
                IdRutaVisita = 4,
                IdRuta = 3,
                IdSeleccionHospital = 1,
                IdHospital = 100,
                IdEjecutivo = 10,
                IdEspecialista = 30,
                FechaVisita = dia5,
                Orden = 1,
            });
        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = new AsignadorEspecialistasService(app, asokam);
        var porDefecto = await service.GetSugerenciasAsync(
            1, new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 30));

        porDefecto.Single(s => s.IdRutaVisita == 3).IdEspecialista.Should().Be(40);

        app.ParametrosModulo.Add(new ParametroModulo
        {
            Clave = "sugerencia_ventana_dias_cercania",
            Valor = 2,
            Activo = true,
        });
        await app.SaveChangesAsync();

        var ampliada = await service.GetSugerenciasAsync(
            1, new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 30));

        ampliada.Single(s => s.IdRutaVisita == 3).IdEspecialista.Should().Be(30);
    }

    [Fact]
    public async Task GetSugerenciasAsync_Debe_DistribuirEspecialistasSinHistorial()
    {
        var (app, asokam) = CrearContextos();
        var dia = new DateOnly(2026, 11, 3);

        SeedSeleccion(app, asokam);
        app.EspecialistasGerencia.Add(new EspecialistaGerencia
        {
            IdEspecialistaGerencia = 2,
            IdUsuario = 40,
            IdTipoGerencia = 1,
            Activo = true,
        });
        app.SeleccionesHospitales.Add(new SeleccionHospital
        {
            IdSeleccionHospital = 2,
            IdSeleccionMensual = 1,
            IdHospital = 102,
            IdRegion = 1,
            IdEjecutivo = 10,
            IdEspecialista = 20,
            CiudadMunicipio = "Guadalajara",
        });
        asokam.Usuarios.Add(new Usuario { IdUsuario = 40, NombreCompleto = "Especialista Cuarenta" });
        asokam.Hospitales.Add(new Hospital
        {
            CodigoContacto = 102,
            NombreContacto = "Hospital Occidente",
            CodigoContactoPrincipal = 99,
            Ciudad = "Guadalajara",
        });
        app.Rutas.Add(new Ruta
        {
            IdRuta = 2,
            IdSeleccionMensual = 1,
            IdEspecialista = 20,
            Version = 1,
            Estado = Ruta.EstadoCreada,
            Nombre = "Ruta activa",
        });
        app.RutasVisitas.AddRange(
            new RutaVisita
            {
                IdRutaVisita = 3,
                IdRuta = 2,
                IdSeleccionHospital = 1,
                IdHospital = 100,
                FechaVisita = dia,
                Orden = 1,
            },
            new RutaVisita
            {
                IdRutaVisita = 4,
                IdRuta = 2,
                IdSeleccionHospital = 2,
                IdHospital = 102,
                FechaVisita = dia,
                Orden = 2,
            });
        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = new AsignadorEspecialistasService(app, asokam);
        var sugerencias = await service.GetSugerenciasAsync(
            1, new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 30));

        sugerencias.Should().HaveCount(2);
        sugerencias.Select(s => s.IdEspecialista).Distinct().Should().HaveCount(2);
    }

    [Fact]
    public async Task GetSugerenciasAsync_Debe_CalcularHistorialPorHospitalCiudadRegionEInstitucion()
    {
        var (app, asokam) = CrearContextos();
        var diaVisita = new DateOnly(2026, 11, 3);

        SeedSeleccion(app, asokam);
        app.EspecialistasGerencia.Add(new EspecialistaGerencia
        {
            IdEspecialistaGerencia = 2,
            IdUsuario = 40,
            IdTipoGerencia = 1,
            Activo = true,
        });
        asokam.Usuarios.Add(new Usuario { IdUsuario = 40, NombreCompleto = "Especialista Cuarenta" });
        asokam.Hospitales.Add(new Hospital
        {
            CodigoContacto = 102,
            NombreContacto = "Hospital Occidente",
            CodigoContactoPrincipal = 99,
            Ciudad = "Guadalajara",
        });
        app.Rutas.Add(new Ruta
        {
            IdRuta = 2,
            IdSeleccionMensual = 1,
            IdEspecialista = 20,
            Version = 1,
            Estado = Ruta.EstadoCreada,
            Nombre = "Ruta activa",
        });
        app.RutasVisitas.Add(new RutaVisita
        {
            IdRutaVisita = 3,
            IdRuta = 2,
            IdSeleccionHospital = 1,
            IdHospital = 100,
            FechaVisita = diaVisita,
            Orden = 1,
        });
        app.Talleres.AddRange(
            new Taller
            {
                IdTaller = 1,
                IdHospital = 100,
                Region = "Región Norte",
                CiudadMunicipio = "Monterrey",
                IdEspecialista = 30,
                FechaTaller = new DateOnly(2026, 9, 10),
                FechaRealizado = new DateOnly(2026, 9, 10),
                Estado = Taller.EstadoRealizado,
                Activo = true,
            },
            new Taller
            {
                IdTaller = 2,
                IdHospital = 101,
                Region = "Región Norte",
                CiudadMunicipio = "Monterrey",
                IdEspecialista = 30,
                FechaTaller = new DateOnly(2026, 9, 20),
                FechaRealizado = new DateOnly(2026, 9, 20),
                Estado = Taller.EstadoRealizado,
                Activo = true,
            },
            new Taller
            {
                IdTaller = 3,
                IdHospital = 101,
                Region = "Región Norte",
                CiudadMunicipio = "Monterrey",
                IdEspecialista = 30,
                FechaTaller = new DateOnly(2026, 9, 25),
                FechaRealizado = new DateOnly(2026, 9, 25),
                Estado = Taller.EstadoRealizado,
                Activo = true,
            },
            new Taller
            {
                IdTaller = 4,
                IdHospital = 102,
                Region = "Occidente",
                CiudadMunicipio = "Guadalajara",
                IdEspecialista = 30,
                FechaTaller = new DateOnly(2026, 9, 26),
                FechaRealizado = new DateOnly(2026, 9, 26),
                Estado = Taller.EstadoRealizado,
                Activo = true,
            },
            new Taller
            {
                IdTaller = 5,
                IdHospital = 100,
                Region = "Región Norte",
                CiudadMunicipio = "Monterrey",
                IdEspecialista = 30,
                FechaTaller = new DateOnly(2026, 12, 1),
                FechaRealizado = new DateOnly(2026, 12, 1),
                Estado = Taller.EstadoRealizado,
                Activo = true,
            });
        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = new AsignadorEspecialistasService(app, asokam);
        var sugerencias = await service.GetSugerenciasAsync(
            1, new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 30));

        var sugerencia = sugerencias.Single(s => s.IdRutaVisita == 3);
        sugerencia.IdEspecialista.Should().Be(30);
        sugerencia.Region.Should().Be("Región Norte");
        sugerencia.HaVisitadoHospital.Should().BeTrue();
        sugerencia.VisitasRealizadasHospital.Should().Be(1);
        sugerencia.UltimaVisitaHospital.Should().Be(new DateOnly(2026, 9, 10));
        sugerencia.HaVisitadoCiudad.Should().BeTrue();
        sugerencia.VisitasRealizadasCiudad.Should().Be(3);
        sugerencia.UltimaVisitaCiudad.Should().Be(new DateOnly(2026, 9, 25));
        sugerencia.HaVisitadoRegion.Should().BeTrue();
        sugerencia.VisitasRealizadasRegion.Should().Be(3);
        sugerencia.HaVisitadoInstitucion.Should().BeTrue();
        sugerencia.VisitasRealizadasInstitucion.Should().Be(4);
        sugerencia.UltimaVisitaInstitucion.Should().Be(new DateOnly(2026, 9, 26));
        sugerencia.Motivo.Should().Be("Ya visitó este hospital 1 vez(ces)");
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

    private static void SeedSeleccion(ApplicationDbContext app, AsokamDbContext asokam)
    {
        app.SeleccionesMensuales.Add(new SeleccionMensual
        {
            IdSeleccionMensual = 1,
            FechaSeleccion = new DateOnly(2026, 11, 1),
            FechaInicioVigencia = new DateOnly(2026, 11, 1),
            FechaFinVigencia = new DateOnly(2026, 11, 30),
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
            CiudadMunicipio = "Monterrey",
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

        asokam.Usuarios.AddRange(
            new Usuario { IdUsuario = 20, NombreCompleto = "Especialista Veinte" },
            new Usuario { IdUsuario = 30, NombreCompleto = "Especialista Treinta" });
        asokam.Hospitales.AddRange(
            new Hospital
            {
                CodigoContacto = 100,
                NombreContacto = "Hospital Central",
                CodigoContactoPrincipal = 99,
                Ciudad = "Monterrey",
            },
            new Hospital
            {
                CodigoContacto = 101,
                NombreContacto = "Hospital Norte",
                CodigoContactoPrincipal = 99,
                Ciudad = "Monterrey",
            },
            new Hospital
            {
                CodigoContacto = 99,
                NombreContacto = "Institución Padre",
            });
    }
}
