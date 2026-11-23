using FluentAssertions;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Lefarma.UnitTests.Infrastructure;

public class RutaVisitaMappingTests
{
    private static ApplicationDbContext CrearContexto()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer("Server=localhost;Database=modelo_no_conectado;User Id=u;Password=p;TrustServerCertificate=true")
            .Options;
        return new ApplicationDbContext(options);
    }

    [Fact]
    public void Orden_DebeMapearseA_Tinyint_ConConversion()
    {
        using var context = CrearContexto();

        var propiedad = context.Model
            .FindEntityType(typeof(RutaVisita))!
            .FindProperty(nameof(RutaVisita.Orden))!;

        propiedad.GetColumnType().Should().Be("tinyint");
        propiedad.GetProviderClrType().Should().Be(
            typeof(byte),
            "el lado proveedor debe ser byte (tinyint); la conversion interna a int es la que evita el InvalidCastException al leer");
    }
}
