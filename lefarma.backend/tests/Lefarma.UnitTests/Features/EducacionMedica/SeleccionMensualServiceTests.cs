using FluentAssertions;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Features.EducacionMedica.Services;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class SeleccionMensualServiceTests
{
    private const int EquipoId = 7;

    private static AsokamDbContext CreateAsokamInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<AsokamDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new AsokamDbContext(options);
    }

    private sealed class FakeSeleccionRepository : ISeleccionMensualRepository
    {
        public List<SeleccionMensual> Selecciones { get; } = [];
        public List<SeleccionHospital> Hospitales { get; } = [];
        public List<SeleccionRegion> Regiones { get; } = [];
        private int _siguienteSeleccion = 1;

        public Task<List<SeleccionMensual>> GetAllAsync(int? anio, int? mes, CancellationToken cancellationToken = default)
        {
            var query = Selecciones.AsEnumerable();
            if (anio.HasValue) query = query.Where(s => s.FechaSeleccion.Year == anio.Value);
            if (mes.HasValue) query = query.Where(s => s.FechaSeleccion.Month == mes.Value);
            return Task.FromResult(query.ToList());
        }

        public Task<SeleccionMensual?> GetByIdAsync(int idSeleccionMensual, CancellationToken cancellationToken = default)
            => Task.FromResult(Selecciones.FirstOrDefault(s => s.IdSeleccionMensual == idSeleccionMensual && s.Activo));

        public Task<bool> ExisteSeleccionActivaAsync(DateOnly fechaInicioVigencia, DateOnly fechaFinVigencia, int? idTipoGerencia, CancellationToken cancellationToken = default)
            => Task.FromResult(Selecciones.Any(s => s.Activo
                && s.Estado != SeleccionMensual.EstadoCerrada
                && (idTipoGerencia == null || s.IdTipoGerencia == idTipoGerencia)
                && s.FechaInicioVigencia <= fechaFinVigencia
                && s.FechaFinVigencia >= fechaInicioVigencia));

        public Task<List<SeleccionMensual>> GetSeleccionesSolapadasAsync(
            int idSeleccionMensual,
            DateOnly fechaInicioVigencia,
            DateOnly fechaFinVigencia,
            int? idTipoGerencia,
            CancellationToken cancellationToken = default)
            => Task.FromResult(Selecciones.Where(s =>
                s.Activo
                && s.IdSeleccionMensual != idSeleccionMensual
                && s.Estado != SeleccionMensual.EstadoCerrada
                && (idTipoGerencia == null || s.IdTipoGerencia != idTipoGerencia)
                && s.FechaInicioVigencia.HasValue
                && s.FechaFinVigencia.HasValue
                && s.FechaInicioVigencia.Value <= fechaFinVigencia
                && s.FechaFinVigencia.Value >= fechaInicioVigencia).ToList());

        public Task<List<SeleccionHospital>> GetHospitalesDeSeleccionesAsync(
            IEnumerable<int> idsSeleccionMensual,
            CancellationToken cancellationToken = default)
        {
            var ids = idsSeleccionMensual.ToHashSet();
            return Task.FromResult(Hospitales.Where(h => ids.Contains(h.IdSeleccionMensual)).ToList());
        }

        public Task<SeleccionMensual> CreateAsync(SeleccionMensual seleccion, CancellationToken cancellationToken = default)
        {
            seleccion.IdSeleccionMensual = _siguienteSeleccion++;
            seleccion.Activo = true;
            Selecciones.Add(seleccion);
            return Task.FromResult(seleccion);
        }

        public Task<SeleccionMensual> UpdateAsync(SeleccionMensual seleccion, CancellationToken cancellationToken = default)
            => Task.FromResult(seleccion);

        public Task<List<SeleccionHospital>> GetHospitalesAsync(int idSeleccionMensual, CancellationToken cancellationToken = default)
            => Task.FromResult(Hospitales.Where(h => h.IdSeleccionMensual == idSeleccionMensual).ToList());

        public Task<SeleccionHospital?> GetHospitalByIdAsync(int idSeleccionHospital, CancellationToken cancellationToken = default)
            => Task.FromResult(Hospitales.FirstOrDefault(h => h.IdSeleccionHospital == idSeleccionHospital));

        public Task<SeleccionHospital> AddHospitalAsync(SeleccionHospital hospital, CancellationToken cancellationToken = default)
        {
            hospital.IdSeleccionHospital = Hospitales.Any() ? Hospitales.Max(h => h.IdSeleccionHospital) + 1 : 1;
            Hospitales.Add(hospital);
            return Task.FromResult(hospital);
        }

        public Task RemoveHospitalAsync(SeleccionHospital hospital, CancellationToken cancellationToken = default)
        {
            Hospitales.Remove(hospital);
            return Task.CompletedTask;
        }

        public Task<List<SeleccionRegion>> GetRegionesAsync(int idSeleccionMensual, CancellationToken cancellationToken = default)
            => Task.FromResult(Regiones.Where(z => z.IdSeleccionMensual == idSeleccionMensual).ToList());

        public Task<List<SeleccionRegion>> GetRegionesPorEquiposAsync(IEnumerable<int> idsEquipos, CancellationToken cancellationToken = default)
        {
            var ids = idsEquipos.ToHashSet();
            return Task.FromResult(Regiones.Where(z => z.IdEquipo.HasValue && ids.Contains(z.IdEquipo.Value)).ToList());
        }

        public Task<SeleccionRegion?> GetRegionByIdAsync(int idZona, CancellationToken cancellationToken = default)
            => Task.FromResult(Regiones.FirstOrDefault(z => z.IdRegion == idZona));

        public Task<SeleccionRegion> CreateRegionAsync(SeleccionRegion zona, CancellationToken cancellationToken = default)
        {
            zona.IdRegion = Regiones.Any() ? Regiones.Max(z => z.IdRegion) + 1 : 1;
            Regiones.Add(zona);
            return Task.FromResult(zona);
        }

        public Task<SeleccionRegion> UpdateRegionAsync(SeleccionRegion zona, CancellationToken cancellationToken = default)
            => Task.FromResult(zona);

        public Task RemoveRegionAsync(SeleccionRegion zona, CancellationToken cancellationToken = default)
        {
            Regiones.Remove(zona);
            return Task.CompletedTask;
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private static SeleccionMensualService CreateService(
        FakeSeleccionRepository repository,
        Mock<IHospitalRepository>? hospitalRepository = null,
        Mock<IEquipoPareoRepository>? equipoRepository = null,
        Mock<IRegionRepository>? regionRepository = null,
        Mock<IHospitalExtensionRepository>? extensionRepository = null,
        List<ParametroModulo>? parametros = null,
        List<TipoGerencia>? tiposGerencias = null)
    {
        hospitalRepository ??= new Mock<IHospitalRepository>();
        hospitalRepository
            .Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IEnumerable<int> ids, CancellationToken _) =>
                ids.Select(id => new Hospital { CodigoContacto = id, NombreContacto = $"Hospital {id}" }).ToList());
        if (equipoRepository is null)
        {
            equipoRepository = new Mock<IEquipoPareoRepository>();
            equipoRepository
                .Setup(r => r.GetAllAsync(It.IsAny<EquipoPareoFiltro?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);
        }
        regionRepository ??= CreateRegionRepositoryMock();
        if (extensionRepository is null)
        {
            extensionRepository = new Mock<IHospitalExtensionRepository>();
            extensionRepository
                .Setup(r => r.GetByHospitalIdsAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);
        }

        var tiposRepository = new Mock<ITipoGerenciaRepository>();
        tiposRepository
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(tiposGerencias ?? []);

        var parametroRepository = new Mock<IParametroModuloRepository>();
        parametroRepository
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(parametros ?? []);

        return new SeleccionMensualService(
            repository,
            hospitalRepository.Object,
            equipoRepository.Object,
            tiposRepository.Object,
            parametroRepository.Object,
            regionRepository.Object,
            extensionRepository.Object,
            CreateAsokamInMemoryContext(),
            NullLogger<SeleccionMensualService>.Instance);
    }

    private static Mock<IRegionRepository> CreateRegionRepositoryMock()
    {
        var zonas = new List<RegionCatalogo>
        {
            new() { IdRegion = 1, Nombre = "NORESTE", Activo = true, CentroLatitud = 25.70m, CentroLongitud = -100.30m },
            new() { IdRegion = 2, Nombre = "OCCIDENTE", Activo = true, CentroLatitud = 20.67m, CentroLongitud = -103.35m },
        };
        var mock = new Mock<IRegionRepository>();
        mock.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(zonas);
        mock.Setup(r => r.GetByIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((int id, CancellationToken _) => zonas.FirstOrDefault(z => z.IdRegion == id));
        return mock;
    }

    private static CrearSeleccionMensualRequest CrearSeleccionRequest() => new()
    {
        FechaSeleccion = new DateOnly(2026, 8, 15),
        FechaInicioVigencia = new DateOnly(2026, 9, 1),
        FechaFinVigencia = new DateOnly(2026, 10, 15),
        TalleresObjetivoMes = 64,
    };

    private static SeleccionMensual SeleccionEnRevision(FakeSeleccionRepository repo)
    {
        var seleccion = new SeleccionMensual
        {
            FechaSeleccion = new DateOnly(2026, 8, 15),
            FechaInicioVigencia = new DateOnly(2026, 9, 1),
            FechaFinVigencia = new DateOnly(2026, 10, 15),
            Estado = SeleccionMensual.EstadoEnRevision,
            Activo = true,
        };
        repo.Selecciones.Add(seleccion);
        seleccion.IdSeleccionMensual = repo.Selecciones.Count;
        return seleccion;
    }

    [Fact]
    public async Task AgruparAsync_AgrupaPorRegionDeExtension_Debe_UsarNombreDeCatalogo()
    {
        var (resultado, _) = await EjecutarAgrupacionPorRegion(
        [
            (100, 25.68, -100.31, (int?)1), (101, 25.69, -100.29, 1),
            (200, 20.66, -103.36, 2),
        ]);

        resultado.Regiones.Should().HaveCount(2);
        resultado.Regiones.Should().OnlyContain(z => z.Algoritmo == SeleccionMensualService.AlgoritmoRegionesCatalogo);
        resultado.Regiones.Sum(z => z.CantidadHospitales).Should().Be(3);

        var noreste = resultado.Regiones.Single(z => z.Nombre == "NORESTE");
        noreste.CantidadHospitales.Should().Be(2);
        noreste.IdRegionCatalogo.Should().Be(1);
    }

    [Fact]
    public async Task AgruparAsync_HospitalSinRegion_DebeUbicarPorGpsConOrigenGps()
    {
        var (resultado, repo) = await EjecutarAgrupacionPorRegion([(300, 25.71, -100.28, (int?)null)]);

        resultado.Regiones.Should().ContainSingle();
        resultado.Regiones.Single().Nombre.Should().Be("NORESTE");
        repo.Hospitales.Single().Origen.Should().Be("GPS");
        resultado.Avisos.Should().Contain(a => a.Contains("por GPS"));
    }

    [Fact]
    public async Task AgruparAsync_RegionSinEquipoVigente_DebeAvisar()
    {
        var (resultado, _) = await EjecutarAgrupacionPorRegion([(100, 25.68, -100.31, (int?)1)]);

        resultado.Regiones.Single().IdEquipo.Should().BeNull();
        resultado.Avisos.Should().Contain(a => a.Contains("no tiene equipo vigente"));
    }

    [Fact]
    public async Task AgruparAsync_EquipoVigenteDeLaRegion_DebeAsignarseAutomaticamente()
    {
        var equipo = new EquipoPareo
        {
            IdEquipo = EquipoId,
            IdRegion = 1,
            IdEjecutivo = 1,
            IdEspecialista = 2,
            Activo = true,
            FechaInicio = DateOnly.FromDateTime(DateTime.UtcNow),
        };

        var (resultado, _) = await EjecutarAgrupacionPorRegion(
            [(100, 25.68, -100.31, (int?)1)],
            equipos: [equipo]);

        resultado.Regiones.Single().IdEquipo.Should().Be(EquipoId);
    }

    [Fact]
    public async Task AgruparAsync_Debe_Reemplazar_RegionesPrevias()
    {
        var repo = new FakeSeleccionRepository();
        var seleccion = SeleccionEnRevision(repo);
        repo.Regiones.Add(new SeleccionRegion
        {
            IdRegion = 99,
            IdSeleccionMensual = seleccion.IdSeleccionMensual,
            Nombre = "Región vieja",
            CantidadHospitales = 0,
            IdEquipo = EquipoId,
        });

        SeedAgrupacion(repo, seleccion, [(100, 25.68, -100.31, (int?)1)]);
        var service = CreateService(repo);
        var resultado = await service.AgruparAsync(seleccion.IdSeleccionMensual, idUsuario: 99);

        resultado.Regiones.Should().ContainSingle();
        resultado.Regiones.Should().OnlyContain(z => z.IdRegion != 99);
        resultado.Avisos.Should().Contain(a => a.Contains("restablecieron"));
    }

    [Fact]
    public async Task AgruparAsync_RegionConMenosDeCuatro_Debe_Avisar()
    {
        var (resultado, _) = await EjecutarAgrupacionPorRegion([(100, 25.68, -100.31, (int?)1)]);

        resultado.Avisos.Should().Contain(a => a.Contains("mínimo 4"));
    }

    [Fact]
    public async Task AsignarEquipoAsync_CapacidadInsuficiente_Debe_Lanzar()
    {
        var repo = new FakeSeleccionRepository();
        var seleccion = SeleccionEnRevision(repo);
        var zona = new SeleccionRegion
        {
            IdRegion = 1,
            IdSeleccionMensual = seleccion.IdSeleccionMensual,
            Nombre = "Región 01",
            CantidadHospitales = 500,
        };
        repo.Regiones.Add(zona);

        var equipoMock = new Mock<IEquipoPareoRepository>();
        equipoMock
            .Setup(r => r.GetByIdAsync(EquipoId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EquipoPareo { IdEquipo = EquipoId, Activo = true });

        var service = CreateService(repo, equipoRepository: equipoMock);
        var request = new AsignarEquipoRegionRequest { IdEquipo = EquipoId };

        var act = () => service.AsignarEquipoAsync(seleccion.IdSeleccionMensual, 1, request, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Capacidad insuficiente*");
    }

    [Fact]
    public async Task AsignarEquipoAsync_DentroDeCapacidad_Debe_Asignar()
    {
        var repo = new FakeSeleccionRepository();
        var seleccion = SeleccionEnRevision(repo);
        var zona = new SeleccionRegion
        {
            IdRegion = 1,
            IdSeleccionMensual = seleccion.IdSeleccionMensual,
            Nombre = "Región 01",
            CantidadHospitales = 2,
        };
        repo.Regiones.Add(zona);

        var equipoMock = new Mock<IEquipoPareoRepository>();
        equipoMock
            .Setup(r => r.GetByIdAsync(EquipoId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EquipoPareo { IdEquipo = EquipoId, Activo = true });
        equipoMock
            .Setup(r => r.GetAllAsync(It.IsAny<EquipoPareoFiltro?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var service = CreateService(repo, equipoRepository: equipoMock);
        var request = new AsignarEquipoRegionRequest { IdEquipo = EquipoId };

        var dto = await service.AsignarEquipoAsync(seleccion.IdSeleccionMensual, 1, request, idUsuario: 99);

        dto.IdEquipo.Should().Be(EquipoId);
        zona.IdEquipo.Should().Be(EquipoId);
    }

    [Fact]
    public async Task AutorizarAsync_GgAntesDeGv_Debe_Lanzar()
    {
        var repo = new FakeSeleccionRepository();
        var seleccion = SeleccionEnRevision(repo);
        var service = CreateService(repo);

        var request = new AutorizarSeleccionRequest { Rol = "GG" };
        var act = () => service.AutorizarAsync(seleccion.IdSeleccionMensual, request, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Gerente de Ventas*");
    }

    [Fact]
    public async Task AutorizarAsync_DobleFirmaCompleta_Debe_Autorizar()
    {
        var repo = new FakeSeleccionRepository();
        var seleccion = SeleccionEnRevision(repo);
        var service = CreateService(repo);

        await service.AutorizarAsync(seleccion.IdSeleccionMensual, new AutorizarSeleccionRequest { Rol = "GV" }, idUsuario: 1);
        seleccion.Estado.Should().Be(SeleccionMensual.EstadoEnRevision);
        seleccion.FirmaGvFecha.Should().NotBeNull();

        await service.AutorizarAsync(seleccion.IdSeleccionMensual, new AutorizarSeleccionRequest { Rol = "GG" }, idUsuario: 2);
        seleccion.Estado.Should().Be(SeleccionMensual.EstadoAutorizada);
        seleccion.FirmaGgFecha.Should().NotBeNull();
    }

    [Fact]
    public async Task AgregarHospitalAsync_SeleccionAutorizada_Debe_Lanzar()
    {
        var repo = new FakeSeleccionRepository();
        var seleccion = new SeleccionMensual { Estado = SeleccionMensual.EstadoAutorizada, Activo = true };
        repo.Selecciones.Add(seleccion);
        seleccion.IdSeleccionMensual = repo.Selecciones.Count;

        var service = CreateService(repo);
        var request = new AgregarHospitalSeleccionRequest { IdHospital = 100 };

        var act = () => service.AgregarHospitalAsync(seleccion.IdSeleccionMensual, request, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*ya no admite cambios*");
    }

    [Fact]
    public async Task AgregarHospitalAsync_HospitalInexistente_Debe_Lanzar()
    {
        var repo = new FakeSeleccionRepository();
        var seleccion = new SeleccionMensual { Estado = SeleccionMensual.EstadoBorrador, Activo = true };
        repo.Selecciones.Add(seleccion);
        seleccion.IdSeleccionMensual = repo.Selecciones.Count;

        var hospitalMock = new Mock<IHospitalRepository>();
        hospitalMock
            .Setup(r => r.GetByIdAsync(999, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Hospital?)null);

        var service = CreateService(repo, hospitalMock);
        var request = new AgregarHospitalSeleccionRequest { IdHospital = 999 };

        var act = () => service.AgregarHospitalAsync(seleccion.IdSeleccionMensual, request, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*no existe*");
    }

    [Fact]
    public async Task DividirRegionAsync_Debe_RepartirHospitales()
    {
        var repo = new FakeSeleccionRepository();
        var seleccion = SeleccionEnRevision(repo);
        var zona = new SeleccionRegion
        {
            IdRegion = 1,
            IdSeleccionMensual = seleccion.IdSeleccionMensual,
            Nombre = "Región 01",
            CentroLatitud = 20.05m,
            CentroLongitud = -101.24m,
            CantidadHospitales = 4,
        };
        repo.Regiones.Add(zona);

        var hospitales = new[]
        {
            (100, 19.430m, -99.130m), (101, 19.450m, -99.110m),
            (200, 20.670m, -103.350m), (201, 20.690m, -103.320m),
        };

        foreach (var (codigo, lat, lon) in hospitales)
        {
            repo.Hospitales.Add(new SeleccionHospital
            {
                IdSeleccionHospital = codigo,
                IdSeleccionMensual = seleccion.IdSeleccionMensual,
                IdHospital = codigo,
                LatitudSnapshot = lat,
                LongitudSnapshot = lon,
                IdRegion = 1,
            });
        }

        var service = CreateService(repo);
        var zonas = await service.DividirRegionAsync(
            seleccion.IdSeleccionMensual, 1, new DividirRegionRequest { Motivo = "Región excede capacidad" }, idUsuario: 99);

        zonas.Should().HaveCount(2);
        zonas.Sum(z => z.CantidadHospitales).Should().Be(4);
        zonas.Should().Contain(z => z.CantidadHospitales == 2);
        repo.Hospitales.Should().OnlyContain(h => h.IdRegion != null);
    }

    [Fact]
    public async Task AsignarRegionAHospitalAsync_SinRegion_DebeAsignarYRecalcularRegion()
    {
        var repo = new FakeSeleccionRepository();
        var seleccion = SeleccionEnRevision(repo);
        var region = new SeleccionRegion
        {
            IdRegion = 1,
            IdSeleccionMensual = seleccion.IdSeleccionMensual,
            Nombre = "Región 01",
            CantidadHospitales = 1,
        };
        repo.Regiones.Add(region);
        repo.Hospitales.Add(new SeleccionHospital
        {
            IdSeleccionHospital = 1,
            IdSeleccionMensual = seleccion.IdSeleccionMensual,
            IdHospital = 100,
            IdRegion = 1,
            LatitudSnapshot = 19.430m,
            LongitudSnapshot = -99.130m,
        });
        var sinRegion = new SeleccionHospital
        {
            IdSeleccionHospital = 2,
            IdSeleccionMensual = seleccion.IdSeleccionMensual,
            IdHospital = 200,
            IdRegion = null,
            LatitudSnapshot = 19.450m,
            LongitudSnapshot = -99.110m,
        };
        repo.Hospitales.Add(sinRegion);

        var service = CreateService(repo);
        await service.AsignarRegionAHospitalAsync(
            seleccion.IdSeleccionMensual, 2, new MoverHospitalARegionRequest { IdRegion = 1 }, idUsuario: 99);

        sinRegion.IdRegion.Should().Be(1);
        region.CantidadHospitales.Should().Be(2);
        region.CentroLatitud.Should().BeApproximately(19.44m, 0.001m);
        region.CentroLongitud.Should().BeApproximately(-99.12m, 0.001m);
    }

    [Fact]
    public async Task AsignarRegionAHospitalAsync_HospitalConRegion_DebeLanzar()
    {
        var repo = new FakeSeleccionRepository();
        var seleccion = SeleccionEnRevision(repo);
        repo.Regiones.Add(new SeleccionRegion
        {
            IdRegion = 1,
            IdSeleccionMensual = seleccion.IdSeleccionMensual,
            Nombre = "Región 01",
        });
        repo.Hospitales.Add(new SeleccionHospital
        {
            IdSeleccionHospital = 1,
            IdSeleccionMensual = seleccion.IdSeleccionMensual,
            IdHospital = 100,
            IdRegion = 1,
        });

        var service = CreateService(repo);
        var act = () => service.AsignarRegionAHospitalAsync(
            seleccion.IdSeleccionMensual, 1, new MoverHospitalARegionRequest { IdRegion = 1 }, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*ya tiene una región*");
    }

    [Fact]
    public async Task GetAllAsync_DebeContarHospitalesYRegiones_PorSeleccion()
    {
        var repo = new FakeSeleccionRepository();
        var seleccion1 = SeleccionEnRevision(repo);
        var seleccion2 = SeleccionEnRevision(repo);
        repo.Hospitales.Add(new SeleccionHospital
        {
            IdSeleccionHospital = 1,
            IdSeleccionMensual = seleccion1.IdSeleccionMensual,
            IdHospital = 100,
        });
        repo.Hospitales.Add(new SeleccionHospital
        {
            IdSeleccionHospital = 2,
            IdSeleccionMensual = seleccion1.IdSeleccionMensual,
            IdHospital = 101,
        });
        repo.Hospitales.Add(new SeleccionHospital
        {
            IdSeleccionHospital = 3,
            IdSeleccionMensual = seleccion2.IdSeleccionMensual,
            IdHospital = 200,
        });
        repo.Regiones.Add(new SeleccionRegion
        {
            IdRegion = 1,
            IdSeleccionMensual = seleccion1.IdSeleccionMensual,
            Nombre = "Región 01",
        });

        var service = CreateService(repo);
        var lista = await service.GetAllAsync(null, null);

        lista.Should().HaveCount(2);
        var dto1 = lista.First(s => s.IdSeleccionMensual == seleccion1.IdSeleccionMensual);
        dto1.TotalHospitales.Should().Be(2);
        dto1.TotalRegiones.Should().Be(1);
        var dto2 = lista.First(s => s.IdSeleccionMensual == seleccion2.IdSeleccionMensual);
        dto2.TotalHospitales.Should().Be(1);
        dto2.TotalRegiones.Should().Be(0);
    }

    [Fact]
    public async Task AgruparAsync_HospitalesSinRegionNiCoordenadas_Debe_Avisar()
    {
        var repo = new FakeSeleccionRepository();
        var seleccion = SeleccionEnRevision(repo);
        repo.Hospitales.Add(new SeleccionHospital
        {
            IdSeleccionHospital = 1,
            IdSeleccionMensual = seleccion.IdSeleccionMensual,
            IdHospital = 100,
        });

        var extensionMock = new Mock<IHospitalExtensionRepository>();
        extensionMock
            .Setup(r => r.GetByHospitalIdsAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var service = CreateService(repo, extensionRepository: extensionMock);
        var resultado = await service.AgruparAsync(seleccion.IdSeleccionMensual, idUsuario: 99);

        resultado.Regiones.Should().BeEmpty();
        resultado.Avisos.Should().Contain(a => a.Contains("sin región ni coordenadas"));
    }

    private static async Task<(AgruparSeleccionResponse Resultado, FakeSeleccionRepository Repo)> EjecutarAgrupacionPorRegion(
        (int Codigo, double Lat, double Lon, int? RegionExt)[] hospitales,
        List<EquipoPareo>? equipos = null)
    {
        var repo = new FakeSeleccionRepository();
        var seleccion = SeleccionEnRevision(repo);
        var extensionMock = SeedAgrupacion(repo, seleccion, hospitales);

        var equipoMock = new Mock<IEquipoPareoRepository>();
        equipoMock
            .Setup(r => r.GetAllAsync(It.IsAny<EquipoPareoFiltro?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(equipos ?? []);
        equipoMock
            .Setup(r => r.GetByIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((int id, CancellationToken _) => equipos?.FirstOrDefault(e => e.IdEquipo == id));

        var service = CreateService(repo, equipoRepository: equipoMock, extensionRepository: extensionMock);
        var resultado = await service.AgruparAsync(seleccion.IdSeleccionMensual, idUsuario: 99);
        return (resultado, repo);
    }

    private static Mock<IHospitalExtensionRepository> SeedAgrupacion(
        FakeSeleccionRepository repo,
        SeleccionMensual seleccion,
        (int Codigo, double Lat, double Lon, int? RegionExt)[] hospitales)
    {
        var extensiones = new List<HospitalExtension>();

        foreach (var (codigo, lat, lon, regionExt) in hospitales)
        {
            repo.Hospitales.Add(new SeleccionHospital
            {
                IdSeleccionHospital = codigo,
                IdSeleccionMensual = seleccion.IdSeleccionMensual,
                IdHospital = codigo,
                LatitudSnapshot = (decimal)lat,
                LongitudSnapshot = (decimal)lon,
            });
            extensiones.Add(new HospitalExtension
            {
                IdHospital = codigo,
                IdRegion = regionExt,
                Activo = true,
            });
        }

        var extensionMock = new Mock<IHospitalExtensionRepository>();
        extensionMock
            .Setup(r => r.GetByHospitalIdsAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(extensiones);
        return extensionMock;
    }

    [Fact]
    public void CapacidadPeriodo_Debe_Calcular_Sobre_DiasLaborales()
    {
        // 2026-08-03 es lunes; 3 y 4 de agosto = 2 dias laborales -> min(8, 2x3) = 6
        CapacidadPeriodo.Calcular(new DateOnly(2026, 8, 3), new DateOnly(2026, 8, 4), 3, 8)
            .Should().Be(6);

        // Semana completa (lunes a domingo) -> min(8, 5x3) = 8
        CapacidadPeriodo.Calcular(new DateOnly(2026, 8, 3), new DateOnly(2026, 8, 9), 3, 8)
            .Should().Be(8);

        // Rango invalido
        CapacidadPeriodo.Calcular(new DateOnly(2026, 8, 9), new DateOnly(2026, 8, 3), 3, 8)
            .Should().Be(0);
    }

    #region HospitalesCercanosOtrasSelecciones

    private static readonly DateOnly VigenciaInicio = new(2026, 9, 1);
    private static readonly DateOnly VigenciaFin = new(2026, 10, 15);

    private static SeleccionMensual AgregarSeleccion(
        FakeSeleccionRepository repo,
        int idSeleccionMensual,
        int idTipoGerencia,
        DateOnly inicio,
        DateOnly fin,
        string estado = SeleccionMensual.EstadoEnRevision)
    {
        var seleccion = new SeleccionMensual
        {
            IdSeleccionMensual = idSeleccionMensual,
            FechaSeleccion = inicio,
            FechaInicioVigencia = inicio,
            FechaFinVigencia = fin,
            IdTipoGerencia = idTipoGerencia,
            Estado = estado,
            Activo = true,
        };
        repo.Selecciones.Add(seleccion);
        return seleccion;
    }

    private static SeleccionHospital AgregarHospital(
        FakeSeleccionRepository repo,
        int idSeleccionHospital,
        int idSeleccionMensual,
        int? idHospital,
        decimal latitud,
        decimal longitud,
        string? entidadFederativa = null,
        string? ciudadMunicipio = null)
    {
        var hospital = new SeleccionHospital
        {
            IdSeleccionHospital = idSeleccionHospital,
            IdSeleccionMensual = idSeleccionMensual,
            IdHospital = idHospital,
            LatitudSnapshot = latitud,
            LongitudSnapshot = longitud,
            EntidadFederativa = entidadFederativa,
            CiudadMunicipio = ciudadMunicipio,
        };
        repo.Hospitales.Add(hospital);
        return hospital;
    }

    private static List<TipoGerencia> TiposGerencias() =>
    [
        new() { IdTipoGerencia = 1, Descripcion = "Gerencia Uno", Activo = true },
        new() { IdTipoGerencia = 2, Descripcion = "Gerencia Dos", Activo = true },
        new() { IdTipoGerencia = 3, Descripcion = "Gerencia Tres", Activo = true },
    ];

    private static SeleccionMensualService CrearServicioCercanos(
        FakeSeleccionRepository repo,
        List<ParametroModulo>? parametros = null)
        => CreateService(repo, parametros: parametros, tiposGerencias: TiposGerencias());

    [Fact]
    public async Task HospitalesCercanos_Debe_Incluir_Ajeno_Dentro_Del_Radio_Con_Criterio_Distancia()
    {
        var repo = new FakeSeleccionRepository();
        AgregarSeleccion(repo, 1, 1, VigenciaInicio, VigenciaFin);
        AgregarSeleccion(repo, 2, 2, VigenciaInicio, VigenciaFin);
        var propio = AgregarHospital(repo, 10, 1, 100, 25.67m, -100.31m);
        // ~2 km al noreste del hospital propio
        AgregarHospital(repo, 20, 2, 200, 25.68m, -100.30m, entidadFederativa: "25", ciudadMunicipio: "Otra");

        var service = CrearServicioCercanos(repo);

        var resultado = await service.ObtenerHospitalesCercanosAsync(1);

        resultado.Should().ContainSingle();
        var cercano = resultado[0];
        cercano.IdHospital.Should().Be(200);
        cercano.NombreHospital.Should().Be("Hospital 200");
        cercano.GerenciaOrigen.Should().Be("Gerencia Dos");
        cercano.IdSeleccionMensualOrigen.Should().Be(2);
        cercano.Criterio.Should().Be("distancia");
        cercano.DistanciaKm.Should().BeLessThan(5m);
        cercano.IdSeleccionHospitalCercano.Should().Be(propio.IdSeleccionHospital);
        cercano.NombreHospitalCercano.Should().Be("Hospital 100");
    }

    [Fact]
    public async Task HospitalesCercanos_Debe_Incluir_Ajeno_Lejano_Con_Mismo_Estado()
    {
        var repo = new FakeSeleccionRepository();
        AgregarSeleccion(repo, 1, 1, VigenciaInicio, VigenciaFin);
        AgregarSeleccion(repo, 2, 2, VigenciaInicio, VigenciaFin);
        AgregarHospital(repo, 10, 1, 100, 25.67m, -100.31m, entidadFederativa: "19", ciudadMunicipio: "Monterrey");
        // ~700 km al sureste (CDMX): fuera del radio, mismo estado
        AgregarHospital(repo, 20, 2, 200, 19.43m, -99.13m, entidadFederativa: "19", ciudadMunicipio: "CDMX");

        var service = CrearServicioCercanos(repo);

        var resultado = await service.ObtenerHospitalesCercanosAsync(1);

        resultado.Should().ContainSingle();
        resultado[0].Criterio.Should().Be("mismoEstado");
        resultado[0].DistanciaKm.Should().BeGreaterThan(50m);
        resultado[0].EntidadFederativa.Should().Be("19");
    }

    [Fact]
    public async Task HospitalesCercanos_Debe_Excluir_Cerradas_Y_Misma_Gerencia()
    {
        var repo = new FakeSeleccionRepository();
        AgregarSeleccion(repo, 1, 1, VigenciaInicio, VigenciaFin);
        // Solapada pero CERRADA
        AgregarSeleccion(repo, 2, 2, VigenciaInicio, VigenciaFin, estado: SeleccionMensual.EstadoCerrada);
        // Activa y solapada pero MISMA gerencia
        AgregarSeleccion(repo, 3, 1, VigenciaInicio, VigenciaFin);
        AgregarHospital(repo, 10, 1, 100, 25.67m, -100.31m);
        AgregarHospital(repo, 20, 2, 200, 25.68m, -100.30m);
        AgregarHospital(repo, 30, 3, 300, 25.69m, -100.29m);

        var service = CrearServicioCercanos(repo);

        var resultado = await service.ObtenerHospitalesCercanosAsync(1);

        resultado.Should().BeEmpty();
    }

    [Fact]
    public async Task HospitalesCercanos_Debe_Excluir_Selecciones_Sin_Solape_De_Vigencia()
    {
        var repo = new FakeSeleccionRepository();
        AgregarSeleccion(repo, 1, 1, VigenciaInicio, VigenciaFin);
        // Otra gerencia pero sin solape (vigencia posterior)
        AgregarSeleccion(repo, 2, 2, new DateOnly(2026, 11, 1), new DateOnly(2026, 12, 15));
        AgregarHospital(repo, 10, 1, 100, 25.67m, -100.31m);
        AgregarHospital(repo, 20, 2, 200, 25.68m, -100.30m);

        var service = CrearServicioCercanos(repo);

        var resultado = await service.ObtenerHospitalesCercanosAsync(1);

        resultado.Should().BeEmpty();
    }

    [Fact]
    public async Task HospitalesCercanos_Debe_Deduplicar_Por_Hospital_Ajeno_Y_Quedarse_Con_El_Propio_Mas_Cercano()
    {
        var repo = new FakeSeleccionRepository();
        AgregarSeleccion(repo, 1, 1, VigenciaInicio, VigenciaFin);
        AgregarSeleccion(repo, 2, 2, VigenciaInicio, VigenciaFin);
        AgregarSeleccion(repo, 3, 3, VigenciaInicio, VigenciaFin);
        var propioCercano = AgregarHospital(repo, 10, 1, 100, 25.67m, -100.31m);
        AgregarHospital(repo, 11, 1, 101, 20.67m, -103.35m);
        // Mismo hospital fisico (200) en dos selecciones ajenas: ~2 km y ~380 km
        AgregarHospital(repo, 20, 2, 200, 25.68m, -100.30m);
        AgregarHospital(repo, 30, 3, 200, 20.68m, -103.34m);

        var service = CrearServicioCercanos(repo);

        var resultado = await service.ObtenerHospitalesCercanosAsync(1);

        resultado.Should().ContainSingle();
        var cercano = resultado[0];
        cercano.IdHospital.Should().Be(200);
        cercano.IdSeleccionMensualOrigen.Should().Be(2);
        cercano.DistanciaKm.Should().BeLessThan(5m);
        cercano.IdSeleccionHospitalCercano.Should().Be(propioCercano.IdSeleccionHospital);
    }

    [Fact]
    public async Task HospitalesCercanos_Debe_Excluir_Hospitales_Ya_En_La_Seleccion_Actual()
    {
        var repo = new FakeSeleccionRepository();
        AgregarSeleccion(repo, 1, 1, VigenciaInicio, VigenciaFin);
        AgregarSeleccion(repo, 2, 2, VigenciaInicio, VigenciaFin);
        AgregarHospital(repo, 10, 1, 100, 25.67m, -100.31m);
        // El hospital 100 tambien aparece en la seleccion ajena: no debe listarse
        AgregarHospital(repo, 20, 2, 100, 25.68m, -100.30m);
        AgregarHospital(repo, 21, 2, 201, 25.69m, -100.29m);

        var service = CrearServicioCercanos(repo);

        var resultado = await service.ObtenerHospitalesCercanosAsync(1);

        resultado.Should().ContainSingle();
        resultado[0].IdHospital.Should().Be(201);
    }

    #endregion
}
