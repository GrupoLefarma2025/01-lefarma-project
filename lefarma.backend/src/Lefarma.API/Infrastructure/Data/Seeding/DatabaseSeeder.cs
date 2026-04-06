using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Seeding;
public class DatabaseSeeder : IDatabaseSeeder
{
    private readonly AsokamDbContext _context;
    private readonly ILogger<DatabaseSeeder> _logger;

    public DatabaseSeeder(AsokamDbContext context, ILogger<DatabaseSeeder> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task SeedAsync()
    {
        _logger.LogInformation("Starting database seeding...");

        await SeedRolesAsync();
        await SeedPermissionsAsync();
        await SeedRolePermissionsAsync();
        await SeedWorkflowAsync();

        _logger.LogInformation("Database seeding completed successfully.");
    }

    private async Task SeedRolesAsync()
    {
        if (await _context.Roles.AnyAsync())
        {
            _logger.LogInformation("Roles already seeded. Skipping...");
            return;
        }

        _logger.LogInformation("Seeding roles...");

        var roles = new List<Rol>
        {
            new()
            {
                IdRol = 1,
                NombreRol = AuthorizationConstants.Roles.Capturista,
                Descripcion = AuthorizationConstants.RoleDescriptions.Capturista,
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdRol = 2,
                NombreRol = AuthorizationConstants.Roles.GerenteArea,
                Descripcion = AuthorizationConstants.RoleDescriptions.GerenteArea,
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdRol = 3,
                NombreRol = AuthorizationConstants.Roles.CxP,
                Descripcion = AuthorizationConstants.RoleDescriptions.CxP,
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdRol = 4,
                NombreRol = AuthorizationConstants.Roles.GerenteAdmon,
                Descripcion = AuthorizationConstants.RoleDescriptions.GerenteAdmon,
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdRol = 5,
                NombreRol = AuthorizationConstants.Roles.DireccionCorp,
                Descripcion = AuthorizationConstants.RoleDescriptions.DireccionCorp,
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdRol = 6,
                NombreRol = AuthorizationConstants.Roles.Tesoreria,
                Descripcion = AuthorizationConstants.RoleDescriptions.Tesoreria,
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdRol = 7,
                NombreRol = AuthorizationConstants.Roles.AuxiliarPagos,
                Descripcion = AuthorizationConstants.RoleDescriptions.AuxiliarPagos,
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdRol = 8,
                NombreRol = AuthorizationConstants.Roles.Administrador,
                Descripcion = AuthorizationConstants.RoleDescriptions.Administrador,
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            }
        };

        await _context.Roles.AddRangeAsync(roles);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Seeded {Count} roles successfully.", roles.Count);
    }

    private async Task SeedPermissionsAsync()
    {
        if (await _context.Permisos.AnyAsync())
        {
            _logger.LogInformation("Permissions already seeded. Skipping...");
            return;
        }

        _logger.LogInformation("Seeding permissions...");

        var permisos = new List<Permiso>
        {
            new()
            {
                IdPermiso = 1,
                CodigoPermiso = Permissions.Catalogos.View,
                NombrePermiso = "Ver Catalogos",
                Descripcion = "Permite visualizar catalogos del sistema",
                Categoria = "Catalogos",
                Recurso = "Catalogos",
                Accion = "View",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 2,
                CodigoPermiso = Permissions.Catalogos.Manage,
                NombrePermiso = "Gestionar Catalogos",
                Descripcion = "Permite crear, editar y eliminar catalogos",
                Categoria = "Catalogos",
                Recurso = "Catalogos",
                Accion = "Manage",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 3,
                CodigoPermiso = Permissions.OrdenesCompra.View,
                NombrePermiso = "Ver Ordenes de Compra",
                Descripcion = "Permite visualizar ordenes de compra",
                Categoria = "OrdenesCompra",
                Recurso = "OrdenesCompra",
                Accion = "View",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 4,
                CodigoPermiso = Permissions.OrdenesCompra.Create,
                NombrePermiso = "Crear Ordenes de Compra",
                Descripcion = "Permite crear nuevas ordenes de compra",
                Categoria = "OrdenesCompra",
                Recurso = "OrdenesCompra",
                Accion = "Create",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 5,
                CodigoPermiso = Permissions.OrdenesCompra.Edit,
                NombrePermiso = "Editar Ordenes de Compra",
                Descripcion = "Permite editar ordenes de compra existentes",
                Categoria = "OrdenesCompra",
                Recurso = "OrdenesCompra",
                Accion = "Edit",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 6,
                CodigoPermiso = Permissions.OrdenesCompra.Delete,
                NombrePermiso = "Eliminar Ordenes de Compra",
                Descripcion = "Permite eliminar ordenes de compra",
                Categoria = "OrdenesCompra",
                Recurso = "OrdenesCompra",
                Accion = "Delete",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 7,
                CodigoPermiso = Permissions.OrdenesCompra.Approve,
                NombrePermiso = "Aprobar Ordenes de Compra",
                Descripcion = "Permite aprobar ordenes de compra",
                Categoria = "OrdenesCompra",
                Recurso = "OrdenesCompra",
                Accion = "Approve",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 8,
                CodigoPermiso = Permissions.Usuarios.View,
                NombrePermiso = "Ver Usuarios",
                Descripcion = "Permite visualizar usuarios del sistema",
                Categoria = "Usuarios",
                Recurso = "Usuarios",
                Accion = "View",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 9,
                CodigoPermiso = Permissions.Usuarios.Manage,
                NombrePermiso = "Gestionar Usuarios",
                Descripcion = "Permite gestionar usuarios y sus roles",
                Categoria = "Usuarios",
                Recurso = "Usuarios",
                Accion = "Manage",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 10,
                CodigoPermiso = Permissions.Usuarios.AssignRoles,
                NombrePermiso = "Asignar Roles a Usuarios",
                Descripcion = "Permite asignar roles a usuarios",
                Categoria = "Usuarios",
                Recurso = "Usuarios",
                Accion = "AssignRoles",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 11,
                CodigoPermiso = Permissions.Reportes.View,
                NombrePermiso = "Ver Reportes",
                Descripcion = "Permite visualizar reportes del sistema",
                Categoria = "Reportes",
                Recurso = "Reportes",
                Accion = "View",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 12,
                CodigoPermiso = Permissions.Reportes.Export,
                NombrePermiso = "Exportar Reportes",
                Descripcion = "Permite exportar reportes",
                Categoria = "Reportes",
                Recurso = "Reportes",
                Accion = "Export",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 13,
                CodigoPermiso = Permissions.Tesoreria.View,
                NombrePermiso = "Ver Tesoreria",
                Descripcion = "Permite visualizar modulo de tesoreria",
                Categoria = "Tesoreria",
                Recurso = "Tesoreria",
                Accion = "View",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 14,
                CodigoPermiso = Permissions.Tesoreria.Pay,
                NombrePermiso = "Realizar Pagos",
                Descripcion = "Permite registrar pagos en tesoreria",
                Categoria = "Tesoreria",
                Recurso = "Tesoreria",
                Accion = "Pay",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 15,
                CodigoPermiso = Permissions.Tesoreria.Export,
                NombrePermiso = "Exportar Tesoreria",
                Descripcion = "Permite exportar datos de tesoreria",
                Categoria = "Tesoreria",
                Recurso = "Tesoreria",
                Accion = "Export",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 16,
                CodigoPermiso = Permissions.Comprobaciones.View,
                NombrePermiso = "Ver Comprobaciones",
                Descripcion = "Permite visualizar comprobaciones de gastos",
                Categoria = "Comprobaciones",
                Recurso = "Comprobaciones",
                Accion = "View",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 17,
                CodigoPermiso = Permissions.Comprobaciones.Create,
                NombrePermiso = "Crear Comprobaciones",
                Descripcion = "Permite crear comprobaciones de gastos",
                Categoria = "Comprobaciones",
                Recurso = "Comprobaciones",
                Accion = "Create",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 18,
                CodigoPermiso = Permissions.Comprobaciones.Validate,
                NombrePermiso = "Validar Comprobaciones",
                Descripcion = "Permite validar comprobaciones de gastos",
                Categoria = "Comprobaciones",
                Recurso = "Comprobaciones",
                Accion = "Validate",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 19,
                CodigoPermiso = Permissions.Config.View,
                NombrePermiso = "Ver Configuracion",
                Descripcion = "Permite visualizar configuracion del sistema",
                Categoria = "Config",
                Recurso = "Config",
                Accion = "View",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 20,
                CodigoPermiso = Permissions.Config.Manage,
                NombrePermiso = "Gestionar Configuracion",
                Descripcion = "Permite gestionar configuracion del sistema",
                Categoria = "Config",
                Recurso = "Config",
                Accion = "Manage",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 21,
                CodigoPermiso = Permissions.Workflows.View,
                NombrePermiso = "Ver Workflows",
                Descripcion = "Permite visualizar workflows del sistema",
                Categoria = "Workflows",
                Recurso = "Workflows",
                Accion = "View",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdPermiso = 22,
                CodigoPermiso = Permissions.Workflows.Manage,
                NombrePermiso = "Gestionar Workflows",
                Descripcion = "Permite crear, editar y eliminar workflows",
                Categoria = "Workflows",
                Recurso = "Workflows",
                Accion = "Manage",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            }
        };

        await _context.Permisos.AddRangeAsync(permisos);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Seeded {Count} permissions successfully.", permisos.Count);
    }

    private async Task SeedRolePermissionsAsync()
    {
        if (await _context.RolesPermisos.AnyAsync())
        {
            _logger.LogInformation("Role permissions already seeded. Skipping...");
            return;
        }

        _logger.LogInformation("Seeding role-permission relationships...");

        var rolPermisos = new List<RolPermiso>();
        int nextId = 1;

        AddRolePermissions(rolPermisos, ref nextId, 1, new[] { 1, 3, 4, 13, 16, 19 });
        AddRolePermissions(rolPermisos, ref nextId, 2, new[] { 1, 3, 4, 5, 13, 16, 19 });
        AddRolePermissions(rolPermisos, ref nextId, 3, new[] { 1, 2, 3, 4, 5, 6, 8, 14, 16, 17, 18, 19, 21, 22 });
        AddRolePermissions(rolPermisos, ref nextId, 4, new[] { 1, 2, 3, 4, 5, 6, 7, 8, 14, 16, 17, 18, 19, 20, 21, 22 });
        AddRolePermissions(rolPermisos, ref nextId, 5, new[] { 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 14, 16, 17, 18, 19, 20, 21, 22 });
        AddRolePermissions(rolPermisos, ref nextId, 6, new[] { 1, 3, 11, 13, 14, 15, 16 });
        AddRolePermissions(rolPermisos, ref nextId, 7, new[] { 1, 3, 11, 13, 16 });
        AddRolePermissions(rolPermisos, ref nextId, 8, new[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22 });

        await _context.RolesPermisos.AddRangeAsync(rolPermisos);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Seeded {Count} role-permission relationships successfully.", rolPermisos.Count);
    }

    private static void AddRolePermissions(List<RolPermiso> list, ref int nextId, int idRol, int[] idPermisos)
    {
        foreach (var idPermiso in idPermisos)
        {
            list.Add(new RolPermiso
            {
                IdRolPermiso = nextId++,
                IdRol = idRol,
                IdPermiso = idPermiso,
                FechaAsignacion = DateTime.UtcNow
            });
        }
    }

    private async Task SeedWorkflowAsync()
    {
        if (await _context.Set<Workflow>().AnyAsync(w => w.CodigoProceso == "ORDEN_COMPRA"))
        {
            _logger.LogInformation("Workflow ORDEN_COMPRA already seeded. Skipping...");
            return;
        }

        _logger.LogInformation("Seeding workflow ORDEN_COMPRA...");

        var workflow = new Workflow
        {
            Nombre = "Orden de Compra",
            Descripcion = "Workflow para el proceso de autorización de órdenes de compra",
            CodigoProceso = "ORDEN_COMPRA",
            Version = 1,
            Activo = true,
            FechaCreacion = DateTime.UtcNow,
            Pasos = new List<WorkflowPaso>
            {
                new()
                {
                    Orden = 1,
                    NombrePaso = "Captura de OC",
                    CodigoEstado = "Creada",
                    HandlerKey = null,
                    EsInicio = true,
                    EsFinal = false,
                    RequiereFirma = false,
                    RequiereComentario = false,
                    RequiereAdjunto = false
                },
                new()
                {
                    Orden = 2,
                    NombrePaso = "Firma Gerente de Área",
                    CodigoEstado = "EnFirma1",
                    HandlerKey = null,
                    EsInicio = false,
                    EsFinal = false,
                    RequiereFirma = true,
                    RequiereComentario = false,
                    RequiereAdjunto = false
                },
                new()
                {
                    Orden = 3,
                    NombrePaso = "Revisión CxP",
                    CodigoEstado = "EnFirma3",
                    HandlerKey = "Firma3Handler",
                    EsInicio = false,
                    EsFinal = false,
                    RequiereFirma = true,
                    RequiereComentario = false,
                    RequiereAdjunto = false
                },
                new()
                {
                    Orden = 4,
                    NombrePaso = "Firma GAF",
                    CodigoEstado = "EnFirma4",
                    HandlerKey = "Firma4Handler",
                    EsInicio = false,
                    EsFinal = false,
                    RequiereFirma = true,
                    RequiereComentario = false,
                    RequiereAdjunto = false
                },
                new()
                {
                    Orden = 5,
                    NombrePaso = "Firma Dirección Corporativa",
                    CodigoEstado = "EnFirma5",
                    HandlerKey = "Firma5Handler",
                    EsInicio = false,
                    EsFinal = false,
                    RequiereFirma = true,
                    RequiereComentario = false,
                    RequiereAdjunto = false
                },
                new()
                {
                    Orden = 6,
                    NombrePaso = "Tesorería",
                    CodigoEstado = "EnTesoreria",
                    HandlerKey = null,
                    EsInicio = false,
                    EsFinal = false,
                    RequiereFirma = false,
                    RequiereComentario = false,
                    RequiereAdjunto = false
                },
                new()
                {
                    Orden = 7,
                    NombrePaso = "Comprobación",
                    CodigoEstado = "EnComprobacion",
                    HandlerKey = "ComprobacionHandler",
                    EsInicio = false,
                    EsFinal = false,
                    RequiereFirma = false,
                    RequiereComentario = true,
                    RequiereAdjunto = true
                },
                new()
                {
                    Orden = 8,
                    NombrePaso = "Cierre",
                    CodigoEstado = "Cerrada",
                    HandlerKey = null,
                    EsInicio = false,
                    EsFinal = true,
                    RequiereFirma = false,
                    RequiereComentario = false,
                    RequiereAdjunto = false
                }
            }
        };

        await _context.Set<Workflow>().AddAsync(workflow);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Seeded workflow ORDEN_COMPRA with {Count} steps successfully.", workflow.Pasos.Count);
    }
}
