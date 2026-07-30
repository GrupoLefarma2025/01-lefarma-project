using FluentAssertions;
using Lefarma.API.Domain.Entities.Asistencias;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Domain.ValueObjects.Config;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace Lefarma.UnitTests.Infrastructure;

public class JefeInmediatoResolverTests
{
    private static ApplicationDbContext CreateAppContext()
        => new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static AsistenciasDbContext CreateAsistenciasContext()
    {
        var options = new DbContextOptionsBuilder<AsistenciasDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TestableAsistenciasDbContext(options);
    }

    private class TestableAsistenciasDbContext : AsistenciasDbContext
    {
        public TestableAsistenciasDbContext(DbContextOptions<AsistenciasDbContext> options) : base(options) { }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            // La vista real es keyless; para pruebas InMemory necesitamos una clave.
            modelBuilder.Ignore<VwEmpleadoYJefe>();
            modelBuilder.Entity<VwEmpleadoYJefe>().HasKey(e => e.Nomina);
        }
    }

    private static void SembrarCadena(AsistenciasDbContext ctx)
    {
        // Cadena aplanada: 100 -> 200 -> 300 -> 1 (director general)
        ctx.VwEmpleadosYJefes.Add(new VwEmpleadoYJefe
        { Nomina = 100, NominaJefe = 200, NominaJefe2 = 300, NominaJefe3 = 1 });
        ctx.SaveChanges();
    }

    private static Mock<IEmpleadoRepository> CrearRepoEmpleadoMock()
    {
        var mock = new Mock<IEmpleadoRepository>();
        mock.Setup(r => r.ResolverNominaPorUsuarioAsync(55, It.IsAny<CancellationToken>()))
            .ReturnsAsync((long?)100);
        mock.Setup(r => r.ResolverIdUsuarioPorNominaAsync(200, It.IsAny<CancellationToken>()))
            .ReturnsAsync((int?)77);   // jefe nivel 1 -> usuario 77
        mock.Setup(r => r.ResolverIdUsuarioPorNominaAsync(300, It.IsAny<CancellationToken>()))
            .ReturnsAsync((int?)88);   // jefe nivel 2 -> usuario 88
        mock.Setup(r => r.ResolverIdUsuarioPorNominaAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync((int?)99);   // nómina 1 (director) -> usuario 99
        return mock;
    }

    private static ApplicationDbContext ActivarNivel(int idUsuario, int nivel)
    {
        var app = CreateAppContext();
        app.EmpleadoJefesConfig.Add(new EmpleadoJefeConfig
        { IdUsuario = idUsuario, Nivel = nivel, Aplica = true, Activo = true });
        app.SaveChanges();
        return app;
    }

    [Fact]
    public async Task Nivel1_Resuelve_Igual_Que_Antes()
    {
        var asistencias = CreateAsistenciasContext();
        SembrarCadena(asistencias);
        var resolver = new JefeInmediatoResolver(asistencias, CreateAppContext(), CrearRepoEmpleadoMock().Object);

        var resultado = await resolver.ResolverJefeEfectivoAsync(idWorkflow: 1, idUsuarioCreador: 55, nivel: 1);

        resultado.IdUsuario.Should().Be(77);
        resultado.MotivoOmision.Should().BeNull();
    }

    [Fact]
    public async Task Nivel2_Lee_Columna_Aplanada()
    {
        var asistencias = CreateAsistenciasContext();
        SembrarCadena(asistencias);
        var app = ActivarNivel(55, 2);
        var resolver = new JefeInmediatoResolver(asistencias, app, CrearRepoEmpleadoMock().Object);

        var resultado = await resolver.ResolverJefeEfectivoAsync(1, 55, 2);

        resultado.IdUsuario.Should().Be(88);
    }

    [Fact]
    public async Task Columna_Sin_Valor_Motivo_CadenaRota()
    {
        var asistencias = CreateAsistenciasContext();
        SembrarCadena(asistencias); // niveles 4 y 5 son NULL en la fila sembrada
        var app = ActivarNivel(55, 4);
        var resolver = new JefeInmediatoResolver(asistencias, app, CrearRepoEmpleadoMock().Object);

        var resultado = await resolver.ResolverJefeEfectivoAsync(1, 55, 4);

        resultado.IdUsuario.Should().BeNull();
        resultado.MotivoOmision.Should().Be(MotivoOmisionJefe.CadenaRota);
    }

    [Fact]
    public async Task Jefe_Sin_Usuario_Motivo_SinUsuario()
    {
        var asistencias = CreateAsistenciasContext();
        // nómina 400 existe como jefe pero el mock no la resuelve a usuario
        asistencias.VwEmpleadosYJefes.Add(new VwEmpleadoYJefe { Nomina = 100, NominaJefe = 400 });
        asistencias.SaveChanges();

        var resolver = new JefeInmediatoResolver(asistencias, CreateAppContext(), CrearRepoEmpleadoMock().Object);

        var resultado = await resolver.ResolverJefeEfectivoAsync(1, 55, 1);

        resultado.IdUsuario.Should().BeNull();
        resultado.MotivoOmision.Should().Be(MotivoOmisionJefe.SinUsuario);
    }

    [Fact]
    public async Task UsuarioJefe_Excluido_Motivo_Excluido()
    {
        var asistencias = CreateAsistenciasContext();
        SembrarCadena(asistencias);
        var app = ActivarNivel(55, 3);
        // vetamos al usuario 99 (el director general de la cadena) en el workflow 1
        app.WorkflowJefesExcluidos.Add(new WorkflowJefeExcluido
        { IdWorkflow = 1, IdUsuarioJefe = 99, Activo = true });
        app.SaveChanges();

        var resolver = new JefeInmediatoResolver(asistencias, app, CrearRepoEmpleadoMock().Object);

        var resultado = await resolver.ResolverJefeEfectivoAsync(idWorkflow: 1, idUsuarioCreador: 55, nivel: 3);

        resultado.IdUsuario.Should().BeNull();
        resultado.MotivoOmision.Should().Be(MotivoOmisionJefe.Excluido);
    }

    [Fact]
    public async Task Mismo_Usuario_En_Otro_Workflow_NO_Se_Excluye()
    {
        var asistencias = CreateAsistenciasContext();
        SembrarCadena(asistencias);
        var app = ActivarNivel(55, 3);
        app.WorkflowJefesExcluidos.Add(new WorkflowJefeExcluido { IdWorkflow = 1, IdUsuarioJefe = 99, Activo = true });
        app.SaveChanges();

        var resolver = new JefeInmediatoResolver(asistencias, app, CrearRepoEmpleadoMock().Object);

        var resultado = await resolver.ResolverJefeEfectivoAsync(idWorkflow: 2, idUsuarioCreador: 55, nivel: 3);

        resultado.IdUsuario.Should().Be(99); // workflow 2 no tiene exclusiones
    }

    [Fact]
    public async Task AplicaNivel_Sin_Config_Solo_Nivel1()
    {
        var resolver = new JefeInmediatoResolver(
            CreateAsistenciasContext(), CreateAppContext(), CrearRepoEmpleadoMock().Object);

        (await resolver.AplicaNivelJefeAsync(55, 1)).Should().BeTrue();
        (await resolver.AplicaNivelJefeAsync(55, 2)).Should().BeFalse();
    }

    [Fact]
    public async Task AplicaNivel_Con_Config_Respeta_Checks()
    {
        var app = CreateAppContext();
        app.EmpleadoJefesConfig.Add(new EmpleadoJefeConfig { IdUsuario = 55, Nivel = 1, Aplica = true, Activo = true });
        app.EmpleadoJefesConfig.Add(new EmpleadoJefeConfig { IdUsuario = 55, Nivel = 2, Aplica = false, Activo = true });
        app.SaveChanges();

        var resolver = new JefeInmediatoResolver(CreateAsistenciasContext(), app, CrearRepoEmpleadoMock().Object);

        (await resolver.AplicaNivelJefeAsync(55, 1)).Should().BeTrue();
        (await resolver.AplicaNivelJefeAsync(55, 2)).Should().BeFalse();
        (await resolver.AplicaNivelJefeAsync(55, 3)).Should().BeFalse(); // nivel sin fila = false
    }

    [Fact]
    public async Task Check_Apagado_Motivo_ConfigNoAplica()
    {
        var asistencias = CreateAsistenciasContext();
        SembrarCadena(asistencias);
        var resolver = new JefeInmediatoResolver(asistencias, CreateAppContext(), CrearRepoEmpleadoMock().Object);

        // sin config: nivel 2 no aplica por default
        var resultado = await resolver.ResolverJefeEfectivoAsync(1, 55, 2);

        resultado.IdUsuario.Should().BeNull();
        resultado.MotivoOmision.Should().Be(MotivoOmisionJefe.ConfigNoAplica);
    }

    [Fact]
    public async Task Solo_Nivel1_Aplica_Pasos_Superiores_ConfigNoAplica()
    {
        var app = CreateAppContext();
        app.EmpleadoJefesConfig.Add(new EmpleadoJefeConfig { IdUsuario = 55, Nivel = 1, Aplica = true, Activo = true });
        app.SaveChanges();
        var asistencias = CreateAsistenciasContext();
        SembrarCadena(asistencias);
        var resolver = new JefeInmediatoResolver(asistencias, app, CrearRepoEmpleadoMock().Object);

        (await resolver.ResolverJefeEfectivoAsync(1, 55, 1)).IdUsuario.Should().Be(77);
        (await resolver.ResolverJefeEfectivoAsync(1, 55, 2)).MotivoOmision.Should().Be(MotivoOmisionJefe.ConfigNoAplica);
        (await resolver.ResolverJefeEfectivoAsync(1, 55, 3)).MotivoOmision.Should().Be(MotivoOmisionJefe.ConfigNoAplica);
    }

    [Fact]
    public async Task Solo_Nivel1_Y_2_Aplican_Pasos_Superiores_ConfigNoAplica()
    {
        var app = CreateAppContext();
        app.EmpleadoJefesConfig.Add(new EmpleadoJefeConfig { IdUsuario = 55, Nivel = 1, Aplica = true, Activo = true });
        app.EmpleadoJefesConfig.Add(new EmpleadoJefeConfig { IdUsuario = 55, Nivel = 2, Aplica = true, Activo = true });
        app.SaveChanges();
        var asistencias = CreateAsistenciasContext();
        SembrarCadena(asistencias);
        var resolver = new JefeInmediatoResolver(asistencias, app, CrearRepoEmpleadoMock().Object);

        (await resolver.ResolverJefeEfectivoAsync(1, 55, 2)).IdUsuario.Should().Be(88);
        (await resolver.ResolverJefeEfectivoAsync(1, 55, 3)).MotivoOmision.Should().Be(MotivoOmisionJefe.ConfigNoAplica);
    }

    [Fact]
    public async Task Metodo_Legacy_Delega_En_Nivel1()
    {
        var asistencias = CreateAsistenciasContext();
        SembrarCadena(asistencias);
        var resolver = new JefeInmediatoResolver(asistencias, CreateAppContext(), CrearRepoEmpleadoMock().Object);

        var idJefe = await resolver.ResolverIdUsuarioJefeAsync(55);

        idJefe.Should().Be(77);
    }
}
