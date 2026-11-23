using FluentAssertions;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class HospitalRepositoryCoordenadasTests
{
    private static AsokamDbContext CrearContextoConHospitales()
    {
        var options = new DbContextOptionsBuilder<AsokamDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var context = new AsokamDbContext(options);

        context.Hospitales.AddRange(
            new Hospital { CodigoContacto = 1, NombreContacto = "Con coords", Activo = 1, Latitud = 19.43m, Longitud = -99.13m },
            new Hospital { CodigoContacto = 2, NombreContacto = "Sin coords", Activo = 1 },
            new Hospital { CodigoContacto = 3, NombreContacto = "Cero cero", Activo = 1, Latitud = 0m, Longitud = 0m },
            new Hospital { CodigoContacto = 4, NombreContacto = "Lat cero lon valida", Activo = 1, Latitud = 0m, Longitud = -99.13m });
        context.SaveChanges();

        return context;
    }

    [Fact]
    public async Task GetHospitalesAsync_TieneCoordenadasTrue_DebeOmitirNulosYCeroCero()
    {
        using var context = CrearContextoConHospitales();
        var repo = new HospitalRepository(context, new MemoryCache(new MemoryCacheOptions()));

        var resultado = await repo.GetHospitalesAsync(
            new HospitalFilterParams { TieneCoordenadas = true });

        resultado.Select(h => h.CodigoContacto).Should().BeEquivalentTo([1, 4]);
    }

    [Fact]
    public async Task GetHospitalesAsync_TieneCoordenadasFalse_DebeTraerSoloInvalidos()
    {
        using var context = CrearContextoConHospitales();
        var repo = new HospitalRepository(context, new MemoryCache(new MemoryCacheOptions()));

        var resultado = await repo.GetHospitalesAsync(
            new HospitalFilterParams { TieneCoordenadas = false });

        resultado.Select(h => h.CodigoContacto).Should().BeEquivalentTo([2, 3]);
    }

    [Fact]
    public async Task GetHospitalesAsync_SinFiltroCoordenadas_DebeTraerTodos()
    {
        using var context = CrearContextoConHospitales();
        var repo = new HospitalRepository(context, new MemoryCache(new MemoryCacheOptions()));

        var resultado = await repo.GetHospitalesAsync(new HospitalFilterParams());

        resultado.Should().HaveCount(4);
    }
}
