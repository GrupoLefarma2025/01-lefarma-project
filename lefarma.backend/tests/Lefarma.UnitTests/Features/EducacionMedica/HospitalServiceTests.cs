using FluentAssertions;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica;
using Moq;

namespace Lefarma.UnitTests.Features.EducacionMedica;

public class HospitalServiceTests
{
    private const int IdGerenciaImss = 1;
    private const int IdGerenciaDescentralizado = 2;
    private const int IdGerenciaPrivado = 3;

    private static Hospital Hospital(
        int id,
        string? codigoEstado = "501",
        string? ciudad = null,
        string? tipo = "Gobierno",
        int? codigoContactoPrincipal = null,
        string? nombre = null) => new()
    {
        CodigoContacto = id,
        NombreContacto = nombre ?? $"Hospital {id}",
        CodigoEstado = codigoEstado,
        Ciudad = ciudad,
        Tipo = tipo,
        CodigoContactoPrincipal = codigoContactoPrincipal,
        Activo = 1,
    };

    private static (
        HospitalService Servicio,
        Mock<IHospitalRepository> Hospitales,
        Mock<IHospitalExtensionRepository> Extensiones) Crear()
    {
        var hospitales = new Mock<IHospitalRepository>();
        var extensiones = new Mock<IHospitalExtensionRepository>();
        var tipos = new Mock<ITipoGerenciaRepository>();
        var parametros = new Mock<IParametroAnestesiaRepository>();
        var regiones = new Mock<IRegionRepository>();

        tipos.Setup(t => t.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([
                new TipoGerencia { IdTipoGerencia = IdGerenciaImss, Descripcion = "IMSS", Activo = true },
                new TipoGerencia { IdTipoGerencia = IdGerenciaDescentralizado, Descripcion = "Descentralizado", Activo = true },
                new TipoGerencia { IdTipoGerencia = IdGerenciaPrivado, Descripcion = "Privado", Activo = true },
            ]);

        regiones.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var servicio = new HospitalService(
            hospitales.Object,
            extensiones.Object,
            tipos.Object,
            parametros.Object,
            regiones.Object);

        return (servicio, hospitales, extensiones);
    }

    private static void ConfigurarHospitales(Mock<IHospitalRepository> mock, params Hospital[] hospitales)
    {
        mock.Setup(h => h.GetHospitalesAsync(It.IsAny<HospitalFilterParams?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(hospitales.ToList());
    }

    private static void ConfigurarExistentes(Mock<IHospitalExtensionRepository> mock, params int[] ids)
    {
        mock.Setup(e => e.GetByHospitalIdsAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(ids.Select(id => new HospitalExtension { IdHospital = id, NumeroQuirofanos = 3 }).ToList());
    }

    [Fact]
    public async Task Sincronizar_CreaSoloFaltantes_YNoTocaExistentes()
    {
        var (servicio, hospitales, extensiones) = Crear();
        ConfigurarHospitales(hospitales, Hospital(1), Hospital(2), Hospital(3));
        ConfigurarExistentes(extensiones, 2);

        List<HospitalExtension> creadas = [];
        extensiones
            .Setup(e => e.CreateRangeAsync(It.IsAny<IEnumerable<HospitalExtension>>(), It.IsAny<CancellationToken>()))
            .Callback<IEnumerable<HospitalExtension>, CancellationToken>((lista, _) => creadas = lista.ToList())
            .Returns(Task.CompletedTask);

        var resultado = await servicio.SincronizarExtensionesAsync(idUsuario: 99);

        resultado.TotalHospitales.Should().Be(3);
        resultado.Creadas.Should().Be(2);
        resultado.YaExistian.Should().Be(1);

        creadas.Should().HaveCount(2);
        creadas.Select(c => c.IdHospital).Should().BeEquivalentTo([1, 3]);
        creadas.Should().OnlyContain(c => c.IdUsuarioCreacion == 99 && c.IdUsuarioModificacion == 99);
        creadas.Should().OnlyContain(c => c.IdTipoGerencia == IdGerenciaDescentralizado);

        // El hospital con extensión existente no se inserta ni actualiza
        extensiones.Verify(e => e.CreateAsync(It.IsAny<HospitalExtension>(), It.IsAny<CancellationToken>()), Times.Never);
        extensiones.Verify(e => e.UpdateAsync(It.IsAny<HospitalExtension>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Sincronizar_ClasificaGerenciaPorJerarquia()
    {
        var (servicio, hospitales, extensiones) = Crear();
        ConfigurarHospitales(
            hospitales,
            Hospital(364, tipo: "Gobierno"),                          // institucion IMSS -> IMSS
            Hospital(10, tipo: "Gobierno", codigoContactoPrincipal: 364), // hijo de IMSS -> IMSS
            Hospital(20, tipo: "Gobierno", codigoContactoPrincipal: 385), // Bienestar -> Descentralizado
            Hospital(30, tipo: "Gobierno", codigoContactoPrincipal: 370), // ISSSTE -> Descentralizado
            Hospital(40, tipo: "Gobierno"),                            // Gobierno sin padre -> Descentralizado
            Hospital(50, tipo: null),                                 // tipo NULL -> Descentralizado
            Hospital(60, tipo: "Privado"));                            // Privado -> Privado
        ConfigurarExistentes(extensiones);

        List<HospitalExtension> creadas = [];
        extensiones
            .Setup(e => e.CreateRangeAsync(It.IsAny<IEnumerable<HospitalExtension>>(), It.IsAny<CancellationToken>()))
            .Callback<IEnumerable<HospitalExtension>, CancellationToken>((lista, _) => creadas = lista.ToList())
            .Returns(Task.CompletedTask);

        await servicio.SincronizarExtensionesAsync(idUsuario: 1);

        var porHospital = creadas.ToDictionary(c => c.IdHospital, c => c.IdTipoGerencia);
        porHospital[364].Should().Be(IdGerenciaImss);
        porHospital[10].Should().Be(IdGerenciaImss);
        porHospital[20].Should().Be(IdGerenciaDescentralizado);
        porHospital[30].Should().Be(IdGerenciaDescentralizado);
        porHospital[40].Should().Be(IdGerenciaDescentralizado);
        porHospital[50].Should().Be(IdGerenciaDescentralizado);
        porHospital[60].Should().Be(IdGerenciaPrivado);
    }

    [Fact]
    public async Task Sincronizar_DerivaZonaMetropolitanaAlCrear()
    {
        var (servicio, hospitales, extensiones) = Crear();
        ConfigurarHospitales(
            hospitales,
            Hospital(1, codigoEstado: "493", ciudad: "Coyoacán"),          // CDMX -> local
            Hospital(2, codigoEstado: "501", ciudad: "Naucalpan de Juárez"), // conurbado -> local
            Hospital(3, codigoEstado: "501", ciudad: "Toluca"),             // Edomex no conurbado -> foráneo
            Hospital(4, codigoEstado: null));                               // sin estado -> foráneo
        ConfigurarExistentes(extensiones);

        List<HospitalExtension> creadas = [];
        extensiones
            .Setup(e => e.CreateRangeAsync(It.IsAny<IEnumerable<HospitalExtension>>(), It.IsAny<CancellationToken>()))
            .Callback<IEnumerable<HospitalExtension>, CancellationToken>((lista, _) => creadas = lista.ToList())
            .Returns(Task.CompletedTask);

        await servicio.SincronizarExtensionesAsync(idUsuario: 1);

        var porHospital = creadas.ToDictionary(c => c.IdHospital, c => c.EsZonaMetropolitana);
        porHospital[1].Should().BeTrue();
        porHospital[2].Should().BeTrue();
        porHospital[3].Should().BeFalse();
        porHospital[4].Should().BeFalse();
    }

    [Fact]
    public async Task Sincronizar_SinHospitales_DevuelveCerosYNoCrea()
    {
        var (servicio, hospitales, extensiones) = Crear();
        ConfigurarHospitales(hospitales);

        var resultado = await servicio.SincronizarExtensionesAsync(idUsuario: 1);

        resultado.TotalHospitales.Should().Be(0);
        resultado.Creadas.Should().Be(0);
        resultado.YaExistian.Should().Be(0);
        extensiones.Verify(e => e.CreateRangeAsync(It.IsAny<IEnumerable<HospitalExtension>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Sincronizar_TodosConExtension_NoCreaNada()
    {
        var (servicio, hospitales, extensiones) = Crear();
        ConfigurarHospitales(hospitales, Hospital(1), Hospital(2));
        ConfigurarExistentes(extensiones, 1, 2);

        var resultado = await servicio.SincronizarExtensionesAsync(idUsuario: 1);

        resultado.Creadas.Should().Be(0);
        resultado.YaExistian.Should().Be(2);
        extensiones.Verify(e => e.CreateRangeAsync(It.IsAny<IEnumerable<HospitalExtension>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Sincronizar_ClasificaContactosLogisticosYSedes()
    {
        var (servicio, hospitales, extensiones) = Crear();
        ConfigurarHospitales(
            hospitales,
            Hospital(100, nombre: "ALMACEN DELEGACIONAL EN GUANAJUATO"),
            Hospital(101, nombre: "UMAE GINECO - PEDIATRIA GUANAJUATO - SUB-ALMACÉN"),
            Hospital(102, nombre: "UMAE GINECO - PEDIATRIA GUANAJUATO - FARMACIA"),
            Hospital(103, nombre: "UMAE ESPECIALIDADES SONORA - FARMACIA"),
            Hospital(104, nombre: "UMAE HOSPITAL DE ESPECIALIDADES C.M.N.O."),
            Hospital(105, nombre: "BIRMEX HUEHUETOCA"));
        ConfigurarExistentes(extensiones);

        List<HospitalExtension> creadas = [];
        extensiones
            .Setup(e => e.CreateRangeAsync(It.IsAny<IEnumerable<HospitalExtension>>(), It.IsAny<CancellationToken>()))
            .Callback<IEnumerable<HospitalExtension>, CancellationToken>((lista, _) => creadas = lista.ToList())
            .Returns(Task.CompletedTask);

        await servicio.SincronizarExtensionesAsync(idUsuario: 1);

        var porHospital = creadas.ToDictionary(c => c.IdHospital);

        // Almacén delegacional y BIRMEX: logísticos, no sede
        porHospital[100].EsAlmacen.Should().BeTrue();
        porHospital[100].EsSedeTaller.Should().BeFalse();
        porHospital[105].EsAlmacen.Should().BeTrue();
        porHospital[105].EsSedeTaller.Should().BeFalse();

        // Sub-almacén: almacén pero sede preferente de su UMAE
        porHospital[101].EsAlmacen.Should().BeTrue();
        porHospital[101].EsSedeTaller.Should().BeTrue();

        // Farmacia con sub-almacén del mismo UMAE: no sede
        porHospital[102].EsFarmacia.Should().BeTrue();
        porHospital[102].EsSedeTaller.Should().BeFalse();

        // Farmacia sin sub-almacén: sede (si no, la UMAE desaparecería)
        porHospital[103].EsFarmacia.Should().BeTrue();
        porHospital[103].EsSedeTaller.Should().BeTrue();

        // Contacto normal: sede
        porHospital[104].EsSedeTaller.Should().BeTrue();
        porHospital[104].EsAlmacen.Should().BeFalse();
        porHospital[104].EsFarmacia.Should().BeFalse();
    }

    [Fact]
    public async Task GetHospitalesAsync_FiltroSede_Debe_FiltrarPorClasificacion()
    {
        var (servicio, hospitales, extensiones) = Crear();
        ConfigurarHospitales(hospitales, Hospital(1), Hospital(2), Hospital(3), Hospital(4));
        extensiones
            .Setup(e => e.GetByHospitalIdsAsync(It.IsAny<IEnumerable<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([
                new HospitalExtension { IdHospital = 1, EsSedeTaller = true },
                new HospitalExtension { IdHospital = 2, EsSedeTaller = false, EsAlmacen = true },
                new HospitalExtension { IdHospital = 3, EsSedeTaller = null },
                // Hospital 4 sin extensión
            ]);

        var sedes = await servicio.GetHospitalesAsync(new HospitalFilterParams { FiltroSede = "sedes" });
        sedes.Items.Select(h => h.CodigoContacto).Should().BeEquivalentTo([1, 3, 4]);

        var logisticos = await servicio.GetHospitalesAsync(new HospitalFilterParams { FiltroSede = "logisticos" });
        logisticos.Items.Select(h => h.CodigoContacto).Should().BeEquivalentTo([2]);

        var sinClasificar = await servicio.GetHospitalesAsync(new HospitalFilterParams { FiltroSede = "sin-clasificar" });
        sinClasificar.Items.Select(h => h.CodigoContacto).Should().BeEquivalentTo([3]);
    }
}
