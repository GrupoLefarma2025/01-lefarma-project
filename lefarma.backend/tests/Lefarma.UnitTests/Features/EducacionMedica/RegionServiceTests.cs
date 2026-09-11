using FluentAssertions;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class RegionServiceTests
{
    private sealed class FakeRegionRepository : IRegionRepository
    {
        public List<RegionCatalogo> Regiones { get; } = [];
        public List<RegionEstado> Mapeos { get; } = [];
        public List<HospitalExtension> Extensiones { get; set; } = [];
        public List<MapeoPendienteAplicar> Pendientes { get; set; } = [];
        public int PendientesAplicados { get; set; }
        public List<MapeoGpsPendienteAplicar> PendientesGps { get; set; } = [];
        public int GpsAplicados { get; set; }
        public int SinCoordenadas { get; set; }
        private int _siguienteRegion = 1;

        public Task<List<RegionCatalogo>> GetAllAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(Regiones.ToList());

        public Task<RegionCatalogo?> GetByIdAsync(int idRegion, CancellationToken cancellationToken = default)
            => Task.FromResult(Regiones.FirstOrDefault(z => z.IdRegion == idRegion));

        public Task<RegionCatalogo?> GetByNombreAsync(string nombre, CancellationToken cancellationToken = default)
            => Task.FromResult(Regiones.FirstOrDefault(z =>
                string.Equals(z.Nombre, nombre, StringComparison.OrdinalIgnoreCase)));

        public Task<RegionCatalogo> CreateAsync(RegionCatalogo region, CancellationToken cancellationToken = default)
        {
            region.IdRegion = _siguienteRegion++;
            Regiones.Add(region);
            return Task.FromResult(region);
        }

        public Task UpdateAsync(RegionCatalogo region, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<Dictionary<int, int>> GetConteosHospitalesAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(Extensiones.Where(e => e.IdRegion.HasValue)
                .GroupBy(e => e.IdRegion!.Value)
                .ToDictionary(g => g.Key, g => g.Count()));

        public Task<List<RegionEstado>> GetMapeosAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(Mapeos.ToList());

        public Task<RegionEstado?> GetMapeoByEstadoAsync(int codigoEstado, CancellationToken cancellationToken = default)
            => Task.FromResult(Mapeos.FirstOrDefault(m => m.CodigoEstado == codigoEstado));

        public Task<RegionEstado> CreateMapeoAsync(RegionEstado mapeo, CancellationToken cancellationToken = default)
        {
            mapeo.IdRegionEstado = Mapeos.Any() ? Mapeos.Max(m => m.IdRegionEstado) + 1 : 1;
            Mapeos.Add(mapeo);
            return Task.FromResult(mapeo);
        }

        public Task UpdateMapeoAsync(RegionEstado mapeo, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task SyncEstadosAsync(
            int idRegion,
            IEnumerable<int> codigoEstados,
            int idUsuario,
            CancellationToken cancellationToken = default)
        {
            var deseados = codigoEstados.Distinct().ToList();
            Mapeos.RemoveAll(m => m.IdRegion == idRegion && !deseados.Contains(m.CodigoEstado));
            Mapeos.RemoveAll(m => m.IdRegion != idRegion && deseados.Contains(m.CodigoEstado));
            var existentes = Mapeos.Where(m => m.IdRegion == idRegion).Select(m => m.CodigoEstado).ToHashSet();
            foreach (var codigo in deseados.Where(c => !existentes.Contains(c)))
            {
                Mapeos.Add(new RegionEstado
                {
                    IdRegionEstado = Mapeos.Any() ? Mapeos.Max(m => m.IdRegionEstado) + 1 : 1,
                    CodigoEstado = codigo,
                    IdRegion = idRegion
                });
            }
            return Task.CompletedTask;
        }

        public Task<List<MapeoPendienteAplicar>> PreviewAplicarMapeoAsync(
            CancellationToken cancellationToken = default)
            => Task.FromResult(Pendientes.ToList());

        public Task<int> AplicarMapeoAsync(int idUsuario, CancellationToken cancellationToken = default)
            => Task.FromResult(PendientesAplicados);

        public Task<List<MapeoGpsPendienteAplicar>> PreviewAplicarMapeoGpsAsync(
            CancellationToken cancellationToken = default)
            => Task.FromResult(PendientesGps.ToList());

        public Task<int> AplicarMapeoGpsAsync(int idUsuario, CancellationToken cancellationToken = default)
            => Task.FromResult(GpsAplicados);

        public Task<int> ContarSinRegionSinCoordenadasAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(SinCoordenadas);
    }

    private sealed class FakeHospitalRepository : IHospitalRepository
    {
        public List<Hospital> Hospitales { get; } = [];

        public Task<List<Hospital>> GetHospitalesAsync(HospitalFilterParams? filter = null, CancellationToken cancellationToken = default)
            => Task.FromResult(Hospitales.ToList());

        public Task<Hospital?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
            => Task.FromResult(Hospitales.FirstOrDefault(h => h.CodigoContacto == id));

        public Task<List<Hospital>> GetByIdsAsync(IEnumerable<int> ids, CancellationToken cancellationToken = default)
        {
            var set = ids.ToHashSet();
            return Task.FromResult(Hospitales.Where(h => set.Contains(h.CodigoContacto)).ToList());
        }
    }

    private sealed class FakeHospitalExtensionRepository : IHospitalExtensionRepository
    {
        public List<HospitalExtension> Extensiones { get; } = [];
        private int _siguiente = 1;

        public Task<List<HospitalExtension>> GetAllAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(Extensiones.ToList());

        public Task<HospitalExtension?> GetByHospitalIdAsync(int idHospital, CancellationToken cancellationToken = default)
            => Task.FromResult(Extensiones.FirstOrDefault(e => e.IdHospital == idHospital));

        public Task<List<HospitalExtension>> GetByHospitalIdsAsync(IEnumerable<int> idsHospital, CancellationToken cancellationToken = default)
        {
            var set = idsHospital.ToHashSet();
            return Task.FromResult(Extensiones.Where(e => set.Contains(e.IdHospital)).ToList());
        }

        public Task<HospitalExtension> CreateAsync(HospitalExtension extension, CancellationToken cancellationToken = default)
        {
            extension.IdHospitalExtension = _siguiente++;
            extension.Activo = true;
            Extensiones.Add(extension);
            return Task.FromResult(extension);
        }

        public Task UpdateAsync(HospitalExtension extension, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private static AsokamDbContext CreateAsokamInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<AsokamDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AsokamDbContext(options);
    }

    private static RegionService CrearServicio(
        FakeRegionRepository regiones,
        FakeHospitalRepository hospitales,
        FakeHospitalExtensionRepository extensiones)
    {
        return new RegionService(regiones, hospitales, extensiones, CreateAsokamInMemoryContext());
    }

    [Fact]
    public async Task GetRegionesAsync_DebeContarHospitalesPorRegion()
    {
        var regiones = new FakeRegionRepository
        {
            Regiones =
            {
                new RegionCatalogo { IdRegion = 1, Nombre = "NORESTE", Activo = true },
                new RegionCatalogo { IdRegion = 2, Nombre = "SURESTE", Activo = true }
            },
            Extensiones =
            {
                new HospitalExtension { IdHospital = 10, IdRegion = 2 },
                new HospitalExtension { IdHospital = 11, IdRegion = 2 },
                new HospitalExtension { IdHospital = 12, IdRegion = null }
            }
        };
        var servicio = CrearServicio(regiones, new FakeHospitalRepository(), new FakeHospitalExtensionRepository());

        var resultado = await servicio.GetRegionesAsync();

        resultado.Should().HaveCount(2);
        resultado.Single(z => z.IdRegion == 2).CantidadHospitales.Should().Be(2);
        resultado.Single(z => z.IdRegion == 1).CantidadHospitales.Should().Be(0);
    }

    [Fact]
    public async Task CreateRegionAsync_ConNombreDuplicado_DebeRechazar()
    {
        var regiones = new FakeRegionRepository
        {
            Regiones = { new RegionCatalogo { IdRegion = 1, Nombre = "NORESTE", Activo = true } }
        };
        var servicio = CrearServicio(regiones, new FakeHospitalRepository(), new FakeHospitalExtensionRepository());

        var act = () => servicio.CreateRegionAsync(new UpsertRegionRequest { Nombre = " noreste " }, 1);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Ya existe una región*");
    }

    [Fact]
    public async Task CreateRegionAsync_ConNombreVacio_DebeRechazar()
    {
        var servicio = CrearServicio(new FakeRegionRepository(), new FakeHospitalRepository(), new FakeHospitalExtensionRepository());

        var act = () => servicio.CreateRegionAsync(new UpsertRegionRequest { Nombre = "  " }, 1);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*obligatorio*");
    }

    [Fact]
    public async Task UpdateRegionAsync_RegionInexistente_DebeRechazar()
    {
        var servicio = CrearServicio(new FakeRegionRepository(), new FakeHospitalRepository(), new FakeHospitalExtensionRepository());

        var act = () => servicio.UpdateRegionAsync(999, new UpsertRegionRequest { Nombre = "NUEVA" }, 1);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*No existe la región 999*");
    }

    [Fact]
    public async Task AsignarRegionHospitalAsync_HospitalInexistente_DebeRechazar()
    {
        var servicio = CrearServicio(new FakeRegionRepository(), new FakeHospitalRepository(), new FakeHospitalExtensionRepository());

        var act = () => servicio.AsignarRegionHospitalAsync(999, new AsignarRegionHospitalRequest { IdRegion = 1 }, 1);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*No existe el hospital 999*");
    }

    [Fact]
    public async Task AsignarRegionHospitalAsync_RegionInexistente_DebeRechazar()
    {
        var hospitales = new FakeHospitalRepository
        {
            Hospitales = { new Hospital { CodigoContacto = 10 } }
        };
        var servicio = CrearServicio(new FakeRegionRepository(), hospitales, new FakeHospitalExtensionRepository());

        var act = () => servicio.AsignarRegionHospitalAsync(10, new AsignarRegionHospitalRequest { IdRegion = 999 }, 1);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*No existe la región 999*");
    }

    [Fact]
    public async Task AsignarRegionHospitalAsync_ExtensionExistente_DebeActualizarRegion()
    {
        var regiones = new FakeRegionRepository
        {
            Regiones = { new RegionCatalogo { IdRegion = 1, Nombre = "NORESTE", Activo = true } }
        };
        var hospitales = new FakeHospitalRepository
        {
            Hospitales = { new Hospital { CodigoContacto = 10 } }
        };
        var extensiones = new FakeHospitalExtensionRepository
        {
            Extensiones =
            {
                new HospitalExtension { IdHospitalExtension = 5, IdHospital = 10, IdRegion = null, Activo = true }
            }
        };
        regiones.Extensiones = extensiones.Extensiones;
        var servicio = CrearServicio(regiones, hospitales, extensiones);

        var resultado = await servicio.AsignarRegionHospitalAsync(10, new AsignarRegionHospitalRequest { IdRegion = 1 }, 7);

        resultado.IdRegion.Should().Be(1);
        extensiones.Extensiones.Single().IdRegion.Should().Be(1);
    }

    [Fact]
    public async Task AsignarRegionHospitalAsync_SinExtension_DebeCrearlaConLaRegion()
    {
        var regiones = new FakeRegionRepository
        {
            Regiones = { new RegionCatalogo { IdRegion = 1, Nombre = "NORESTE", Activo = true } }
        };
        var hospitales = new FakeHospitalRepository
        {
            Hospitales = { new Hospital { CodigoContacto = 10 } }
        };
        var extensiones = new FakeHospitalExtensionRepository();
        regiones.Extensiones = extensiones.Extensiones;
        var servicio = CrearServicio(regiones, hospitales, extensiones);

        var resultado = await servicio.AsignarRegionHospitalAsync(10, new AsignarRegionHospitalRequest { IdRegion = 1 }, 7);

        resultado.IdRegion.Should().Be(1);
        resultado.IdHospital.Should().Be(10);
        extensiones.Extensiones.Should().ContainSingle(e => e.IdHospital == 10 && e.IdRegion == 1);
    }

    [Fact]
    public async Task AsignarRegionHospitalAsync_ConIdRegionNull_DebeQuitarLaRegion()
    {
        var regiones = new FakeRegionRepository
        {
            Regiones = { new RegionCatalogo { IdRegion = 1, Nombre = "NORESTE", Activo = true } }
        };
        var hospitales = new FakeHospitalRepository
        {
            Hospitales = { new Hospital { CodigoContacto = 10 } }
        };
        var extensiones = new FakeHospitalExtensionRepository
        {
            Extensiones =
            {
                new HospitalExtension { IdHospitalExtension = 5, IdHospital = 10, IdRegion = 1, Activo = true }
            }
        };
        regiones.Extensiones = extensiones.Extensiones;
        var servicio = CrearServicio(regiones, hospitales, extensiones);

        var resultado = await servicio.AsignarRegionHospitalAsync(10, new AsignarRegionHospitalRequest { IdRegion = null }, 7);

        resultado.IdRegion.Should().BeNull();
        extensiones.Extensiones.Single().IdRegion.Should().BeNull();
    }

    [Fact]
    public async Task CreateRegionAsync_ConEstados_DebeSincronizarElMapeo()
    {
        var regiones = new FakeRegionRepository();
        var servicio = CrearServicio(regiones, new FakeHospitalRepository(), new FakeHospitalExtensionRepository());

        var resultado = await servicio.CreateRegionAsync(
            new UpsertRegionRequest { Nombre = "NORESTE", CodigoEstados = [491, 503, 513] }, 1);

        resultado.Estados.Should().HaveCount(3);
        regiones.Mapeos.Should().HaveCount(3);
        regiones.Mapeos.Should().OnlyContain(m => m.IdRegion == resultado.IdRegion);
    }

    [Fact]
    public async Task UpdateRegionAsync_EstadoOcupadoEnOtraRegion_DebeMoverlo()
    {
        var regiones = new FakeRegionRepository
        {
            Regiones =
            {
                new RegionCatalogo { IdRegion = 1, Nombre = "NORESTE", Activo = true },
                new RegionCatalogo { IdRegion = 2, Nombre = "OCCIDENTE", Activo = true }
            },
            Mapeos =
            {
                new RegionEstado { IdRegionEstado = 1, CodigoEstado = 491, IdRegion = 1 },
                new RegionEstado { IdRegionEstado = 2, CodigoEstado = 498, IdRegion = 2 }
            }
        };
        var servicio = CrearServicio(regiones, new FakeHospitalRepository(), new FakeHospitalExtensionRepository());

        // Coahuila (491) pasa de NORESTE a OCCIDENTE.
        await servicio.UpdateRegionAsync(2, new UpsertRegionRequest { Nombre = "OCCIDENTE", CodigoEstados = [498, 491] }, 1);

        regiones.Mapeos.Single(m => m.CodigoEstado == 491).IdRegion.Should().Be(2);
        regiones.Mapeos.Single(m => m.CodigoEstado == 498).IdRegion.Should().Be(2);
        regiones.Mapeos.Should().HaveCount(2);
    }

    [Fact]
    public async Task UpdateRegionAsync_QuitandoEstado_DebeEliminarSuMapeo()
    {
        var regiones = new FakeRegionRepository
        {
            Regiones = { new RegionCatalogo { IdRegion = 1, Nombre = "NORESTE", Activo = true } },
            Mapeos = { new RegionEstado { IdRegionEstado = 1, CodigoEstado = 491, IdRegion = 1 } }
        };
        var servicio = CrearServicio(regiones, new FakeHospitalRepository(), new FakeHospitalExtensionRepository());

        await servicio.UpdateRegionAsync(1, new UpsertRegionRequest { Nombre = "NORESTE", CodigoEstados = [] }, 1);

        regiones.Mapeos.Should().BeEmpty();
    }

    [Fact]
    public async Task GetSugerenciaAsync_DevuelvePorEstadoYPorGps()
    {
        var regiones = new FakeRegionRepository
        {
            Regiones =
            {
                new RegionCatalogo { IdRegion = 1, Nombre = "NORESTE", Activo = true, CentroLatitud = 25.7m, CentroLongitud = -100.3m },
                new RegionCatalogo { IdRegion = 2, Nombre = "SURESTE", Activo = true, CentroLatitud = 19.0m, CentroLongitud = -96.0m }
            },
            Mapeos = { new RegionEstado { IdRegionEstado = 1, CodigoEstado = 491, IdRegion = 1 } }
        };
        var hospitales = new FakeHospitalRepository
        {
            // Hospital en Coahuila con coordenadas de Saltillo.
            Hospitales = { new Hospital { CodigoContacto = 10, CodigoEstado = "491", Latitud = 25.42m, Longitud = -100.99m } }
        };
        var servicio = CrearServicio(regiones, hospitales, new FakeHospitalExtensionRepository());

        var sugerencia = await servicio.GetSugerenciaAsync(10);

        sugerencia.PorEstado.Should().NotBeNull();
        sugerencia.PorEstado!.IdRegion.Should().Be(1);
        sugerencia.PorGps.Should().NotBeNull();
        sugerencia.PorGps!.IdRegion.Should().Be(1);
        sugerencia.PorGps!.DistanciaKm.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetSugerenciaAsync_EstadoSinMapeo_DevuelveSoloGps()
    {
        var regiones = new FakeRegionRepository
        {
            Regiones =
            {
                new RegionCatalogo { IdRegion = 1, Nombre = "CDMX NORTE", Activo = true, CentroLatitud = 19.49m, CentroLongitud = -99.13m }
            }
        };
        var hospitales = new FakeHospitalRepository
        {
            // CDMX (493) no tiene mapeo; hospital con coordenadas.
            Hospitales = { new Hospital { CodigoContacto = 20, CodigoEstado = "493", Latitud = 19.49m, Longitud = -99.20m } }
        };
        var servicio = CrearServicio(regiones, hospitales, new FakeHospitalExtensionRepository());

        var sugerencia = await servicio.GetSugerenciaAsync(20);

        sugerencia.PorEstado.Should().BeNull();
        sugerencia.PorGps.Should().NotBeNull();
        sugerencia.PorGps!.IdRegion.Should().Be(1);
    }

    [Fact]
    public async Task GetSugerenciaAsync_HospitalInexistente_DebeRechazar()
    {
        var servicio = CrearServicio(new FakeRegionRepository(), new FakeHospitalRepository(), new FakeHospitalExtensionRepository());

        var act = () => servicio.GetSugerenciaAsync(999);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*No existe el hospital 999*");
    }

    [Fact]
    public async Task PreviewAplicarMapeoAsync_DebeTotalizarDetalles()
    {
        var regiones = new FakeRegionRepository
        {
            Regiones =
            {
                new RegionCatalogo { IdRegion = 1, Nombre = "NORESTE", Activo = true },
                new RegionCatalogo { IdRegion = 2, Nombre = "OCCIDENTE", Activo = true },
                new RegionCatalogo { IdRegion = 3, Nombre = "CDMX SUR", Activo = true }
            },
            Pendientes =
            {
                new MapeoPendienteAplicar { CodigoEstado = 491, IdRegion = 1, Hospitales = 3 },
                new MapeoPendienteAplicar { CodigoEstado = 498, IdRegion = 2, Hospitales = 5 }
            },
            PendientesGps =
            {
                new MapeoGpsPendienteAplicar { IdRegion = 3, Hospitales = 7 }
            },
            SinCoordenadas = 2
        };
        var servicio = CrearServicio(regiones, new FakeHospitalRepository(), new FakeHospitalExtensionRepository());

        var preview = await servicio.PreviewAplicarMapeoAsync();

        preview.TotalHospitales.Should().Be(8);
        preview.Detalles.Should().HaveCount(2);
        preview.TotalPorGps.Should().Be(7);
        preview.DetallesGps.Should().ContainSingle()
            .Which.NombreRegion.Should().Be("CDMX SUR");
        preview.SinCoordenadas.Should().Be(2);
    }

    [Fact]
    public async Task AplicarMapeoAsync_DevuelveMovidosPorEstadoYGps()
    {
        var regiones = new FakeRegionRepository { PendientesAplicados = 42, GpsAplicados = 7 };
        var servicio = CrearServicio(regiones, new FakeHospitalRepository(), new FakeHospitalExtensionRepository());

        var resultado = await servicio.AplicarMapeoAsync(1);

        resultado.PorEstado.Should().Be(42);
        resultado.PorGps.Should().Be(7);
        resultado.Total.Should().Be(49);
    }
}
