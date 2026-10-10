using FluentAssertions;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Features.EducacionMedica.Services;
using Lefarma.API.Features.Profile;
using Lefarma.API.Services.Identity;
using Lefarma.API.Shared.Constants;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class RutasServiceTests
{
    private const int EquipoId = 7;
    private const int IdEv = 50;
    private const int IdEp = 60;

    private sealed class FakeSeleccionRepository : ISeleccionMensualRepository
    {
        public List<SeleccionMensual> Selecciones { get; } = [];
        public List<SeleccionHospital> Hospitales { get; } = [];
        public List<SeleccionRegion> Regiones { get; } = [];

        public Task<List<SeleccionMensual>> GetAllAsync(int? anio, int? mes, CancellationToken cancellationToken = default)
            => Task.FromResult(Selecciones.ToList());

        public Task<SeleccionMensual?> GetByIdAsync(int idSeleccionMensual, CancellationToken cancellationToken = default)
            => Task.FromResult(Selecciones.FirstOrDefault(s => s.IdSeleccionMensual == idSeleccionMensual && s.Activo));

        public Task<bool> ExisteSeleccionActivaAsync(DateOnly fechaInicioVigencia, DateOnly fechaFinVigencia, int? idTipoGerencia, CancellationToken cancellationToken = default)
            => Task.FromResult(false);

        public Task<List<SeleccionMensual>> GetSeleccionesSolapadasAsync(
            int idSeleccionMensual,
            DateOnly fechaInicioVigencia,
            DateOnly fechaFinVigencia,
            int? idTipoGerencia,
            CancellationToken cancellationToken = default)
            => Task.FromResult(new List<SeleccionMensual>());

        public Task<List<SeleccionHospital>> GetHospitalesDeSeleccionesAsync(
            IEnumerable<int> idsSeleccionMensual,
            CancellationToken cancellationToken = default)
            => Task.FromResult(new List<SeleccionHospital>());

        public Task<SeleccionMensual> CreateAsync(SeleccionMensual seleccion, CancellationToken cancellationToken = default)
        {
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

    private sealed class FakeRutaRepository : IRutaRepository
    {
        public List<Ruta> Rutas { get; } = [];
        public List<RutaVisita> Visitas { get; } = [];
        public List<RutaVersion> Versiones { get; } = [];

        public Task<List<Ruta>> GetBySeleccionAsync(int idSeleccionMensual, int? version, CancellationToken cancellationToken = default)
        {
            var query = Rutas.Where(r => r.IdSeleccionMensual == idSeleccionMensual);
            if (version.HasValue) query = query.Where(r => r.Version == version.Value);
            return Task.FromResult(query.OrderBy(r => r.Version).ThenBy(r => r.IdEquipo).ToList());
        }

        public Task<int?> GetVersionActualAsync(int idSeleccionMensual, CancellationToken cancellationToken = default)
            => Task.FromResult(Rutas.Where(r => r.IdSeleccionMensual == idSeleccionMensual).Select(r => (int?)r.Version).DefaultIfEmpty(null).Max());

        public Task<List<Ruta>> GetConfirmadasPorEquiposAsync(IEnumerable<int> idsEquipos, CancellationToken cancellationToken = default)
        {
            var ids = idsEquipos.ToHashSet();
            return Task.FromResult(Rutas.Where(r => r.Estado == Ruta.EstadoCerrada && ids.Contains(r.IdEquipo)).ToList());
        }

        public Task<List<Ruta>> GetByEquipoAsync(int idEquipo, CancellationToken cancellationToken = default)
            => Task.FromResult(Rutas.Where(r => r.IdEquipo == idEquipo).ToList());

        public Task<Ruta?> GetByIdAsync(int idRuta, CancellationToken cancellationToken = default)
            => Task.FromResult(Rutas.FirstOrDefault(r => r.IdRuta == idRuta));

        public Task<Ruta> CreateAsync(Ruta ruta, CancellationToken cancellationToken = default)
        {
            ruta.IdRuta = Rutas.Any() ? Rutas.Max(r => r.IdRuta) + 1 : 1;
            Rutas.Add(ruta);
            return Task.FromResult(ruta);
        }

        public Task<Ruta> UpdateAsync(Ruta ruta, CancellationToken cancellationToken = default)
            => Task.FromResult(ruta);

        public Task<List<RutaVisita>> GetVisitasAsync(int idRuta, CancellationToken cancellationToken = default)
            => Task.FromResult(Visitas.Where(v => v.IdRuta == idRuta).OrderBy(v => v.FechaVisita).ThenBy(v => v.Orden).ToList());

        public Task<RutaVisita?> GetVisitaByIdAsync(int idRutaVisita, CancellationToken cancellationToken = default)
            => Task.FromResult(Visitas.FirstOrDefault(v => v.IdRutaVisita == idRutaVisita));

        public Task<RutaVisita> AddVisitaAsync(RutaVisita visita, CancellationToken cancellationToken = default)
        {
            visita.IdRutaVisita = Visitas.Any() ? Visitas.Max(v => v.IdRutaVisita) + 1 : 1;
            Visitas.Add(visita);
            return Task.FromResult(visita);
        }

        public Task<RutaVersion?> GetVersionAsync(int idSeleccionMensual, int version, CancellationToken cancellationToken = default)
            => Task.FromResult(Versiones.FirstOrDefault(v => v.IdSeleccionMensual == idSeleccionMensual && v.Version == version));

        public Task<RutaVersion?> GetVersionByIdAsync(int idRutaVersion, CancellationToken cancellationToken = default)
            => Task.FromResult(Versiones.FirstOrDefault(v => v.IdRutaVersion == idRutaVersion));

        public Task<RutaVersion?> GetVersionMaximaAsync(int idSeleccionMensual, CancellationToken cancellationToken = default)
            => Task.FromResult(Versiones.Where(v => v.IdSeleccionMensual == idSeleccionMensual).OrderByDescending(v => v.Version).FirstOrDefault());

        public Task<RutaVersion> CreateVersionAsync(RutaVersion version, CancellationToken cancellationToken = default)
        {
            version.IdRutaVersion = Versiones.Any() ? Versiones.Max(v => v.IdRutaVersion) + 1 : 1;
            Versiones.Add(version);
            return Task.FromResult(version);
        }

        public Task<RutaVersion> UpdateVersionAsync(RutaVersion version, CancellationToken cancellationToken = default)
            => Task.FromResult(version);

        public Task<RutaVisita> UpdateVisitaAsync(RutaVisita visita, CancellationToken cancellationToken = default)
            => Task.FromResult(visita);

        public Task RemoveVisitaAsync(RutaVisita visita, CancellationToken cancellationToken = default)
        {
            Visitas.Remove(visita);
            return Task.CompletedTask;
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private readonly FakeSeleccionRepository _seleccionRepo = new();
    private readonly FakeRutaRepository _rutaRepo = new();
    private readonly Mock<IEquipoPareoRepository> _equipoMock = new();
    private readonly Mock<IHospitalRepository> _hospitalMock = new();
    private readonly Mock<IHospitalExtensionRepository> _extensionMock = new();
    private readonly Mock<IParametroModuloRepository> _parametroMock = new();
    private readonly WorkflowTestHarness _workflow = WorkflowTestHarness.Crear();

    public RutasServiceTests()
    {
        _parametroMock
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
    }

    private RutasService CreateService(WorkflowTestHarness? workflow = null, Mock<IProfileService>? profileService = null)
    {
        workflow ??= _workflow;
        if (profileService is null)
        {
            profileService = new Mock<IProfileService>();
            profileService
                .Setup(p => p.HasFirmaAsync(It.IsAny<int>()))
                .ReturnsAsync(true);
        }

        return new(_rutaRepo, _seleccionRepo, _equipoMock.Object, _hospitalMock.Object, _extensionMock.Object,
            _parametroMock.Object, NullLogger<RutasService>.Instance,
            workflow.Engine, workflow.CreateResolverMock().Object, workflow.WorkflowRepo,
            new Mock<Lefarma.API.Features.Config.Workflows.IWorkflowQueryService>().Object,
            profileService.Object, workflow.JefeResolverMock.Object, workflow.Asokam,
            workflow.Context, new UserPermissionService(workflow.Asokam, new MemoryCache(new MemoryCacheOptions())));
    }

    private SeleccionMensual SeedSeleccionAutorizada(int cantidadHospitales, bool conRegionSegunda = false)
    {
        var seleccion = new SeleccionMensual
        {
            IdSeleccionMensual = 1,
            FechaSeleccion = new DateOnly(2026, 8, 15),
            FechaInicioVigencia = new DateOnly(2026, 9, 1),
            FechaFinVigencia = new DateOnly(2026, 10, 15),
            IdTipoGerencia = 1,
            Estado = SeleccionMensual.EstadoCerrada,
            Activo = true,
        };
        _seleccionRepo.Selecciones.Add(seleccion);

        _seleccionRepo.Regiones.Add(new SeleccionRegion
        {
            IdRegion = 1,
            IdSeleccionMensual = 1,
            Nombre = "Región 01",
            IdEquipo = EquipoId,
            CantidadHospitales = cantidadHospitales,
        });

        if (conRegionSegunda)
        {
            _seleccionRepo.Regiones.Add(new SeleccionRegion
            {
                IdRegion = 2,
                IdSeleccionMensual = 1,
                Nombre = "Región 02",
                IdEquipo = 8,
                CantidadHospitales = 0,
            });
        }

        for (var i = 1; i <= cantidadHospitales; i++)
        {
            _seleccionRepo.Hospitales.Add(new SeleccionHospital
            {
                IdSeleccionHospital = i,
                IdSeleccionMensual = 1,
                IdHospital = 100 + i,
                LatitudSnapshot = 19.430m,
                LongitudSnapshot = -99.130m,
                IdRegion = 1,
            });
        }

        _equipoMock
            .Setup(r => r.GetAllAsync(It.IsAny<EquipoPareoFiltro?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new EquipoPareo { IdEquipo = EquipoId, IdEjecutivo = IdEv, IdEspecialista = IdEp, Activo = true },
                new EquipoPareo { IdEquipo = 8, IdEjecutivo = 70, IdEspecialista = 80, Activo = true },
            ]);

        _hospitalMock
            .Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IEnumerable<int> ids, CancellationToken _) =>
                ids.Select(id => new Hospital { CodigoContacto = id, NombreContacto = $"Hospital {id}" }).ToList());
        _hospitalMock
            .Setup(r => r.GetByIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((int id, CancellationToken _) => new Hospital { CodigoContacto = id, NombreContacto = $"Hospital {id}" });

        _extensionMock
            .Setup(r => r.GetByHospitalIdsAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IEnumerable<int> ids, CancellationToken _) =>
                ids.Select(id => new HospitalExtension { IdHospital = id, EsZonaMetropolitana = true }).ToList());
        _extensionMock
            .Setup(r => r.GetByHospitalIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((int id, CancellationToken _) => new HospitalExtension { IdHospital = id, EsZonaMetropolitana = true });

        return seleccion;
    }

    [Fact]
    public async Task GenerarAsync_Debe_MantenerCiudadJuntaEnUnDia()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 4);
        // Hospitales 1-3 en Monterrey, 4 en Reynosa (lejana).
        foreach (var h in _seleccionRepo.Hospitales.Where(h => h.IdSeleccionHospital <= 3))
        {
            h.CiudadMunicipio = "Monterrey";
            h.EntidadFederativa = "Nuevo León";
            h.LatitudSnapshot = 25.670m;
            h.LongitudSnapshot = -100.310m;
        }
        var reynosa = _seleccionRepo.Hospitales.Single(h => h.IdSeleccionHospital == 4);
        reynosa.CiudadMunicipio = "Reynosa";
        reynosa.EntidadFederativa = "Tamaulipas";
        reynosa.LatitudSnapshot = 26.210m;
        reynosa.LongitudSnapshot = -98.250m;

        var service = CreateService();
        var resultado = await service.GenerarAsync(1, idUsuario: 99);

        var visitas = resultado.Rutas.Single().Visitas;
        var dias = visitas.GroupBy(v => v.FechaVisita).OrderBy(g => g.Key).ToList();

        dias.Should().HaveCount(2);
        dias[0].Select(v => v.IdSeleccionHospital).Should().BeEquivalentTo(new[] { 1, 2, 3 });
        dias[1].Select(v => v.IdSeleccionHospital).Should().BeEquivalentTo(new[] { 4 });
    }

    [Fact]
    public async Task GenerarAsync_CiudadMayorQueCapacidadDiaria_Debe_DividirlaEnDiasConsecutivos()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 5);
        foreach (var h in _seleccionRepo.Hospitales)
        {
            h.CiudadMunicipio = "León";
            h.EntidadFederativa = "Guanajuato";
            h.LatitudSnapshot = 21.120m;
            h.LongitudSnapshot = -101.680m;
        }

        var service = CreateService();
        var resultado = await service.GenerarAsync(1, idUsuario: 99);

        var visitas = resultado.Rutas.Single().Visitas;
        var dias = visitas.GroupBy(v => v.FechaVisita).OrderBy(g => g.Key).ToList();

        dias.Should().HaveCount(2);
        dias[0].Should().HaveCount(3);
        dias[1].Should().HaveCount(2);
        // Días hábiles consecutivos (1 sep 2026 = martes → 2 sep = miércoles)
        dias[1].Key.Should().Be(dias[0].Key.AddDays(1));
    }

    [Fact]
    public async Task GenerarAsync_NoDebe_FragmentarCiudadQueNoCabeEnLoQueQuedaDelDia()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 4);
        // Aguascalientes (1-2) y San Luis Potosí (3-4): bloques de 2.
        foreach (var h in _seleccionRepo.Hospitales.Where(h => h.IdSeleccionHospital <= 2))
        {
            h.CiudadMunicipio = "Aguascalientes";
            h.EntidadFederativa = "Aguascalientes";
            h.LatitudSnapshot = 21.880m;
            h.LongitudSnapshot = -102.280m;
        }
        foreach (var h in _seleccionRepo.Hospitales.Where(h => h.IdSeleccionHospital >= 3))
        {
            h.CiudadMunicipio = "San Luis Potosí";
            h.EntidadFederativa = "San Luis Potosí";
            h.LatitudSnapshot = 22.160m;
            h.LongitudSnapshot = -100.980m;
        }

        var service = CreateService();
        var resultado = await service.GenerarAsync(1, idUsuario: 99);

        var visitas = resultado.Rutas.Single().Visitas;
        var dias = visitas.GroupBy(v => v.FechaVisita).OrderBy(g => g.Key).ToList();

        // Ningún día mezcla ciudades: cada bloque viaja junto (ids 1-2 = Ags, 3-4 = SLP).
        dias.Should().HaveCount(2);
        dias.Should().OnlyContain(g =>
            g.Select(v => v.IdSeleccionHospital).All(id => id <= 2) ||
            g.Select(v => v.IdSeleccionHospital).All(id => id >= 3));
    }

    [Fact]
    public async Task GenerarAsync_EstrategiaCentroide_Debe_LlenarElDiaAunqueMezcleCiudades()
    {
        // Mismo escenario que el test de no-fragmentación, pero con el criterio clásico:
        // los hospitales se ordenan por distancia al centroide y el día se llena hasta 3
        // aunque queden ciudades mezcladas.
        SeedSeleccionAutorizada(cantidadHospitales: 4);
        foreach (var h in _seleccionRepo.Hospitales.Where(h => h.IdSeleccionHospital <= 2))
        {
            h.CiudadMunicipio = "Aguascalientes";
            h.EntidadFederativa = "Aguascalientes";
            h.LatitudSnapshot = 21.880m;
            h.LongitudSnapshot = -102.280m;
        }
        foreach (var h in _seleccionRepo.Hospitales.Where(h => h.IdSeleccionHospital >= 3))
        {
            h.CiudadMunicipio = "San Luis Potosí";
            h.EntidadFederativa = "San Luis Potosí";
            h.LatitudSnapshot = 22.160m;
            h.LongitudSnapshot = -100.980m;
        }

        var service = CreateService();
        var resultado = await service.GenerarAsync(
            1, idUsuario: 99, new GenerarRutasRequest { Estrategia = "centroide" });

        var visitas = resultado.Rutas.Single().Visitas;
        var dias = visitas.GroupBy(v => v.FechaVisita).OrderBy(g => g.Key).ToList();

        dias.Should().HaveCount(2);
        dias[0].Should().HaveCount(3);
        dias[1].Should().HaveCount(1);
        resultado.Estrategia.Should().Be("centroide");
    }

    [Fact]
    public async Task GenerarAsync_EstrategiaInvalida_Debe_Lanzar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 2);
        var service = CreateService();

        var act = () => service.GenerarAsync(
            1, idUsuario: 99, new GenerarRutasRequest { Estrategia = "aleatoria" });

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Estrategia de reparto desconocida*");
    }

    [Fact]
    public async Task GenerarAsync_Debe_Respetar_TresPorDia_SemanaYLaborales()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 10);
        var service = CreateService();

        var resultado = await service.GenerarAsync(1, idUsuario: 99);

        resultado.Rutas.Should().ContainSingle();
        var visitas = resultado.Rutas.Single().Visitas;

        visitas.Should().HaveCount(10);
        visitas.Should().OnlyContain(v =>
            v.FechaVisita.DayOfWeek != DayOfWeek.Saturday && v.FechaVisita.DayOfWeek != DayOfWeek.Sunday);
        visitas.GroupBy(v => v.FechaVisita).Should().OnlyContain(g => g.Count() <= 3);

        // Semana ISO 36 (mar 01 - vie 04 sep 2026): tope semanal de 8
        var primeraSemana = visitas.Count(v => v.FechaVisita >= new DateOnly(2026, 9, 1) && v.FechaVisita <= new DateOnly(2026, 9, 6));
        primeraSemana.Should().Be(8);

        // Posiciones únicas por día
        visitas.GroupBy(v => new { v.FechaVisita, v.Orden }).Should().OnlyContain(g => g.Count() == 1);
    }

    [Fact]
    public async Task GenerarAsync_Debe_Archivar_DraftAnterior_Y_CrearVersionNueva()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 2);
        _rutaRepo.Rutas.Add(new Ruta
        {
            IdRuta = 1,
            IdSeleccionMensual = 1,
            IdEquipo = EquipoId,
            Version = 1,
            Estado = Ruta.EstadoCreada,
        });

        var service = CreateService();
        var resultado = await service.GenerarAsync(1, idUsuario: 99);

        resultado.Version.Should().Be(2);
        resultado.Rutas.Should().OnlyContain(r => r.Version == 2 && r.Estado == Ruta.EstadoCreada);
        _rutaRepo.Rutas.First(r => r.IdRuta == 1).Estado.Should().Be(Ruta.EstadoArchivada);
        resultado.Avisos.Should().Contain(a => a.Contains("archivada"));
    }

    [Fact]
    public async Task GenerarAsync_SinSeleccionAutorizada_Debe_Lanzar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 2);
        _seleccionRepo.Selecciones.Single().Estado = SeleccionMensual.EstadoCreada;

        var service = CreateService();
        var act = () => service.GenerarAsync(1, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Autorizada*");
    }

    [Fact]
    public async Task GenerarAsync_ConRutasConfirmadas_Debe_Lanzar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 2);
        _rutaRepo.Rutas.Add(new Ruta
        {
            IdRuta = 1,
            IdSeleccionMensual = 1,
            IdEquipo = EquipoId,
            Version = 1,
            Estado = Ruta.EstadoCerrada,
        });

        var service = CreateService();
        var act = () => service.GenerarAsync(1, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*cancélalas*");
    }

    [Fact]
    public async Task GenerarAsync_CapacidadInsuficiente_Debe_Lanzar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 500);

        var service = CreateService();
        var act = () => service.GenerarAsync(1, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Capacidad insuficiente*");
    }

    [Fact]
    public async Task MoverVisitaAsync_ExcedeTresPorDia_Debe_Lanzar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 10);
        var service = CreateService();
        var resultado = await service.GenerarAsync(1, idUsuario: 99);

        var ruta = resultado.Rutas.Single();
        var visita = ruta.Visitas.First(v => v.FechaVisita == new DateOnly(2026, 9, 7));

        var act = () => service.MoverVisitaAsync(ruta.IdRuta, visita.IdRutaVisita,
            new MoverVisitaRequest { FechaVisita = new DateOnly(2026, 9, 2), Orden = 4 }, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*máximo de 3*");
    }

    [Fact]
    public async Task MoverVisitaAsync_FindeSemana_Debe_Lanzar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 4);
        var service = CreateService();
        var resultado = await service.GenerarAsync(1, idUsuario: 99);

        var ruta = resultado.Rutas.Single();
        var visita = ruta.Visitas.First();

        var act = () => service.MoverVisitaAsync(ruta.IdRuta, visita.IdRutaVisita,
            new MoverVisitaRequest { FechaVisita = new DateOnly(2026, 9, 5), Orden = 1 }, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*laborales*");
    }

    [Fact]
    public async Task MoverVisitaAsync_RutaConfirmada_Debe_Lanzar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 2);
        var service = CreateService();
        await service.GenerarAsync(1, idUsuario: 99);
        // Simula una versión ya confirmada (el flujo de confirmación se cubre en FirmarVersionAsync_*)
        foreach (var r in _rutaRepo.Rutas) r.Estado = Ruta.EstadoCerrada;

        var ruta = _rutaRepo.Rutas.Single();
        var visita = _rutaRepo.Visitas.First();

        // En Cerrada el movimiento es ajuste post-cierre (ADR-00010): sin permiso debe lanzar.
        var act = () => service.MoverVisitaAsync(ruta.IdRuta, visita.IdRutaVisita,
            new MoverVisitaRequest { FechaVisita = new DateOnly(2026, 9, 3), Orden = 1, Motivo = "Reagenda" }, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*permiso*ajustar*");
    }

    [Fact]
    public async Task AgregarVisitaAsync_HospitalYaEnOtraRuta_Debe_Lanzar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 2, conRegionSegunda: true);
        // El hospital 1 se agrega manualmente a una segunda ruta del mismo equipo-version
        var ruta1 = await _rutaRepo.CreateAsync(new Ruta
        {
            IdSeleccionMensual = 1, IdEquipo = EquipoId, Version = 1,
            Estado = Ruta.EstadoCreada, Nombre = "Ruta A",
        });
        var ruta2 = await _rutaRepo.CreateAsync(new Ruta
        {
            IdSeleccionMensual = 1, IdEquipo = EquipoId, Version = 1,
            Estado = Ruta.EstadoCreada, Nombre = "Ruta B",
        });

        await _rutaRepo.AddVisitaAsync(new RutaVisita
        {
            IdRuta = ruta1.IdRuta,
            IdSeleccionHospital = 1,
            IdHospital = 101,
            FechaVisita = new DateOnly(2026, 9, 1),
            Orden = 1,
        });

        var service = CreateService();
        var act = () => service.AgregarVisitaAsync(ruta2.IdRuta,
            new AgregarVisitaRequest { IdSeleccionHospital = 1, FechaVisita = new DateOnly(2026, 9, 2), Orden = 1 },
            idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*otra ruta*");
    }

    [Fact]
    public async Task AgregarVisitaAsync_HospitalRegionDeOtroEquipo_Debe_Lanzar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 1, conRegionSegunda: true);
        _seleccionRepo.Hospitales.Single().IdRegion = 2; // Región 02 → equipo 8
        var ruta = await _rutaRepo.CreateAsync(new Ruta
        {
            IdSeleccionMensual = 1, IdEquipo = EquipoId, Version = 1,
            Estado = Ruta.EstadoCreada, Nombre = "Ruta A",
        });

        var service = CreateService();
        var act = () => service.AgregarVisitaAsync(ruta.IdRuta,
            new AgregarVisitaRequest { IdSeleccionHospital = 1, FechaVisita = new DateOnly(2026, 9, 2), Orden = 1 },
            idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Reparto*");
    }

    [Fact]
    public async Task AgregarVisitaAsync_HospitalSinRegion_Debe_AgregarConAviso()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 0);
        _seleccionRepo.Hospitales.Add(new SeleccionHospital
        {
            IdSeleccionHospital = 1,
            IdSeleccionMensual = 1,
            IdHospital = 101,
            IdRegion = null,
        });
        var ruta = await _rutaRepo.CreateAsync(new Ruta
        {
            IdSeleccionMensual = 1, IdEquipo = EquipoId, Version = 1,
            Estado = Ruta.EstadoCreada, Nombre = "Ruta A",
        });

        var service = CreateService();
        var dto = await service.AgregarVisitaAsync(ruta.IdRuta,
            new AgregarVisitaRequest { IdSeleccionHospital = 1, FechaVisita = new DateOnly(2026, 9, 2), Orden = 1 },
            idUsuario: 99);

        dto.Aviso.Should().NotBeNullOrEmpty();
        dto.Aviso.Should().Contain("no tiene región");
    }

    [Fact]
    public async Task AgregarVisitaAsync_HospitalRegionDeLaMismaRuta_Debe_AgregarSinAviso()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 0);
        _seleccionRepo.Hospitales.Add(new SeleccionHospital
        {
            IdSeleccionHospital = 1,
            IdSeleccionMensual = 1,
            IdHospital = 101,
            IdRegion = 1, // Región 01 → EquipoId
        });
        var ruta = await _rutaRepo.CreateAsync(new Ruta
        {
            IdSeleccionMensual = 1, IdEquipo = EquipoId, Version = 1,
            Estado = Ruta.EstadoCreada, Nombre = "Ruta A",
        });

        var service = CreateService();
        var dto = await service.AgregarVisitaAsync(ruta.IdRuta,
            new AgregarVisitaRequest { IdSeleccionHospital = 1, FechaVisita = new DateOnly(2026, 9, 2), Orden = 1 },
            idUsuario: 99);

        dto.Aviso.Should().BeNull();
    }

    [Fact]
    public async Task FirmarVersionAsync_EnviarNoCreador_Debe_Lanzar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 2);
        _seleccionRepo.Selecciones.Single().IdTipoGerencia = 1;
        var service = CreateService();
        await service.GenerarAsync(1, idUsuario: 99);
        var version = _rutaRepo.Versiones.Single();

        var act = () => service.FirmarVersionAsync(version.IdRutaVersion,
            new FirmarWorkflowRequest { IdAccion = _workflow.AccionesRutas["Enviar"] }, idUsuario: 20);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*planificador*");
    }

    [Fact]
    public async Task FirmarVersionAsync_CadenaCompleta_Debe_ConfirmarYPublicar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 4);
        _seleccionRepo.Selecciones.Single().IdTipoGerencia = 1; // IMSS: firma el GV IMSS
        var service = CreateService();
        await service.GenerarAsync(1, idUsuario: 99);
        var version = _rutaRepo.Versiones.Single();

        // Enviar a autorización (planificador)
        await service.FirmarVersionAsync(version.IdRutaVersion,
            new FirmarWorkflowRequest { IdAccion = _workflow.AccionesRutas["Enviar"] }, idUsuario: 99);
        version.IdPasoActual.Should().Be(_workflow.PasosRutas["GvImss"]);

        // GV IMSS
        await service.FirmarVersionAsync(version.IdRutaVersion,
            new FirmarWorkflowRequest { IdAccion = _workflow.AccionesRutas["GvImssAutorizar"] }, idUsuario: 20);
        version.IdPasoActual.Should().Be(_workflow.PasosRutas["Ca"]);

        // Coordinador Administrativo
        await service.FirmarVersionAsync(version.IdRutaVersion,
            new FirmarWorkflowRequest { IdAccion = _workflow.AccionesRutas["CaAutorizar"] }, idUsuario: 40);
        version.IdPasoActual.Should().Be(_workflow.PasosRutas["Dc"]);

        // Dirección Corporativa: confirma y publica
        var dto = await service.FirmarVersionAsync(version.IdRutaVersion,
            new FirmarWorkflowRequest { IdAccion = _workflow.AccionesRutas["DcCerrar"] }, idUsuario: 50);

        dto.Estado.Should().Be(RutaVersion.EstadoCerrada);
        _rutaRepo.Rutas.Should().OnlyContain(r => r.Estado == Ruta.EstadoCerrada);
        _rutaRepo.Rutas.Should().OnlyContain(r => r.FechaConfirmacion != null);

        var asignacionesEv = await service.GetAsignacionesAsync(IdEv);
        asignacionesEv.Should().HaveCount(4);
        asignacionesEv.Should().OnlyContain(a => !string.IsNullOrEmpty(a.NombreHospital));

        var asignacionesOtro = await service.GetAsignacionesAsync(999);
        asignacionesOtro.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAsignacionesAsync_Debe_ResolverEstadoCiudadEInstitucion()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 1);
        var hospitalSeleccion = _seleccionRepo.Hospitales.Single();
        hospitalSeleccion.EntidadFederativa = "19";
        hospitalSeleccion.CiudadMunicipio = "Monterrey";

        _workflow.Asokam.GenEstados.Add(new GenEstado { CodigoEstado = 19, NombreEstado = "Nuevo León" });
        await _workflow.Asokam.SaveChangesAsync();

        // El hospital de la visita pertenece a la institución padre 900 (IMSS).
        _hospitalMock
            .Setup(r => r.GetByIdsAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IEnumerable<int> ids, CancellationToken _) =>
                (ids.Contains(900) ? [900] : ids).Select(id => new Hospital
                {
                    CodigoContacto = id,
                    NombreContacto = id == 900 ? "IMSS" : $"Hospital {id}",
                    CodigoContactoPrincipal = id == 900 ? null : 900,
                    Calle = id == 900 ? null : "Av. Reforma 1",
                    Colonia = id == 900 ? null : "Centro",
                    Cp = id == 900 ? null : "64000",
                    Email = id == 900 ? null : "hospital@imss.mx",
                }).ToList());

        _rutaRepo.Rutas.Add(new Ruta
        {
            IdRuta = 1,
            IdSeleccionMensual = 1,
            IdEquipo = EquipoId,
            Version = 1,
            Estado = Ruta.EstadoCerrada,
            Nombre = "Ruta A",
        });
        _rutaRepo.Visitas.Add(new RutaVisita
        {
            IdRutaVisita = 1,
            IdRuta = 1,
            IdSeleccionHospital = 1,
            FechaVisita = new DateOnly(2026, 9, 1),
            Orden = 1,
        });

        var service = CreateService();
        var asignaciones = await service.GetAsignacionesAsync(IdEv);

        asignaciones.Should().HaveCount(1);
        asignaciones[0].NombreHospital.Should().Be("Hospital 101");
        asignaciones[0].NombreRegion.Should().Be("Región 01");
        asignaciones[0].EntidadFederativa.Should().Be("Nuevo León");
        asignaciones[0].CiudadMunicipio.Should().Be("Monterrey");
        asignaciones[0].Institucion.Should().Be("IMSS");
        asignaciones[0].Latitud.Should().Be(19.430m);
        asignaciones[0].Longitud.Should().Be(-99.130m);
        asignaciones[0].Calle.Should().Be("Av. Reforma 1");
        asignaciones[0].Colonia.Should().Be("Centro");
        asignaciones[0].CodigoPostal.Should().Be("64000");
        asignaciones[0].Email.Should().Be("hospital@imss.mx");
    }

    [Fact]
    public async Task GetAsignacionesAsync_SeleccionVencida_Debe_Excluir()
    {
        var seleccion = SeedSeleccionAutorizada(cantidadHospitales: 1);
        seleccion.FechaInicioVigencia = new DateOnly(2025, 9, 1);
        seleccion.FechaFinVigencia = new DateOnly(2025, 10, 15);

        _rutaRepo.Rutas.Add(new Ruta
        {
            IdRuta = 1,
            IdSeleccionMensual = 1,
            IdEquipo = EquipoId,
            Version = 1,
            Estado = Ruta.EstadoCerrada,
            Nombre = "Ruta A",
        });
        _rutaRepo.Visitas.Add(new RutaVisita
        {
            IdRutaVisita = 1,
            IdRuta = 1,
            IdSeleccionHospital = 1,
            FechaVisita = new DateOnly(2025, 9, 10),
            Orden = 1,
        });

        var service = CreateService();
        var asignaciones = await service.GetAsignacionesAsync(IdEv);

        asignaciones.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAsignacionesAsync_SeleccionProxima_Debe_Incluir()
    {
        // La vigencia puede empezar en los próximos días: la planeación recién autorizada es la que se trabaja.
        var seleccion = SeedSeleccionAutorizada(cantidadHospitales: 1);
        seleccion.FechaInicioVigencia = new DateOnly(2026, 11, 1);
        seleccion.FechaFinVigencia = new DateOnly(2026, 12, 31);

        _rutaRepo.Rutas.Add(new Ruta
        {
            IdRuta = 1,
            IdSeleccionMensual = 1,
            IdEquipo = EquipoId,
            Version = 1,
            Estado = Ruta.EstadoCerrada,
            Nombre = "Ruta A",
        });
        _rutaRepo.Visitas.Add(new RutaVisita
        {
            IdRutaVisita = 1,
            IdRuta = 1,
            IdSeleccionHospital = 1,
            FechaVisita = new DateOnly(2026, 11, 2),
            Orden = 1,
        });

        var service = CreateService();
        var asignaciones = await service.GetAsignacionesAsync(IdEv);

        asignaciones.Should().HaveCount(1);
        asignaciones[0].FechaVisita.Should().Be(new DateOnly(2026, 11, 2));
    }

    [Fact]
    public async Task FirmarVersionAsync_DcSinCobertura_Debe_Lanzar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 4);
        _seleccionRepo.Selecciones.Single().IdTipoGerencia = 1;
        var service = CreateService();
        var generado = await service.GenerarAsync(1, idUsuario: 99);
        var version = _rutaRepo.Versiones.Single();

        // Quitar una visita deja cobertura incompleta (se hace antes de mover el paso: Draft es editable)
        var ruta = generado.Rutas.Single();
        await service.QuitarVisitaAsync(ruta.IdRuta, ruta.Visitas.Last().IdRutaVisita, motivo: null, idUsuario: 99);

        // La versión llega al paso de Dirección Corporativa
        version.IdPasoActual = _workflow.PasosRutas["Dc"];

        var act = () => service.FirmarVersionAsync(version.IdRutaVersion,
            new FirmarWorkflowRequest { IdAccion = _workflow.AccionesRutas["DcCerrar"] }, idUsuario: 50);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Cobertura incompleta*");
    }

    [Fact]
    public async Task FirmarVersionAsync_Devolver_Debe_RegresarADraft()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 2);
        _seleccionRepo.Selecciones.Single().IdTipoGerencia = 1;
        var service = CreateService();
        await service.GenerarAsync(1, idUsuario: 99);
        var version = _rutaRepo.Versiones.Single();

        await service.FirmarVersionAsync(version.IdRutaVersion,
            new FirmarWorkflowRequest { IdAccion = _workflow.AccionesRutas["Enviar"] }, idUsuario: 99);

        await service.FirmarVersionAsync(version.IdRutaVersion,
            new FirmarWorkflowRequest { IdAccion = _workflow.AccionesRutas["GvImssDevolver"], Comentario = "Ajustar la semana 2" }, idUsuario: 20);

        version.Estado.Should().Be(RutaVersion.EstadoCreada);
        version.IdPasoActual.Should().Be(_workflow.PasosRutas["Draft"]);
    }

    [Fact]
    public async Task GenerarAsync_VersionEnFirma_Debe_Lanzar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 2);
        var service = CreateService();
        await service.GenerarAsync(1, idUsuario: 99);
        var version = _rutaRepo.Versiones.Single();
        version.IdPasoActual = _workflow.PasosRutas["GvImss"]; // en autorización

        var act = () => service.GenerarAsync(1, idUsuario: 99);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*autorización*");
    }

    [Fact]
    public async Task CancelarAsync_Debe_CancelarVersion_Y_PermitirRegenerar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 2);
        var service = CreateService();
        await service.GenerarAsync(1, idUsuario: 99);
        var version = _rutaRepo.Versiones.Single();

        var canceladas = await service.CancelarAsync(1, new CancelarRutasRequest { Motivo = "Hospital no puede recibirnos" }, idUsuario: 99);

        canceladas.Should().OnlyContain(r => r.Estado == Ruta.EstadoCancelada);
        version.Estado.Should().Be(RutaVersion.EstadoCancelada);

        var regeneradas = await service.GenerarAsync(1, idUsuario: 99);
        regeneradas.Version.Should().Be(2);
        regeneradas.Rutas.Should().OnlyContain(r => r.Estado == Ruta.EstadoCreada);
    }

    [Fact]
    public void ViajesForaneos_Contar_Debe_Aplicar_ReglaDeRegionYConsecutivos()
    {
        var lunes = new DateOnly(2026, 9, 7);

        // Misma región en días consecutivos = 1 viaje
        ViajesForaneos.Contar(
        [
            (lunes, true, 1), (lunes.AddDays(1), true, 1),
        ]).Should().Be(1);

        // Cambio de región entre días consecutivos = 2 viajes
        ViajesForaneos.Contar(
        [
            (lunes, true, 1), (lunes.AddDays(1), true, 2),
        ]).Should().Be(2);

        // Días no consecutivos de la misma región = 2 viajes
        ViajesForaneos.Contar(
        [
            (lunes, true, 1), (lunes.AddDays(2), true, 1),
        ]).Should().Be(2);

        // Visitas locales no cuentan
        ViajesForaneos.Contar(
        [
            (lunes, false, 1), (lunes.AddDays(1), false, 1), (lunes.AddDays(2), false, 2),
        ]).Should().Be(0);

        // Foraneo sin clasificar cuenta como foraneo
        ViajesForaneos.Contar(
        [
            (lunes, true, null),
        ]).Should().Be(1);
    }

    [Fact]
    public async Task GenerarAsync_SinRegionesConEquipo_Debe_AvisarSinPlan()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 2);
        _seleccionRepo.Regiones.Single().IdEquipo = null;

        var service = CreateService();
        var resultado = await service.GenerarAsync(1, idUsuario: 99);

        resultado.Rutas.Should().BeEmpty();
        resultado.Avisos.Should().Contain(a => a.Contains("sin ruta"));
    }

    // ----- Ajustes post-cierre (ADR-00010) y visitas extraordinarias (ADR-00011) -----

    private const int IdCem = 800;

    private static DateOnly ProximoLunes()
    {
        var fecha = DateOnly.FromDateTime(DateTime.Today);
        while (fecha.DayOfWeek != DayOfWeek.Monday)
        {
            fecha = fecha.AddDays(1);
        }

        return fecha;
    }

    private (Ruta Ruta, RutaVisita Visita) SembrarRutaCerradaConVisita()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 2);
        var ruta = new Ruta
        {
            IdRuta = 10,
            IdSeleccionMensual = 1,
            IdEquipo = EquipoId,
            Version = 1,
            Estado = Ruta.EstadoCerrada,
            Nombre = "Ruta 1",
        };
        _rutaRepo.Rutas.Add(ruta);
        var visita = new RutaVisita
        {
            IdRutaVisita = 100,
            IdRuta = 10,
            IdSeleccionHospital = 1,
            IdHospital = 101,
            FechaVisita = DateOnly.FromDateTime(DateTime.Today).AddDays(-5),
            Orden = 1,
        };
        _rutaRepo.Visitas.Add(visita);
        return (ruta, visita);
    }

    [Fact]
    public async Task MoverVisita_EnCerrada_ConPermisoYMotivo_Debe_AplicarYAuditar()
    {
        var (ruta, visita) = SembrarRutaCerradaConVisita();
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.RutasAjustar);
        var service = CreateService();

        var dto = await service.MoverVisitaAsync(ruta.IdRuta, visita.IdRutaVisita, new MoverVisitaRequest
        {
            FechaVisita = DateOnly.FromDateTime(DateTime.Today).AddDays(-4),
            Orden = 1,
            Motivo = "Reagenda con el hospital",
        }, IdCem);

        dto.FechaVisita.Should().Be(DateOnly.FromDateTime(DateTime.Today).AddDays(-4));
        var ajuste = _workflow.Context.AjustesPostCierre.Single();
        ajuste.EntidadTipo.Should().Be(AjustePostCierre.EntidadRutaVisita);
        ajuste.IdEntidad.Should().Be(visita.IdRutaVisita);
        ajuste.Accion.Should().Be(AjustePostCierre.AccionMoverVisita);
        ajuste.Motivo.Should().Be("Reagenda con el hospital");
    }

    [Fact]
    public async Task MoverVisita_EnCerrada_SinMotivo_Debe_Fallar()
    {
        var (ruta, visita) = SembrarRutaCerradaConVisita();
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.RutasAjustar);
        var service = CreateService();

        var act = () => service.MoverVisitaAsync(ruta.IdRuta, visita.IdRutaVisita, new MoverVisitaRequest
        {
            FechaVisita = DateOnly.FromDateTime(DateTime.Today).AddDays(-4),
            Orden = 1,
        }, IdCem);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*motivo*obligatorio*");
    }

    [Fact]
    public async Task MoverVisita_EnCerrada_FueraDeLimite_Debe_Fallar()
    {
        var (ruta, visita) = SembrarRutaCerradaConVisita();
        visita.FechaVisita = DateOnly.FromDateTime(DateTime.Today).AddDays(-60);
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.RutasAjustar);
        var service = CreateService();

        var act = () => service.MoverVisitaAsync(ruta.IdRuta, visita.IdRutaVisita, new MoverVisitaRequest
        {
            FechaVisita = DateOnly.FromDateTime(DateTime.Today).AddDays(-4),
            Orden = 1,
            Motivo = "Intento tardío",
        }, IdCem);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*límite de 45 días*");
    }

    [Fact]
    public async Task MoverVisita_EnCerrada_ExcedeCapacidad_Debe_AvisarSinBloquear()
    {
        var (ruta, visita) = SembrarRutaCerradaConVisita();
        // El día destino ya tiene 3 visitas (tope 3/día): en ajuste se permite con aviso.
        var destino = DateOnly.FromDateTime(DateTime.Today).AddDays(-3);
        _rutaRepo.Visitas.AddRange(
            new RutaVisita { IdRutaVisita = 101, IdRuta = ruta.IdRuta, IdSeleccionHospital = 2, IdHospital = 102, FechaVisita = destino, Orden = 2 },
            new RutaVisita { IdRutaVisita = 102, IdRuta = ruta.IdRuta, IdSeleccionHospital = 3, IdHospital = 103, FechaVisita = destino, Orden = 3 },
            new RutaVisita { IdRutaVisita = 103, IdRuta = ruta.IdRuta, IdSeleccionHospital = 4, IdHospital = 104, FechaVisita = destino, Orden = 4 });
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.RutasAjustar);
        var service = CreateService();

        var dto = await service.MoverVisitaAsync(ruta.IdRuta, visita.IdRutaVisita, new MoverVisitaRequest
        {
            FechaVisita = destino,
            Orden = 1,
            Motivo = "Reagenda urgente",
        }, IdCem);

        dto.FechaVisita.Should().Be(destino);
        dto.Avisos.Should().Contain(a => a.Contains("máximo de 3"));
    }

    [Fact]
    public async Task EditarHoras_EnCerrada_ConPermisoYMotivo_Debe_AuditarEditarHoras()
    {
        var (ruta, visita) = SembrarRutaCerradaConVisita();
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.RutasAjustar);
        var service = CreateService();

        var dto = await service.EditarHorasVisitaAsync(ruta.IdRuta, visita.IdRutaVisita, new EditarHorasVisitaRequest
        {
            HoraSalida = new TimeOnly(8, 0),
            HoraLlegada = new TimeOnly(10, 30),
            Motivo = "Cambió la agenda",
        }, IdCem);

        dto.HoraSalida.Should().Be(new TimeOnly(8, 0));
        var ajuste = _workflow.Context.AjustesPostCierre.Single();
        ajuste.Accion.Should().Be(AjustePostCierre.AccionEditarHoras);
        ajuste.ValoresDespues.Should().Contain("08:00");
    }

    [Fact]
    public async Task QuitarVisita_EnCerrada_ConPermisoYMotivo_Debe_AuditarBaja()
    {
        var (ruta, visita) = SembrarRutaCerradaConVisita();
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.RutasAjustar);
        var service = CreateService();

        await service.QuitarVisitaAsync(ruta.IdRuta, visita.IdRutaVisita, "El hospital canceló", IdCem);

        _rutaRepo.Visitas.Should().BeEmpty();
        var ajuste = _workflow.Context.AjustesPostCierre.Single();
        ajuste.Accion.Should().Be(AjustePostCierre.AccionBajaVisita);
        ajuste.ValoresAntes.Should().Contain("idSeleccionHospital");
    }

    [Fact]
    public async Task AgregarVisita_EnCerrada_ConPermisoYMotivo_Debe_AuditarAlta()
    {
        var (ruta, _) = SembrarRutaCerradaConVisita();
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.RutasAjustar);
        var service = CreateService();

        var dto = await service.AgregarVisitaAsync(ruta.IdRuta, new AgregarVisitaRequest
        {
            IdSeleccionHospital = 2,
            FechaVisita = DateOnly.FromDateTime(DateTime.Today).AddDays(-2),
            Orden = 1,
            Motivo = "Hospital recuperado",
        }, IdCem);

        dto.IdSeleccionHospital.Should().Be(2);
        var ajuste = _workflow.Context.AjustesPostCierre.Single();
        ajuste.Accion.Should().Be(AjustePostCierre.AccionAltaVisita);
    }

    [Fact]
    public async Task CancelarAsync_Debe_PersistirMotivoEnAjustesPostCierre()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 2);
        var service = CreateService();
        await service.GenerarAsync(1, idUsuario: 99);
        var version = _rutaRepo.Versiones.Single();

        await service.CancelarAsync(1, new CancelarRutasRequest { Motivo = "Hospital no puede recibirnos" }, idUsuario: 99);

        var ajuste = _workflow.Context.AjustesPostCierre.Single();
        ajuste.EntidadTipo.Should().Be(AjustePostCierre.EntidadRutaVersion);
        ajuste.IdEntidad.Should().Be(version.IdRutaVersion);
        ajuste.Accion.Should().Be(AjustePostCierre.AccionCancelarVersion);
        ajuste.Motivo.Should().Be("Hospital no puede recibirnos");
        ajuste.ValoresAntes.Should().Contain("Creada");
        ajuste.ValoresDespues.Should().Contain("Cancelada");
    }

    [Fact]
    public async Task AgregarVisitaExtraordinaria_ConPermiso_Debe_CrearRutaSiNoExisteYAuditar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 2);
        _rutaRepo.Versiones.Add(new RutaVersion
        {
            IdRutaVersion = 1,
            IdSeleccionMensual = 1,
            Version = 1,
            Estado = RutaVersion.EstadoCerrada,
        });
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.RutasAjustar);
        var service = CreateService();

        var dto = await service.AgregarVisitaExtraordinariaAsync(1, new VisitaExtraordinariaRequest
        {
            IdEquipo = EquipoId,
            IdHospital = 999,
            FechaVisita = ProximoLunes(),
            Motivo = "Imprevisto en hospital fuera de la selección",
        }, IdCem);

        dto.EsExtraordinaria.Should().BeTrue();
        dto.IdSeleccionHospital.Should().BeNull();
        dto.IdHospital.Should().Be(999);

        var ruta = _rutaRepo.Rutas.Should().ContainSingle().Subject;
        ruta.IdEquipo.Should().Be(EquipoId);
        ruta.Estado.Should().Be(Ruta.EstadoCerrada);

        var ajuste = _workflow.Context.AjustesPostCierre.Single();
        ajuste.Accion.Should().Be(AjustePostCierre.AccionAltaVisita);
        ajuste.ValoresDespues.Should().Contain("esExtraordinaria");
    }

    [Fact]
    public async Task AgregarVisitaExtraordinaria_SinPermiso_Debe_Fallar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 2);
        _rutaRepo.Versiones.Add(new RutaVersion
        {
            IdRutaVersion = 1,
            IdSeleccionMensual = 1,
            Version = 1,
            Estado = RutaVersion.EstadoCerrada,
        });
        var service = CreateService();

        var act = () => service.AgregarVisitaExtraordinariaAsync(1, new VisitaExtraordinariaRequest
        {
            IdEquipo = EquipoId,
            IdHospital = 999,
            FechaVisita = ProximoLunes(),
            Motivo = "Imprevisto",
        }, IdCem);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*permiso*ajustar*");
    }

    [Fact]
    public async Task AgregarVisitaExtraordinaria_VersionNoCerrada_Debe_Fallar()
    {
        SeedSeleccionAutorizada(cantidadHospitales: 2);
        _rutaRepo.Versiones.Add(new RutaVersion
        {
            IdRutaVersion = 1,
            IdSeleccionMensual = 1,
            Version = 1,
            Estado = RutaVersion.EstadoCreada,
        });
        _workflow.OtorgarPermiso(IdCem, Permissions.EducacionMedica.RutasAjustar);
        var service = CreateService();

        var act = () => service.AgregarVisitaExtraordinariaAsync(1, new VisitaExtraordinariaRequest
        {
            IdEquipo = EquipoId,
            IdHospital = 999,
            FechaVisita = ProximoLunes(),
            Motivo = "Imprevisto",
        }, IdCem);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Cerrada*");
    }
}
