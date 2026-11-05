using System.Text.Json;
using FluentAssertions;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.Config;
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
        }, 0, true);

        var item = items.Should().ContainSingle().Subject;
        item.IdRutaVisita.Should().Be(1);
        item.IdTaller.Should().Be(1);
        item.TieneTalleres.Should().BeTrue();
        item.TalleresCount.Should().Be(1);
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
    public async Task GetCalendarioAsync_Debe_AplicarAlcancePorGerenciaCuandoNoVeTodas()
    {
        var (app, asokam) = CrearContextos();
        SeedBase(app);
        SeedAsokam(asokam);
        app.RutasVisitas.Add(new RutaVisita
        {
            IdRutaVisita = 2,
            IdRuta = 1,
            IdSeleccionHospital = 1,
            IdHospital = 100,
            IdEjecutivo = 30,
            IdEspecialista = 40,
            IdTipoVisita = 1,
            FechaVisita = Fecha,
            HoraSalida = new TimeOnly(10, 0),
            Orden = 2,
        });
        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = new CalendarioService(app, asokam);

        var propiasEjecutivo = await service.GetCalendarioAsync(
            new CalendarioFiltro { IdSeleccion = 1 }, 10, false);
        var propiasEspecialista = await service.GetCalendarioAsync(
            new CalendarioFiltro { IdSeleccion = 1 }, 20, false);
        var ajenas = await service.GetCalendarioAsync(
            new CalendarioFiltro { IdSeleccion = 1 }, 30, false);
        var todas = await service.GetCalendarioAsync(
            new CalendarioFiltro { IdSeleccion = 1 }, 10, true);

        propiasEjecutivo.Should().ContainSingle().Which.IdRutaVisita.Should().Be(1);
        propiasEspecialista.Should().HaveCount(2);
        propiasEspecialista.Select(i => i.IdRutaVisita).Should().BeEquivalentTo([1, 2]);
        ajenas.Should().ContainSingle().Which.IdRutaVisita.Should().Be(2);
        todas.Should().HaveCount(2);

        var detalleAjeno = await service.GetItemAsync(2, 10, false);
        var detallePropio = await service.GetItemAsync(2, 30, false);
        var detalleGerenciaEspecialista = await service.GetItemAsync(2, 20, false);
        var actividadAjena = await service.GetActividadVisitaAsync(2, 10, false);

        detalleAjeno.Should().BeNull();
        detallePropio.Should().NotBeNull();
        detalleGerenciaEspecialista.Should().NotBeNull();
        actividadAjena.Should().BeNull();
    }

    [Fact]
    public async Task GetCalendarioAsync_Debe_IncluirTodaLaGerenciaDelEjecutivo()
    {
        var (app, asokam) = CrearContextos();
        SeedBase(app);
        SeedAsokam(asokam);
        app.RegionesCat.Add(new RegionCatalogo
        {
            IdRegion = 1,
            IdTipoGerencia = 1,
            Nombre = "Región Norte",
            Activo = true,
        });
        app.EjecutivosRegion.Add(new EjecutivoRegion
        {
            IdEjecutivoRegion = 1,
            IdUsuario = 50,
            IdRegionCatalogo = 1,
            Activo = true,
        });
        app.RutasVisitas.Add(new RutaVisita
        {
            IdRutaVisita = 2,
            IdRuta = 1,
            IdSeleccionHospital = 1,
            IdHospital = 100,
            IdEjecutivo = 30,
            IdEspecialista = 40,
            FechaVisita = Fecha,
            HoraSalida = new TimeOnly(10, 0),
            Orden = 2,
        });
        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = new CalendarioService(app, asokam);
        var visibles = await service.GetCalendarioAsync(
            new CalendarioFiltro { IdSeleccion = 1 }, 50, false);

        visibles.Should().HaveCount(2);
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
        }, 0, true);

        items.Should().HaveCount(5);
        items.Where(i => i.IdRutaVisita <= 4).Should().OnlyContain(i =>
            i.Conflictos.Contains("Capacidad diaria excedida (4/3)"));
        items.Single(i => i.IdRutaVisita == 5).Conflictos
            .Should().Contain("Hospital sin especialista");
    }

    [Fact]
    public async Task GetCalendarioAsync_Debe_OcultarRutasArchivadasYMostrarlasAlConsultarSuVersion()
    {
        var (app, asokam) = CrearContextos();
        SeedBase(app);
        SeedAsokam(asokam);
        await app.SaveChangesAsync();
        app.Rutas.Single().Estado = Ruta.EstadoArchivada;
        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = new CalendarioService(app, asokam);

        var activas = await service.GetCalendarioAsync(new CalendarioFiltro
        {
            IdSeleccion = 1,
        }, 0, true);
        var historicas = await service.GetCalendarioAsync(new CalendarioFiltro
        {
            IdSeleccion = 1,
            Version = 1,
        }, 0, true);

        activas.Should().BeEmpty();
        historicas.Should().ContainSingle().Which.IdRutaVisita.Should().Be(1);
    }

    [Fact]
    public async Task GetItemAsync_Debe_RetornarNullSiNoExisteLaVisita()
    {
        var (app, asokam) = CrearContextos();
        var service = new CalendarioService(app, asokam);

        var item = await service.GetItemAsync(999, 10, true);

        item.Should().BeNull();
    }

    [Fact]
    public async Task GetActividadVisitaAsync_Debe_UnificarHistorialYCandado()
    {
        var (app, asokam) = CrearContextos();
        SeedBase(app);
        SeedAsokam(asokam);
        await app.SaveChangesAsync();

        var visita = app.RutasVisitas.Single();
        visita.FechaCreacion = new DateTime(2026, 9, 30, 8, 0, 0);
        visita.IdUsuarioCreacion = 10;

        var taller = app.Talleres.Single();
        taller.FechaCreacion = new DateTime(2026, 10, 1, 8, 0, 0);
        taller.IdUsuarioCreacion = 10;
        taller.IdMatrizIndividual = 1;
        app.MatricesIndividuales.Add(new MatrizIndividual
        {
            IdMatrizIndividual = 1,
            IdEjecutivo = 10,
            Periodo = new DateOnly(2026, 10, 1),
        });

        var estadoRevision = new WorkflowEstados
        {
            IdEstado = 1,
            Codigo = "REVISION",
            Nombre = "Revisión",
            Activo = true,
        };
        var workflowMatriz = new Workflow
        {
            IdWorkflow = 1,
            Nombre = "Matriz de talleres - IMSS",
            CodigoProceso = "EDUCACION_MEDICA_MATRIZ",
            Version = 1,
            Activo = true,
            FechaCreacion = DateTime.Now,
        };
        var pasoFirma = new WorkflowPaso
        {
            IdPaso = 1,
            IdWorkflow = 1,
            Orden = 10,
            NombrePaso = "Firma Gerente de Ventas - IMSS",
            IdEstado = 1,
            EsInicio = false,
            EsFinal = false,
            Activo = true,
        };
        taller.IdMatrizGeneral = 1;
        app.WorkflowEstados.Add(estadoRevision);
        app.Workflows.Add(workflowMatriz);
        app.WorkflowPasos.Add(pasoFirma);
        app.MatricesGenerales.Add(new MatrizGeneral
        {
            IdMatrizGeneral = 1,
            IdTipoGerencia = 1,
            Periodo = new DateOnly(2026, 10, 1),
            IdWorkflow = 1,
            IdPasoActual = 1,
            IdEstado = 1,
        });

        app.TalleresEstadosHistorial.Add(new TallerEstadoHistorial
        {
            IdHistorial = 1,
            IdTaller = 1,
            EstadoAnterior = Taller.EstadoProgramado,
            EstadoNuevo = Taller.EstadoEnCurso,
            Origen = TallerEstadoHistorial.OrigenManual,
            Motivo = "Inicio del taller",
            IdUsuario = 10,
            Fecha = new DateTime(2026, 10, 21, 9, 5, 0),
        });

        var solicitud = app.TalleresSolicitudesCambio.Single();
        solicitud.FechaCreacion = new DateTime(2026, 10, 21, 10, 0, 0);
        solicitud.IdUsuarioCreacion = 10;
        solicitud.DatosJson = JsonSerializer.Serialize(new
        {
            antes = new
            {
                fechaVisita = "2026-10-21",
                fechaTaller = "2026-10-21",
                horaTaller = "09:00",
                lugar = "Auditorio",
                numeroParticipantes = 25,
                idEjecutivo = 10,
                idEspecialista = 20,
            },
            despues = new
            {
                fechaVisita = "2026-10-22",
                fechaTaller = "2026-10-22",
                horaTaller = "11:00",
                lugar = "Sala 2",
                numeroParticipantes = 30,
                idEjecutivo = 11,
                idEspecialista = 20,
            },
            motivoSolicitante = "Cambio de fecha",
            idSolicitante = 10,
        });

        app.AjustesPostCierre.AddRange(
            new AjustePostCierre
            {
                IdAjuste = 1,
                EntidadTipo = AjustePostCierre.EntidadTaller,
                IdEntidad = 1,
                Accion = AjustePostCierre.AccionEditarTaller,
                Motivo = "Ajuste de logística",
                IdUsuario = 10,
                FechaAjuste = new DateTime(2026, 10, 21, 11, 0, 0),
            },
            new AjustePostCierre
            {
                IdAjuste = 2,
                EntidadTipo = AjustePostCierre.EntidadRutaVisita,
                IdEntidad = 1,
                Accion = AjustePostCierre.AccionMoverVisita,
                Motivo = "Reprogramación de visita",
                IdUsuario = 10,
                FechaAjuste = new DateTime(2026, 10, 21, 12, 0, 0),
            });

        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = new CalendarioService(app, asokam);

        var actividad = await service.GetActividadVisitaAsync(1, 10, true);

        actividad.Should().NotBeNull();
        actividad!.CandadoPuesto.Should().BeTrue();
        actividad.Talleres.Should().ContainSingle().Which.EsIntegranteEquipo.Should().BeTrue();
        actividad.Talleres.Single().IdSolicitudPendiente.Should().Be(1);
        actividad.Eventos.Should().Contain(e => e.Tipo == "VISITA_CREADA");
        actividad.Eventos.Should().Contain(e => e.Tipo == "TALLER_CREADO");
        actividad.Eventos.Should().Contain(e => e.Tipo == "TALLER_ESTADO");
        actividad.Eventos.Should().Contain(e => e.Tipo == "TALLER_SOLICITUD");
        actividad.Eventos.Should().Contain(e => e.Tipo == "TALLER_AJUSTE");
        actividad.Eventos.Should().Contain(e => e.Tipo == "VISITA_AJUSTE");
        actividad.Eventos.Select(e => e.Fecha).Should().BeInDescendingOrder();
    }

    [Fact]
    public async Task GetCalendarioAsync_Debe_FiltrarPorListaDeGerencias()
    {
        var (app, asokam) = CrearContextos();
        SeedBase(app);
        SeedAsokam(asokam);
        app.TiposGerencia.Add(new TipoGerencia
        {
            IdTipoGerencia = 2,
            Descripcion = "Descentralizado",
            Activo = true,
        });
        app.SeleccionesMensuales.Add(new SeleccionMensual
        {
            IdSeleccionMensual = 2,
            FechaSeleccion = Fecha,
            FechaInicioVigencia = new DateOnly(2026, 10, 1),
            FechaFinVigencia = new DateOnly(2026, 10, 31),
            IdTipoGerencia = 2,
            Activo = true,
        });
        app.SeleccionesHospitales.Add(new SeleccionHospital
        {
            IdSeleccionHospital = 2,
            IdSeleccionMensual = 2,
            IdHospital = 100,
            IdEjecutivo = 10,
        });
        app.Rutas.Add(new Ruta
        {
            IdRuta = 2,
            IdSeleccionMensual = 2,
            IdEspecialista = 20,
            Version = 1,
            Estado = Ruta.EstadoCreada,
        });
        app.RutasVisitas.Add(new RutaVisita
        {
            IdRutaVisita = 2,
            IdRuta = 2,
            IdSeleccionHospital = 2,
            IdHospital = 100,
            IdEjecutivo = 10,
            IdEspecialista = 20,
            IdTipoVisita = 1,
            FechaVisita = Fecha.AddDays(1),
            Orden = 1,
        });
        await app.SaveChangesAsync();
        await asokam.SaveChangesAsync();

        var service = new CalendarioService(app, asokam);
        var filtro = new CalendarioFiltro
        {
            Desde = Fecha,
            Hasta = Fecha.AddDays(2),
            IdGerencias = [1, 2],
        };

        var ambas = await service.GetCalendarioAsync(filtro, 0, true);
        var soloSegunda = await service.GetCalendarioAsync(
            new CalendarioFiltro
            {
                Desde = Fecha,
                Hasta = Fecha.AddDays(2),
                IdGerencias = [2],
            },
            0,
            true);

        ambas.Should().HaveCount(2);
        soloSegunda.Should().ContainSingle().Which.IdRutaVisita.Should().Be(2);
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
            IdTipoVisita = 1,
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
