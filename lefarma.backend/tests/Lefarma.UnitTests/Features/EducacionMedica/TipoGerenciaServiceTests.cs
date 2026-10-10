using FluentAssertions;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica;
using Moq;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class TipoGerenciaServiceTests
{
    [Fact]
    public async Task GetAll_IncluyeTotalDeHospitalesPorGerencia()
    {
        var repo = new Mock<ITipoGerenciaRepository>();
        repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([
                new TipoGerencia { IdTipoGerencia = 1, Descripcion = "IMSS", Activo = true },
                new TipoGerencia { IdTipoGerencia = 2, Descripcion = "Descentralizado", Activo = true },
                new TipoGerencia { IdTipoGerencia = 3, Descripcion = "Privado", Activo = true },
            ]);
        repo.Setup(r => r.GetConteosHospitalesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<int, int> { [1] = 80, [2] = 4745 });

        var servicio = new TipoGerenciaService(repo.Object);

        var resultado = await servicio.GetAllAsync();

        resultado.Should().HaveCount(3);
        resultado.Single(t => t.IdTipoGerencia == 1).TotalHospitales.Should().Be(80);
        resultado.Single(t => t.IdTipoGerencia == 2).TotalHospitales.Should().Be(4745);
        resultado.Single(t => t.IdTipoGerencia == 3).TotalHospitales.Should().Be(0);
    }
}
