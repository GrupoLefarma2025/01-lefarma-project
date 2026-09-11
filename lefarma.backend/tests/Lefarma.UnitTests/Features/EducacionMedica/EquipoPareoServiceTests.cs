using FluentAssertions;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class EquipoPareoServiceTests
{
    private static ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static AsokamDbContext CreateAsokamInMemoryContext(params Usuario[] usuarios)
    {
        var options = new DbContextOptionsBuilder<AsokamDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new AsokamDbContext(options);
        context.Usuarios.AddRange(usuarios);
        context.SaveChanges();

        return context;
    }

    private static Usuario Usuario(int id, string nombre) => new()
    {
        IdUsuario = id,
        NombreCompleto = nombre,
        EsActivo = true
    };

    private static EquipoPareoService CreateService(
        Mock<IEquipoPareoRepository> repository,
        AsokamDbContext asokamContext,
        Mock<ISeleccionMensualRepository>? seleccionRepository = null,
        Mock<IRutaRepository>? rutaRepository = null,
        Mock<IRegionRepository>? regionRepository = null)
    {
        seleccionRepository ??= CreateSeleccionRepositoryMock();
        rutaRepository ??= new Mock<IRutaRepository>();
        regionRepository ??= CreateRegionRepositoryMock();

        return new EquipoPareoService(
            repository.Object,
            seleccionRepository.Object,
            rutaRepository.Object,
            regionRepository.Object,
            asokamContext);
    }

    private static Mock<IRegionRepository> CreateRegionRepositoryMock(params RegionCatalogo[] regiones)
    {
        var catalogo = regiones.Length > 0
            ? regiones.ToList()
            : new List<RegionCatalogo> { new() { IdRegion = 1, Nombre = "NORESTE", Activo = true } };

        var mock = new Mock<IRegionRepository>();
        mock.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(catalogo);
        mock.Setup(r => r.GetByIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((int id, CancellationToken _) => catalogo.FirstOrDefault(r => r.IdRegion == id));
        return mock;
    }

    private static Mock<ISeleccionMensualRepository> CreateSeleccionRepositoryMock()
    {
        var mock = new Mock<ISeleccionMensualRepository>();
        mock
            .Setup(r => r.GetRegionesPorEquiposAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
        return mock;
    }

    private static Mock<IEquipoPareoRepository> CreateRepositoryMock(ApplicationDbContext context)
    {
        var mock = new Mock<IEquipoPareoRepository>();

        mock.Setup(r => r.GetAllAsync(It.IsAny<EquipoPareoFiltro?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((EquipoPareoFiltro? filtro, CancellationToken _) =>
            {
                filtro ??= new EquipoPareoFiltro();
                var query = context.EquiposPareo.AsEnumerable();
                if (filtro.SoloVigentes == true) query = query.Where(e => e.Activo);
                if (filtro.SoloVigentes == false) query = query.Where(e => !e.Activo);
                if (filtro.IdUsuario.HasValue)
                {
                    var id = filtro.IdUsuario.Value;
                    query = query.Where(e => e.IdEjecutivo == id || e.IdEspecialista == id);
                }
                if (filtro.FechaInicio.HasValue)
                {
                    var desde = filtro.FechaInicio.Value;
                    query = query.Where(e => e.FechaFin == null || e.FechaFin >= desde);
                }
                if (filtro.FechaFin.HasValue)
                {
                    var hasta = filtro.FechaFin.Value;
                    query = query.Where(e => e.FechaInicio <= hasta);
                }
                return query.ToList();
            });

        mock.Setup(r => r.GetByIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((int id, CancellationToken _) =>
                context.EquiposPareo.FirstOrDefault(e => e.IdEquipo == id));

        mock.Setup(r => r.ExisteActivoConIntegranteAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((int idUsuario, CancellationToken _) =>
                context.EquiposPareo.Any(e => e.Activo &&
                    (e.IdEjecutivo == idUsuario || e.IdEspecialista == idUsuario)));

        mock.Setup(r => r.ExisteActivoConRegionAsync(
                It.IsAny<int>(), It.IsAny<int?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((int idRegion, int? excluir, CancellationToken _) =>
                context.EquiposPareo.Any(e => e.Activo
                    && e.IdRegion == idRegion
                    && (!excluir.HasValue || e.IdEquipo != excluir.Value)));

        mock.Setup(r => r.CreateAsync(It.IsAny<EquipoPareo>(), It.IsAny<CancellationToken>()))
            .Callback((EquipoPareo equipo, CancellationToken _) =>
            {
                // Replica el comportamiento del repositorio real
                equipo.Activo = true;
                equipo.FechaCreacion = DateTime.UtcNow;
                equipo.FechaModificacion = DateTime.UtcNow;
                equipo.IdEquipo = context.EquiposPareo.Count() + 1;
                context.EquiposPareo.Add(equipo);
                context.SaveChanges();
            })
            .ReturnsAsync((EquipoPareo equipo, CancellationToken _) => equipo);

        mock.Setup(r => r.UpdateAsync(It.IsAny<EquipoPareo>(), It.IsAny<CancellationToken>()))
            .Callback((EquipoPareo equipo, CancellationToken _) => context.SaveChanges())
            .ReturnsAsync((EquipoPareo equipo, CancellationToken _) => equipo);

        return mock;
    }

    [Fact]
    public async Task CreateAsync_ConUsuariosExistentes_Debe_CrearEquipoActivo()
    {
        var context = CreateInMemoryContext();
        var asokam = CreateAsokamInMemoryContext(Usuario(10, "Juan Perez"), Usuario(20, "Maria Lopez"));
        var service = CreateService(CreateRepositoryMock(context), asokam);

        var request = new CrearEquipoPareoRequest { IdRegion = 1, IdEjecutivo = 10, IdEspecialista = 20 };

        var dto = await service.CreateAsync(request, idUsuario: 99);

        dto.IdEjecutivo.Should().Be(10);
        dto.IdEspecialista.Should().Be(20);
        dto.Activo.Should().BeTrue();
        dto.NombreEjecutivo.Should().Be("Juan Perez");
        dto.NombreEspecialista.Should().Be("Maria Lopez");
        dto.FechaFin.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_MismaPersonaEnAmbosRoles_Debe_Lanzar()
    {
        var context = CreateInMemoryContext();
        var asokam = CreateAsokamInMemoryContext(Usuario(10, "Juan Perez"));
        var service = CreateService(CreateRepositoryMock(context), asokam);

        var request = new CrearEquipoPareoRequest { IdRegion = 1, IdEjecutivo = 10, IdEspecialista = 10 };

        var act = () => service.CreateAsync(request, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*misma persona*");
    }

    [Fact]
    public async Task CreateAsync_UsuarioInexistenteEnAsokam_Debe_Lanzar()
    {
        var context = CreateInMemoryContext();
        var asokam = CreateAsokamInMemoryContext(Usuario(10, "Juan Perez"));
        var service = CreateService(CreateRepositoryMock(context), asokam);

        var request = new CrearEquipoPareoRequest { IdRegion = 1, IdEjecutivo = 10, IdEspecialista = 999 };

        var act = () => service.CreateAsync(request, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*999*");
    }

    [Fact]
    public async Task CreateAsync_EjecutivoYaEnEquipoActivo_Debe_Lanzar()
    {
        var context = CreateInMemoryContext();
        context.EquiposPareo.Add(new EquipoPareo
        {
            IdRegion = 1,
            IdEquipo = 1,
            IdEjecutivo = 10,
            IdEspecialista = 20,
            Activo = true,
            FechaInicio = DateOnly.FromDateTime(DateTime.UtcNow)
        });
        context.SaveChanges();

        var asokam = CreateAsokamInMemoryContext(Usuario(10, "Juan"), Usuario(20, "Maria"), Usuario(30, "Ana"));
        var service = CreateService(CreateRepositoryMock(context), asokam);

        var request = new CrearEquipoPareoRequest { IdRegion = 1, IdEjecutivo = 30, IdEspecialista = 10 };

        var act = () => service.CreateAsync(request, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*equipo activo*");
    }

    [Fact]
    public async Task CreateAsync_EspecialistaYaEnEquipoActivo_Debe_Lanzar()
    {
        var context = CreateInMemoryContext();
        context.EquiposPareo.Add(new EquipoPareo
        {
            IdRegion = 1,
            IdEquipo = 1,
            IdEjecutivo = 10,
            IdEspecialista = 20,
            Activo = true,
            FechaInicio = DateOnly.FromDateTime(DateTime.UtcNow)
        });
        context.SaveChanges();

        var asokam = CreateAsokamInMemoryContext(Usuario(10, "Juan"), Usuario(20, "Maria"), Usuario(30, "Ana"));
        var service = CreateService(CreateRepositoryMock(context), asokam);

        var request = new CrearEquipoPareoRequest { IdRegion = 1, IdEjecutivo = 20, IdEspecialista = 30 };

        var act = () => service.CreateAsync(request, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*equipo activo*");
    }

    [Fact]
    public async Task DesactivarAsync_Debe_CerrarVigencia()
    {
        var context = CreateInMemoryContext();
        context.EquiposPareo.Add(new EquipoPareo
        {
            IdRegion = 1,
            IdEquipo = 1,
            IdEjecutivo = 10,
            IdEspecialista = 20,
            Activo = true,
            FechaInicio = new DateOnly(2026, 1, 1)
        });
        context.SaveChanges();

        var asokam = CreateAsokamInMemoryContext(Usuario(10, "Juan"), Usuario(20, "Maria"));
        var service = CreateService(CreateRepositoryMock(context), asokam);

        var dto = await service.DesactivarAsync(1, idUsuario: 99);

        dto.Should().NotBeNull();
        dto!.Activo.Should().BeFalse();
        dto.FechaFin.Should().NotBeNull();
    }

    [Fact]
    public async Task DesactivarAsync_EquipoInexistente_Debe_RetornarNull()
    {
        var context = CreateInMemoryContext();
        var asokam = CreateAsokamInMemoryContext();
        var service = CreateService(CreateRepositoryMock(context), asokam);

        var dto = await service.DesactivarAsync(999, idUsuario: 99);

        dto.Should().BeNull();
    }

    [Fact]
    public async Task DesactivarAsync_EquipoInactivo_Debe_Permir_NuevoPareo()
    {
        var context = CreateInMemoryContext();
        context.EquiposPareo.Add(new EquipoPareo
        {
            IdRegion = 1,
            IdEquipo = 1,
            IdEjecutivo = 10,
            IdEspecialista = 20,
            Activo = false,
            FechaInicio = new DateOnly(2026, 1, 1),
            FechaFin = new DateOnly(2026, 2, 1)
        });
        context.SaveChanges();

        var asokam = CreateAsokamInMemoryContext(Usuario(10, "Juan"), Usuario(20, "Maria"), Usuario(30, "Ana"));
        var service = CreateService(CreateRepositoryMock(context), asokam);

        // El EV 10 esta en un equipo INACTIVO: la exclusividad es una regla
        // de configuracion actual, no historica, por lo que puede re-parearse.
        var request = new CrearEquipoPareoRequest { IdRegion = 1, IdEjecutivo = 10, IdEspecialista = 30 };

        var dto = await service.CreateAsync(request, idUsuario: 99);

        dto.Activo.Should().BeTrue();
        dto.IdEspecialista.Should().Be(30);
    }

    [Fact]
    public async Task GetAllAsync_FiltroBusqueda_Debe_FiltrarPorNombreDeIntegrante()
    {
        var context = CreateInMemoryContext();
        context.EquiposPareo.Add(new EquipoPareo { IdRegion = 1, IdEquipo = 1, IdEjecutivo = 10, IdEspecialista = 20, Activo = true, FechaInicio = new DateOnly(2026, 1, 1) });
        context.EquiposPareo.Add(new EquipoPareo { IdRegion = 1, IdEquipo = 2, IdEjecutivo = 30, IdEspecialista = 40, Activo = true, FechaInicio = new DateOnly(2026, 1, 1) });
        context.SaveChanges();

        var asokam = CreateAsokamInMemoryContext(
            Usuario(10, "Juan Perez"), Usuario(20, "Maria Lopez"),
            Usuario(30, "Carlos Ruiz"), Usuario(40, "Ana Torres"));
        var service = CreateService(CreateRepositoryMock(context), asokam);

        var filtro = new EquipoPareoFiltro { Busqueda = "maria" };
        var resultado = await service.GetAllAsync(filtro);

        resultado.Should().ContainSingle();
        resultado.Single().IdEquipo.Should().Be(1);
    }

    [Fact]
    public async Task GetAllAsync_FiltroRangoVigencia_Debe_Traslapar()
    {
        var context = CreateInMemoryContext();
        context.EquiposPareo.Add(new EquipoPareo
        {
            IdRegion = 1,
            IdEquipo = 1, IdEjecutivo = 10, IdEspecialista = 20, Activo = false,
            FechaInicio = new DateOnly(2026, 1, 1), FechaFin = new DateOnly(2026, 3, 31),
        });
        context.EquiposPareo.Add(new EquipoPareo
        {
            IdRegion = 1,
            IdEquipo = 2, IdEjecutivo = 30, IdEspecialista = 40, Activo = false,
            FechaInicio = new DateOnly(2026, 6, 1), FechaFin = new DateOnly(2026, 7, 31),
        });
        context.SaveChanges();

        var asokam = CreateAsokamInMemoryContext(Usuario(10, "A"), Usuario(20, "B"), Usuario(30, "C"), Usuario(40, "D"));
        var service = CreateService(CreateRepositoryMock(context), asokam);

        // El rango 2026-03-01..2026-03-31 solo traslapa con el equipo 1
        var filtro = new EquipoPareoFiltro
        {
            FechaInicio = new DateOnly(2026, 3, 1),
            FechaFin = new DateOnly(2026, 3, 31),
        };
        var resultado = await service.GetAllAsync(filtro);

        resultado.Should().ContainSingle();
        resultado.Single().IdEquipo.Should().Be(1);
    }

    [Fact]
    public async Task GetAllAsync_Debe_Incluir_ZonasActualesDeSeleccionesActivas()
    {
        var context = CreateInMemoryContext();
        context.EquiposPareo.Add(new EquipoPareo { IdRegion = 1, IdEquipo = 1, IdEjecutivo = 10, IdEspecialista = 20, Activo = true, FechaInicio = new DateOnly(2026, 1, 1) });
        context.SaveChanges();

        var asokam = CreateAsokamInMemoryContext(Usuario(10, "Juan"), Usuario(20, "Maria"));

        var seleccionRepo = new Mock<ISeleccionMensualRepository>();
        seleccionRepo
            .Setup(r => r.GetRegionesPorEquiposAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new SeleccionRegion { IdRegion = 1, IdSeleccionMensual = 1, Nombre = "Región 01", CantidadHospitales = 3, IdEquipo = 1 },
            ]);
        seleccionRepo
            .Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SeleccionMensual
            {
                IdSeleccionMensual = 1,
                FechaSeleccion = new DateOnly(2026, 8, 15),
                Estado = SeleccionMensual.EstadoAutorizada,
            });

        var service = CreateService(CreateRepositoryMock(context), asokam, seleccionRepo);

        var resultado = await service.GetAllAsync(new EquipoPareoFiltro());

        resultado.Single().RegionesActuales.Should().Contain(r => r.Contains("Región 01") && r.Contains("15/08"));
    }

    [Fact]
    public async Task ObtenerOperacionAsync_Debe_ConsolidarSeleccionesZonasYRutas()
    {
        var context = CreateInMemoryContext();
        context.EquiposPareo.Add(new EquipoPareo { IdRegion = 1, IdEquipo = 1, IdEjecutivo = 10, IdEspecialista = 20, Activo = true, FechaInicio = new DateOnly(2026, 1, 1) });
        context.SaveChanges();

        var asokam = CreateAsokamInMemoryContext(Usuario(10, "Juan"), Usuario(20, "Maria"));

        var seleccionRepo = new Mock<ISeleccionMensualRepository>();
        seleccionRepo
            .Setup(r => r.GetRegionesPorEquiposAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new SeleccionRegion { IdRegion = 1, IdSeleccionMensual = 1, Nombre = "Región 01", CantidadHospitales = 3, IdEquipo = 1 },
            ]);
        seleccionRepo
            .Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SeleccionMensual
            {
                IdSeleccionMensual = 1,
                FechaSeleccion = new DateOnly(2026, 8, 15),
                Estado = SeleccionMensual.EstadoAutorizada,
            });

        var rutaRepo = new Mock<IRutaRepository>();
        rutaRepo
            .Setup(r => r.GetByEquipoAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new Ruta { IdRuta = 5, IdSeleccionMensual = 1, IdEquipo = 1, Version = 1, Estado = Ruta.EstadoConfirmada },
            ]);
        rutaRepo
            .Setup(r => r.GetVisitasAsync(5, It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new RutaVisita { IdRutaVisita = 1, IdRuta = 5, FechaVisita = new DateOnly(2026, 9, 1), Orden = 1 },
                new RutaVisita { IdRutaVisita = 2, IdRuta = 5, FechaVisita = new DateOnly(2026, 9, 1), Orden = 2 },
            ]);

        var service = CreateService(CreateRepositoryMock(context), asokam, seleccionRepo, rutaRepo);

        var operacion = await service.ObtenerOperacionAsync(1);

        operacion.Should().NotBeNull();
        operacion!.NombreEjecutivo.Should().Be("Juan");
        operacion.TotalSelecciones.Should().Be(1);
        operacion.TotalVisitasConfirmadas.Should().Be(2);
        operacion.Participaciones.Single().Regiones.Single().Nombre.Should().Be("Región 01");
        operacion.Participaciones.Single().Rutas.Single().Estado.Should().Be(Ruta.EstadoConfirmada);
    }

    [Fact]
    public async Task ObtenerOperacionAsync_EquipoInexistente_Debe_RetornarNull()
    {
        var context = CreateInMemoryContext();
        var asokam = CreateAsokamInMemoryContext();
        var service = CreateService(CreateRepositoryMock(context), asokam);

        var operacion = await service.ObtenerOperacionAsync(999);

        operacion.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_RegionInexistente_Debe_Lanzar()
    {
        var context = CreateInMemoryContext();
        var asokam = CreateAsokamInMemoryContext(Usuario(10, "Juan"), Usuario(20, "Maria"));
        var service = CreateService(CreateRepositoryMock(context), asokam);

        var request = new CrearEquipoPareoRequest { IdRegion = 99, IdEjecutivo = 10, IdEspecialista = 20 };

        var act = () => service.CreateAsync(request, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*no existe o está inactiva*");
    }

    [Fact]
    public async Task CreateAsync_RegionOcupadaPorEquipoActivo_Debe_Lanzar()
    {
        var context = CreateInMemoryContext();
        context.EquiposPareo.Add(new EquipoPareo
        {
            IdRegion = 1,
            IdEquipo = 1,
            IdEjecutivo = 10,
            IdEspecialista = 20,
            Activo = true,
            FechaInicio = DateOnly.FromDateTime(DateTime.UtcNow)
        });
        context.SaveChanges();

        var asokam = CreateAsokamInMemoryContext(Usuario(30, "Ana"), Usuario(40, "Luis"));
        var service = CreateService(CreateRepositoryMock(context), asokam);

        var request = new CrearEquipoPareoRequest { IdRegion = 1, IdEjecutivo = 30, IdEspecialista = 40 };

        var act = () => service.CreateAsync(request, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*ya está asignada a otro equipo activo*");
    }

    [Fact]
    public async Task AsignarRegionAsync_Debe_ActualizarLaRegionDelEquipo()
    {
        var context = CreateInMemoryContext();
        context.EquiposPareo.Add(new EquipoPareo
        {
            IdRegion = 1,
            IdEquipo = 1,
            IdEjecutivo = 10,
            IdEspecialista = 20,
            Activo = true,
            FechaInicio = new DateOnly(2026, 1, 1)
        });
        context.SaveChanges();

        var asokam = CreateAsokamInMemoryContext(Usuario(10, "Juan"), Usuario(20, "Maria"));
        var regiones = new[]
        {
            new RegionCatalogo { IdRegion = 1, Nombre = "NORESTE", Activo = true },
            new RegionCatalogo { IdRegion = 2, Nombre = "SURESTE", Activo = true },
        };
        var service = CreateService(
            CreateRepositoryMock(context), asokam, regionRepository: CreateRegionRepositoryMock(regiones));

        var dto = await service.AsignarRegionAsync(1, new AsignarRegionEquipoRequest { IdRegion = 2 }, idUsuario: 99);

        dto.Should().NotBeNull();
        dto!.IdRegion.Should().Be(2);
        dto.NombreRegion.Should().Be("SURESTE");
        context.EquiposPareo.Single().IdRegion.Should().Be(2);
    }

    [Fact]
    public async Task AsignarRegionAsync_RegionDeOtroEquipoActivo_Debe_Lanzar()
    {
        var context = CreateInMemoryContext();
        context.EquiposPareo.Add(new EquipoPareo
        {
            IdRegion = 1,
            IdEquipo = 1,
            IdEjecutivo = 10,
            IdEspecialista = 20,
            Activo = true,
            FechaInicio = new DateOnly(2026, 1, 1)
        });
        context.EquiposPareo.Add(new EquipoPareo
        {
            IdRegion = 2,
            IdEquipo = 2,
            IdEjecutivo = 30,
            IdEspecialista = 40,
            Activo = true,
            FechaInicio = new DateOnly(2026, 1, 1)
        });
        context.SaveChanges();

        var asokam = CreateAsokamInMemoryContext();
        var regiones = new[]
        {
            new RegionCatalogo { IdRegion = 1, Nombre = "NORESTE", Activo = true },
            new RegionCatalogo { IdRegion = 2, Nombre = "SURESTE", Activo = true },
        };
        var service = CreateService(
            CreateRepositoryMock(context), asokam, regionRepository: CreateRegionRepositoryMock(regiones));

        var act = () => service.AsignarRegionAsync(1, new AsignarRegionEquipoRequest { IdRegion = 2 }, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*ya está asignada a otro equipo activo*");
    }

    [Fact]
    public async Task AsignarRegionAsync_EquipoInexistente_Debe_RetornarNull()
    {
        var context = CreateInMemoryContext();
        var asokam = CreateAsokamInMemoryContext();
        var service = CreateService(CreateRepositoryMock(context), asokam);

        var dto = await service.AsignarRegionAsync(999, new AsignarRegionEquipoRequest { IdRegion = 1 }, idUsuario: 99);

        dto.Should().BeNull();
    }
}
