using FluentAssertions;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.ValueObjects.Config;
using Lefarma.API.Features.OrdenesCompra.Visibilidad;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Services.Identity;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moq;

namespace Lefarma.UnitTests.Features.OrdenesCompra;

/// <summary>
/// Matriz de alcances de visibilidad de órdenes de compra (ADR 00001):
/// total, por empresa, por flujo, base (propias + paso actual), jefe inmediato
/// y la comprobación puntual <see cref="IOrdenCompraVisibilidadService.PuedeVerAsync"/>.
/// </summary>
public class OrdenCompraVisibilidadTests
{
    // ---------- 1. Alcance total ----------

    [Fact]
    public async Task Total_Ve_Todas_Las_Ordenes_Sin_Importar_Creador_Empresa_Flujo_Estado()
    {
        using var arnes = new Arnes();
        arnes.OtorgarPermiso(10, Permissions.OrdenesCompra.VerTodas);

        arnes.SembrarOrden(1001, creador: 98, empresa: 3, workflow: 19, paso: 10, estado: 5);
        arnes.SembrarOrden(1002, creador: 99, empresa: 1, workflow: 6, paso: 20, estado: 8);
        arnes.SembrarOrden(1003, creador: 77, empresa: 9, workflow: 3, paso: 1, estado: 1);

        var alcance = await arnes.Servicio.ResolverAsync(10);
        var visibles = arnes.Visibles(alcance);

        alcance.VerTodas.Should().BeTrue();
        visibles.Should().BeEquivalentTo(new[] { 1001, 1002, 1003 });
        (await arnes.Servicio.PuedeVerAsync(1003, 10)).Should().BeTrue();
    }

    // ---------- 2. Alcance por empresa ----------

    [Fact]
    public async Task Empresa_Ve_Solo_Ordenes_De_Sus_Empresas_Activas_Mas_Las_Propias()
    {
        using var arnes = new Arnes();
        arnes.OtorgarPermiso(20, Permissions.OrdenesCompra.VerPorEmpresa);

        arnes.SembrarAlcanceEmpresa(20, empresa: 1, activo: true);
        arnes.SembrarAlcanceEmpresa(20, empresa: 2, activo: false);

        arnes.SembrarOrden(2001, creador: 98, empresa: 1, workflow: 19, paso: 10, estado: 5);
        arnes.SembrarOrden(2002, creador: 98, empresa: 2, workflow: 19, paso: 10, estado: 5);
        arnes.SembrarOrden(2003, creador: 20, empresa: 9, workflow: 6, paso: 1, estado: 1);
        arnes.SembrarOrden(2004, creador: 20, empresa: 2, workflow: 6, paso: 1, estado: 1);

        var alcance = await arnes.Servicio.ResolverAsync(20);

        alcance.Empresas.Should().BeEquivalentTo(new[] { 1 }); // la fila inactiva no cuenta
        arnes.Visibles(alcance).Should().BeEquivalentTo(new[] { 2001, 2003, 2004 });
    }

    [Fact]
    public async Task Empresa_Sin_Permiso_No_Amplia_Aunque_Tenga_Filas_Asignadas()
    {
        using var arnes = new Arnes();
        arnes.OtorgarPermiso(21); // sin permisos de alcance

        arnes.SembrarAlcanceEmpresa(21, empresa: 1, activo: true);
        arnes.SembrarOrden(2101, creador: 98, empresa: 1, workflow: 19, paso: 10, estado: 5);

        var alcance = await arnes.Servicio.ResolverAsync(21);

        alcance.Empresas.Should().BeEmpty();
        arnes.Visibles(alcance).Should().BeEmpty();
    }

    // ---------- 3. Alcance por flujo ----------

    [Fact]
    public async Task Flujo_Ve_Todas_Las_Ordenes_De_Los_Flujos_Donde_Participa_O_Esta_Mapeado()
    {
        using var arnes = new Arnes();
        arnes.OtorgarPermiso(74, Permissions.OrdenesCompra.VerPorFlujo);

        // Mapeado a su propio workflow (6) y participante en el de Emmanuel (19).
        arnes.SembrarWorkflow(6, "Workflow Asokam Victor", CodigoProceso.ORDEN_COMPRA);
        arnes.SembrarWorkflow(19, "Workflow Emmanuel", CodigoProceso.ORDEN_COMPRA);
        arnes.SembrarWorkflow(100, "Workflow Viáticos", CodigoProceso.SOLICITUD_PERSONAL);

        arnes.SembrarScopeType(1, "usuario");   // en minúsculas: la comparación debe ser case-insensitive
        arnes.SembrarScopeType(2, "empresa");
        arnes.SembrarMapping(codigoProceso: CodigoProceso.ORDEN_COMPRA, idScopeType: 1, scopeId: 74, idWorkflow: 6);

        arnes.SembrarPaso(10, idWorkflow: 19, orden: 10, activo: true);
        arnes.SembrarPaso(11, idWorkflow: 6, orden: 10, activo: true);
        arnes.SembrarParticipante(10, idUsuario: 74);

        // Del flujo 19: una en el paso donde participa y otra ya avanzada a otro paso.
        arnes.SembrarOrden(3001, creador: 98, empresa: 3, workflow: 19, paso: 10, estado: 5);
        arnes.SembrarOrden(3002, creador: 98, empresa: 3, workflow: 19, paso: 20, estado: 5);
        // De otro proceso: no debe verse por este permiso.
        arnes.SembrarOrden(3003, creador: 98, empresa: 3, workflow: 100, paso: 1, estado: 5);
        // Del flujo mapeado a su usuario: visible aunque no sea participante del paso.
        arnes.SembrarOrden(3004, creador: 98, empresa: 3, workflow: 6, paso: 11, estado: 5);

        var alcance = await arnes.Servicio.ResolverAsync(74);

        alcance.Workflows.Should().BeEquivalentTo(new[] { 6, 19 });
        arnes.Visibles(alcance).Should().BeEquivalentTo(new[] { 3001, 3002, 3004 });
    }

    [Fact]
    public async Task Flujo_Por_Rol_Cuenta_Solo_Si_El_Rol_Esta_Vigente()
    {
        using var arnes = new Arnes();
        arnes.OtorgarPermiso(75, Permissions.OrdenesCompra.VerPorFlujo);
        arnes.OtorgarPermiso(76, Permissions.OrdenesCompra.VerPorFlujo);

        arnes.SembrarWorkflow(19, "Workflow Emmanuel", CodigoProceso.ORDEN_COMPRA);
        arnes.SembrarPaso(10, idWorkflow: 19, orden: 10, activo: true);
        arnes.SembrarParticipante(10, idRol: 3);

        arnes.SembrarRol(3, "Aprobador", activo: true);
        arnes.SembrarRol(4, "Aprobador temporal", activo: true);
        arnes.SembrarUsuarioRol(75, idRol: 3, fechaExpiracion: null);
        arnes.SembrarUsuarioRol(76, idRol: 4, fechaExpiracion: DateTime.UtcNow.AddDays(-1)); // expirado

        arnes.SembrarOrden(3101, creador: 98, empresa: 3, workflow: 19, paso: 20, estado: 5);

        var alcanceVigente = await arnes.Servicio.ResolverAsync(75);
        alcanceVigente.Workflows.Should().BeEquivalentTo(new[] { 19 });
        arnes.Visibles(alcanceVigente).Should().BeEquivalentTo(new[] { 3101 });

        var alcanceExpirado = await arnes.Servicio.ResolverAsync(76);
        alcanceExpirado.Workflows.Should().BeEmpty();
        arnes.Visibles(alcanceExpirado).Should().BeEmpty();
    }

    // ---------- 4. Alcance base ----------

    [Fact]
    public async Task Base_Conserva_Propias_Y_Paso_Actual_Pero_No_Estados_Creada_Rechazada_Cancelada()
    {
        using var arnes = new Arnes();
        arnes.OtorgarPermiso(30); // sin alcances amplios

        arnes.SembrarPaso(5, idWorkflow: 19, orden: 5, activo: true);
        arnes.SembrarPaso(6, idWorkflow: 19, orden: 6, activo: true);
        arnes.SembrarParticipante(5, idUsuario: 30);

        arnes.SembrarOrden(4001, creador: 30, empresa: 9, workflow: 6, paso: 1, estado: 1);   // propia
        arnes.SembrarOrden(4002, creador: 98, empresa: 3, workflow: 19, paso: 5, estado: 5);  // participa
        arnes.SembrarOrden(4003, creador: 98, empresa: 3, workflow: 19, paso: 5, estado: 1);  // participa pero Creada
        arnes.SembrarOrden(4004, creador: 98, empresa: 3, workflow: 19, paso: 6, estado: 5);  // otro paso
        arnes.SembrarOrden(4005, creador: 98, empresa: 3, workflow: 19, paso: 5, estado: 7);  // participa pero Rechazada

        var alcance = await arnes.Servicio.ResolverAsync(30);

        alcance.PasosParticipante.Should().BeEquivalentTo(new[] { 5 });
        arnes.Visibles(alcance).Should().BeEquivalentTo(new[] { 4001, 4002 });
    }

    [Fact]
    public async Task Sin_Permisos_No_Amplia_Empresas_Ni_Flujos()
    {
        using var arnes = new Arnes();
        arnes.OtorgarPermiso(31);

        // Datos que solo aplicarían con permiso: empresa asignada y mapping de usuario.
        arnes.SembrarAlcanceEmpresa(31, empresa: 1, activo: true);
        arnes.SembrarWorkflow(6, "Workflow mapeado", CodigoProceso.ORDEN_COMPRA);
        arnes.SembrarScopeType(1, "USUARIO");
        arnes.SembrarMapping(codigoProceso: CodigoProceso.ORDEN_COMPRA, idScopeType: 1, scopeId: 31, idWorkflow: 6);
        arnes.SembrarOrden(4101, creador: 98, empresa: 1, workflow: 6, paso: 1, estado: 5);

        var alcance = await arnes.Servicio.ResolverAsync(31);

        alcance.Empresas.Should().BeEmpty();
        alcance.Workflows.Should().BeEmpty();
        arnes.Visibles(alcance).Should().BeEmpty();
    }

    // ---------- 5. Jefe inmediato ----------

    [Fact]
    public async Task Jefe_Inmediato_Ve_Las_Ordenes_Detenidas_En_Un_Paso_Que_Lo_Requiere()
    {
        using var arnes = new Arnes();
        arnes.OtorgarPermiso(40);
        arnes.OtorgarPermiso(41);

        arnes.SembrarPaso(50, idWorkflow: 9, orden: 50, activo: true);
        arnes.SembrarParticipante(50, idUsuario: 999, requiereJefeInmediato: true, nivelJefe: 1);

        arnes.SembrarOrden(5001, creador: 98, empresa: 3, workflow: 9, paso: 50, estado: 5);
        arnes.SembrarOrden(5002, creador: 99, empresa: 3, workflow: 9, paso: 50, estado: 5);

        arnes.JefeResolver
            .Setup(r => r.ResolverJefeEfectivoAsync(9, 98, 1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new JefeEfectivoResult(40));
        arnes.JefeResolver
            .Setup(r => r.ResolverJefeEfectivoAsync(9, 99, 1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new JefeEfectivoResult(77));

        var alcanceJefe = await arnes.Servicio.ResolverAsync(40);
        alcanceJefe.NivelPorPaso.Should().ContainKey(50).WhoseValue.Should().Be(1);
        alcanceJefe.CreadoresPosibles.Should().BeEquivalentTo(new[] { 98 });
        arnes.Visibles(alcanceJefe).Should().BeEquivalentTo(new[] { 5001 });
        (await arnes.Servicio.PuedeVerAsync(5001, 40)).Should().BeTrue();
        (await arnes.Servicio.PuedeVerAsync(5002, 40)).Should().BeFalse();

        // Otro usuario no es jefe efectivo de ningún creador de esas órdenes.
        var alcanceOtro = await arnes.Servicio.ResolverAsync(41);
        alcanceOtro.CreadoresPosibles.Should().BeEmpty();
        arnes.Visibles(alcanceOtro).Should().BeEmpty();
    }

    // ---------- 6. PuedeVerAsync ----------

    [Fact]
    public async Task PuedeVer_Devuelve_True_Dentro_Del_Alcance_Y_False_Fuera_O_Si_No_Existe()
    {
        using var arnes = new Arnes();
        arnes.OtorgarPermiso(30);

        arnes.SembrarPaso(5, idWorkflow: 19, orden: 5, activo: true);
        arnes.SembrarParticipante(5, idUsuario: 30);
        arnes.SembrarOrden(6001, creador: 30, empresa: 9, workflow: 6, paso: 1, estado: 1);
        arnes.SembrarOrden(6002, creador: 98, empresa: 3, workflow: 19, paso: 5, estado: 5);
        arnes.SembrarOrden(6003, creador: 98, empresa: 3, workflow: 19, paso: 6, estado: 5);

        (await arnes.Servicio.PuedeVerAsync(6001, 30)).Should().BeTrue();  // propia
        (await arnes.Servicio.PuedeVerAsync(6002, 30)).Should().BeTrue();  // participa en el paso
        (await arnes.Servicio.PuedeVerAsync(6003, 30)).Should().BeFalse(); // fuera del alcance
        (await arnes.Servicio.PuedeVerAsync(9999, 30)).Should().BeFalse(); // no existe
        (await arnes.Servicio.PuedeVerAsync(6003, 0)).Should().BeFalse();  // usuario inválido
    }

    [Fact]
    public async Task Alcance_Se_Traduce_A_Sql_Server_Sin_Error()
    {
        using var arnes = new Arnes();
        arnes.OtorgarPermiso(60, Permissions.OrdenesCompra.VerPorEmpresa, Permissions.OrdenesCompra.VerPorFlujo);
        arnes.SembrarAlcanceEmpresa(60, empresa: 7, activo: true);
        arnes.SembrarWorkflow(19, "Workflow Emmanuel", CodigoProceso.ORDEN_COMPRA);
        arnes.SembrarPaso(10, idWorkflow: 19, orden: 10, activo: true);
        arnes.SembrarParticipante(10, idUsuario: 60);

        var alcance = await arnes.Servicio.ResolverAsync(60);

        // El proveedor InMemory no traduce a SQL; se compila contra SQL Server (sin abrir conexión)
        // para detectar errores de traducción del predicado compuesto.
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer("Server=(localdb)\\MSSQLLocalDB;Database=LefarmaVisibilidad;Trusted_Connection=True;TrustServerCertificate=True")
            .Options;
        using var sqlContext = new ApplicationDbContext(options);

        var sql = arnes.Servicio.Aplicar(sqlContext.OrdenesCompra.AsQueryable(), alcance).ToQueryString();

        sql.Should().Contain("id_usuario_creador");
        sql.Should().Contain("id_empresa");
        sql.Should().Contain("id_workflow");
        sql.Should().Contain("id_paso_actual");
    }

    // =====================================================================
    // Arnés
    // =====================================================================

    private sealed class Arnes : IDisposable
    {
        private readonly MemoryCache _cache;

        public ApplicationDbContext App { get; }
        public AsokamDbContext Asokam { get; }
        public Mock<IJefeInmediatoResolver> JefeResolver { get; } = new();
        public OrdenCompraVisibilidadService Servicio { get; }

        public Arnes()
        {
            App = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase($"oc-visibilidad-{Guid.NewGuid()}")
                .Options);

            Asokam = new AsokamDbContext(new DbContextOptionsBuilder<AsokamDbContext>()
                .UseInMemoryDatabase($"oc-visibilidad-asokam-{Guid.NewGuid()}")
                .Options);

            // Los permisos viven en app.Permisos/app.UsuariosPermisos; aquí se siembra la caché
            // compartida de UserPermissionService (misma llave y duración que en producción) para
            // aislar la matriz de visibilidad del proveedor InMemory.
            _cache = new MemoryCache(new MemoryCacheOptions());
            var permisos = new UserPermissionService(Asokam, _cache);
            Servicio = new OrdenCompraVisibilidadService(App, Asokam, permisos, JefeResolver.Object);
        }

        public void OtorgarPermiso(int idUsuario, params string[] codigos)
        {
            _cache.Set(
                $"user_permissions_{idUsuario}",
                new HashSet<string>(codigos, StringComparer.Ordinal),
                UserPermissionService.CacheDuration);
        }

        public List<int> Visibles(AlcanceOrdenCompra alcance)
            => Servicio.Aplicar(App.OrdenesCompra.AsQueryable(), alcance)
                .Select(o => o.IdOrden)
                .OrderBy(id => id)
                .ToList();

        public void SembrarOrden(int id, int creador, int empresa, int workflow, int? paso, int estado)
        {
            App.OrdenesCompra.Add(new OrdenCompra
            {
                IdOrden = id,
                Folio = $"OC-VIS-{id}",
                IdEmpresa = empresa,
                IdSucursal = 1,
                IdArea = 1,
                IdTipoGasto = 1,
                IdUsuarioCreador = creador,
                IdWorkflow = workflow,
                IdPasoActual = paso,
                IdEstado = estado,
                FechaLimitePago = DateTime.UtcNow.AddDays(1),
                FechaCreacion = DateTime.UtcNow,
            });
            App.SaveChanges();
        }

        public void SembrarAlcanceEmpresa(int idUsuario, int empresa, bool activo)
        {
            App.UsuariosAlcanceEmpresa.Add(new UsuarioAlcanceEmpresa
            {
                IdUsuario = idUsuario,
                IdEmpresa = empresa,
                Activo = activo,
                FechaCreacion = DateTime.UtcNow,
            });
            App.SaveChanges();
        }

        public void SembrarWorkflow(int id, string nombre, string codigoProceso, bool activo = true)
        {
            App.Workflows.Add(new Workflow
            {
                IdWorkflow = id,
                Nombre = nombre,
                CodigoProceso = codigoProceso,
                Activo = activo,
                FechaCreacion = DateTime.UtcNow,
            });
            App.SaveChanges();
        }

        public void SembrarPaso(int id, int idWorkflow, int orden, bool activo)
        {
            App.WorkflowPasos.Add(new WorkflowPaso
            {
                IdPaso = id,
                IdWorkflow = idWorkflow,
                Orden = orden,
                NombrePaso = $"Paso {id}",
                Activo = activo,
            });
            App.SaveChanges();
        }

        public void SembrarParticipante(
            int idPaso, int? idUsuario = null, int? idRol = null,
            bool requiereJefeInmediato = false, int? nivelJefe = null)
        {
            App.WorkflowParticipantes.Add(new WorkflowParticipante
            {
                IdPaso = idPaso,
                IdUsuario = idUsuario,
                IdRol = idRol,
                RequiereJefeInmediato = requiereJefeInmediato,
                NivelJefe = nivelJefe,
                Activo = true,
            });
            App.SaveChanges();
        }

        public void SembrarScopeType(int id, string codigo)
        {
            App.WorkflowScopeTypes.Add(new WorkflowScopeType
            {
                IdScopeType = id,
                Codigo = codigo,
                Nombre = codigo,
                NivelPrioridad = 1,
                Activo = true,
                FechaCreacion = DateTime.UtcNow,
            });
            App.SaveChanges();
        }

        public void SembrarMapping(string codigoProceso, int idScopeType, int scopeId, int idWorkflow)
        {
            App.WorkflowMappings.Add(new WorkflowMapping
            {
                CodigoProceso = codigoProceso,
                IdScopeType = idScopeType,
                ScopeId = scopeId,
                IdWorkflow = idWorkflow,
                Activo = true,
                FechaCreacion = DateTime.UtcNow,
            });
            App.SaveChanges();
        }

        public void SembrarRol(int id, string nombre, bool activo)
        {
            Asokam.Roles.Add(new Rol
            {
                IdRol = id,
                NombreRol = nombre,
                EsActivo = activo,
                FechaCreacion = DateTime.UtcNow,
            });
            Asokam.SaveChanges();
        }

        public void SembrarUsuarioRol(int idUsuario, int idRol, DateTime? fechaExpiracion)
        {
            Asokam.UsuariosRoles.Add(new UsuarioRol
            {
                IdUsuario = idUsuario,
                IdRol = idRol,
                FechaExpiracion = fechaExpiracion,
            });
            Asokam.SaveChanges();
        }

        public void Dispose()
        {
            App.Dispose();
            Asokam.Dispose();
            _cache.Dispose();
        }
    }
}
