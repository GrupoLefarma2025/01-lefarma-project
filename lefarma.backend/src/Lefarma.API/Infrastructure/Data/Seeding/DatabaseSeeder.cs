using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Seeding;

public class DatabaseSeeder : IDatabaseSeeder
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<DatabaseSeeder> _logger;

    public DatabaseSeeder(ApplicationDbContext context, ILogger<DatabaseSeeder> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Starting database seeding...");

        await SeedRolesAsync(cancellationToken);
        await SeedPermisosAsync(cancellationToken);
        await SeedRolPermisosAsync(cancellationToken);
        await SeedEmpresasAsync(cancellationToken);
        await SeedAreasAsync(cancellationToken);
        await SeedTiposGastoAsync(cancellationToken);
        await SeedTiposMedidaAsync(cancellationToken);
        await SeedUnidadesMedidaAsync(cancellationToken);

        _logger.LogInformation("Database seeding completed successfully");
    }

    private async Task SeedRolesAsync(CancellationToken cancellationToken)
    {
        if (await _context.Roles.AnyAsync(cancellationToken))
        {
            _logger.LogInformation("Roles already seeded, skipping...");
            return;
        }

        _logger.LogInformation("Seeding roles...");

        var roles = new List<Rol>
        {
            new()
            {
                IdRol = 1,
                NombreRol = "Capturista",
                Descripcion = "Crea ordenes de compra y solicitudes",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdRol = 2,
                NombreRol = "Gerente de Area",
                Descripcion = "Firma 2 - Autorizacion de ordenes de compra por area",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdRol = 3,
                NombreRol = "CxP",
                Descripcion = "Firma 3 - Cuentas por pagar (Polo) - Verificacion y asignacion de cuentas",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdRol = 4,
                NombreRol = "Gerente Admon/Finanzas",
                Descripcion = "Firma 4 - Gerente de Administracion y Finanzas - Autorizacion y reportes",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdRol = 5,
                NombreRol = "Direccion Corporativa",
                Descripcion = "Firma 5 - Direccion Corporativa - Autorizacion final y reportes ejecutivos",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdRol = 6,
                NombreRol = "Tesoreria",
                Descripcion = "Realiza pagos autorizados y gestiona flujo de caja",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdRol = 7,
                NombreRol = "Auxiliar de Pagos",
                Descripcion = "Apoyo en conciliaciones y registro de pagos",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdRol = 8,
                NombreRol = "Administrador",
                Descripcion = "Gestion completa de catalogos, usuarios y configuracion del sistema",
                EsActivo = true,
                EsSistema = true,
                FechaCreacion = DateTime.UtcNow
            }
        };

        await _context.Roles.AddRangeAsync(roles, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Seeded {Count} roles", roles.Count);
    }

    private async Task SeedPermisosAsync(CancellationToken cancellationToken)
    {
        if (await _context.Permisos.AnyAsync(cancellationToken))
        {
            _logger.LogInformation("Permisos already seeded, skipping...");
            return;
        }

        _logger.LogInformation("Seeding permisos...");

        var permisos = new List<Permiso>
        {
            // Ordenes de Compra
            new() { IdPermiso = 1, CodigoPermiso = "OC.CREAR", NombrePermiso = "Crear Orden de Compra", Descripcion = "Crear nuevas ordenes de compra", Categoria = "OrdenesCompra", Recurso = "OrdenCompra", Accion = "Crear", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 2, CodigoPermiso = "OC.EDITAR", NombrePermiso = "Editar Orden de Compra", Descripcion = "Editar ordenes de compra existentes", Categoria = "OrdenesCompra", Recurso = "OrdenCompra", Accion = "Editar", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 3, CodigoPermiso = "OC.VER", NombrePermiso = "Ver Orden de Compra", Descripcion = "Visualizar ordenes de compra", Categoria = "OrdenesCompra", Recurso = "OrdenCompra", Accion = "Ver", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 4, CodigoPermiso = "OC.VER_TODAS", NombrePermiso = "Ver Todas las Ordenes", Descripcion = "Visualizar todas las ordenes de compra del sistema", Categoria = "OrdenesCompra", Recurso = "OrdenCompra", Accion = "VerTodas", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 5, CodigoPermiso = "OC.AUTORIZAR_F2", NombrePermiso = "Autorizar Firma 2", Descripcion = "Autorizar ordenes con firma 2 (Gerente de Area)", Categoria = "OrdenesCompra", Recurso = "OrdenCompra", Accion = "AutorizarFirma2", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 6, CodigoPermiso = "OC.AUTORIZAR_F3", NombrePermiso = "Autorizar Firma 3", Descripcion = "Autorizar ordenes con firma 3 (CxP)", Categoria = "OrdenesCompra", Recurso = "OrdenCompra", Accion = "AutorizarFirma3", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 7, CodigoPermiso = "OC.AUTORIZAR_F4", NombrePermiso = "Autorizar Firma 4", Descripcion = "Autorizar ordenes con firma 4 (Gerente Admon/Finanzas)", Categoria = "OrdenesCompra", Recurso = "OrdenCompra", Accion = "AutorizarFirma4", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 8, CodigoPermiso = "OC.AUTORIZAR_F5", NombrePermiso = "Autorizar Firma 5", Descripcion = "Autorizar ordenes con firma 5 (Direccion Corporativa)", Categoria = "OrdenesCompra", Recurso = "OrdenCompra", Accion = "AutorizarFirma5", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 9, CodigoPermiso = "OC.CANCELAR", NombrePermiso = "Cancelar Orden de Compra", Descripcion = "Cancelar ordenes de compra", Categoria = "OrdenesCompra", Recurso = "OrdenCompra", Accion = "Cancelar", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },

            // Cuentas por Pagar
            new() { IdPermiso = 10, CodigoPermiso = "CXP.ASIGNAR_CUENTA", NombrePermiso = "Asignar Cuenta", Descripcion = "Asignar cuenta contable a ordenes", Categoria = "CuentasPorPagar", Recurso = "CuentaPorPagar", Accion = "AsignarCuenta", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 11, CodigoPermiso = "CXP.VER", NombrePermiso = "Ver Cuentas por Pagar", Descripcion = "Visualizar cuentas por pagar", Categoria = "CuentasPorPagar", Recurso = "CuentaPorPagar", Accion = "Ver", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },

            // Pagos
            new() { IdPermiso = 12, CodigoPermiso = "PAGO.REGISTRAR", NombrePermiso = "Registrar Pago", Descripcion = "Registrar pagos realizados", Categoria = "Pagos", Recurso = "Pago", Accion = "Registrar", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 13, CodigoPermiso = "PAGO.VER", NombrePermiso = "Ver Pagos", Descripcion = "Visualizar pagos", Categoria = "Pagos", Recurso = "Pago", Accion = "Ver", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 14, CodigoPermiso = "PAGO.CONCILIAR", NombrePermiso = "Conciliar Pagos", Descripcion = "Realizar conciliacion de pagos", Categoria = "Pagos", Recurso = "Pago", Accion = "Conciliar", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },

            // Reportes
            new() { IdPermiso = 15, CodigoPermiso = "REPORTE.VER", NombrePermiso = "Ver Reportes", Descripcion = "Visualizar reportes estandar", Categoria = "Reportes", Recurso = "Reporte", Accion = "Ver", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 16, CodigoPermiso = "REPORTE.EJECUTIVO", NombrePermiso = "Ver Reportes Ejecutivos", Descripcion = "Visualizar reportes ejecutivos", Categoria = "Reportes", Recurso = "Reporte", Accion = "VerEjecutivo", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 17, CodigoPermiso = "REPORTE.EXPORTAR", NombrePermiso = "Exportar Reportes", Descripcion = "Exportar reportes a diferentes formatos", Categoria = "Reportes", Recurso = "Reporte", Accion = "Exportar", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },

            // Catalogos
            new() { IdPermiso = 18, CodigoPermiso = "CATALOGO.CREAR", NombrePermiso = "Crear Catalogo", Descripcion = "Crear registros en catalogos", Categoria = "Catalogos", Recurso = "Catalogo", Accion = "Crear", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 19, CodigoPermiso = "CATALOGO.EDITAR", NombrePermiso = "Editar Catalogo", Descripcion = "Editar registros en catalogos", Categoria = "Catalogos", Recurso = "Catalogo", Accion = "Editar", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 20, CodigoPermiso = "CATALOGO.ELIMINAR", NombrePermiso = "Eliminar Catalogo", Descripcion = "Eliminar registros de catalogos", Categoria = "Catalogos", Recurso = "Catalogo", Accion = "Eliminar", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 21, CodigoPermiso = "CATALOGO.VER", NombrePermiso = "Ver Catalogo", Descripcion = "Visualizar catalogos", Categoria = "Catalogos", Recurso = "Catalogo", Accion = "Ver", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },

            // Usuarios
            new() { IdPermiso = 22, CodigoPermiso = "USUARIO.CREAR", NombrePermiso = "Crear Usuario", Descripcion = "Crear nuevos usuarios", Categoria = "Usuarios", Recurso = "Usuario", Accion = "Crear", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 23, CodigoPermiso = "USUARIO.EDITAR", NombrePermiso = "Editar Usuario", Descripcion = "Editar usuarios existentes", Categoria = "Usuarios", Recurso = "Usuario", Accion = "Editar", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 24, CodigoPermiso = "USUARIO.ELIMINAR", NombrePermiso = "Eliminar Usuario", Descripcion = "Eliminar usuarios", Categoria = "Usuarios", Recurso = "Usuario", Accion = "Eliminar", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 25, CodigoPermiso = "USUARIO.VER", NombrePermiso = "Ver Usuario", Descripcion = "Visualizar usuarios", Categoria = "Usuarios", Recurso = "Usuario", Accion = "Ver", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 26, CodigoPermiso = "USUARIO.ASIGNAR_ROL", NombrePermiso = "Asignar Rol", Descripcion = "Asignar roles a usuarios", Categoria = "Usuarios", Recurso = "Usuario", Accion = "AsignarRol", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },

            // Configuracion
            new() { IdPermiso = 27, CodigoPermiso = "CONFIG.VER", NombrePermiso = "Ver Configuracion", Descripcion = "Visualizar configuracion del sistema", Categoria = "Configuracion", Recurso = "Configuracion", Accion = "Ver", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow },
            new() { IdPermiso = 28, CodigoPermiso = "CONFIG.EDITAR", NombrePermiso = "Editar Configuracion", Descripcion = "Modificar configuracion del sistema", Categoria = "Configuracion", Recurso = "Configuracion", Accion = "Editar", EsActivo = true, EsSistema = true, FechaCreacion = DateTime.UtcNow }
        };

        await _context.Permisos.AddRangeAsync(permisos, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Seeded {Count} permisos", permisos.Count);
    }

    private async Task SeedRolPermisosAsync(CancellationToken cancellationToken)
    {
        if (await _context.RolesPermisos.AnyAsync(cancellationToken))
        {
            _logger.LogInformation("RolPermisos already seeded, skipping...");
            return;
        }

        _logger.LogInformation("Seeding rol-permiso assignments...");

        var rolPermisos = new List<RolPermiso>
        {
            // Capturista (IdRol = 1): crear, editar (propia), ver (propia)
            new() { IdRol = 1, IdPermiso = 1, FechaAsignacion = DateTime.UtcNow }, // OC.CREAR
            new() { IdRol = 1, IdPermiso = 2, FechaAsignacion = DateTime.UtcNow }, // OC.EDITAR
            new() { IdRol = 1, IdPermiso = 3, FechaAsignacion = DateTime.UtcNow }, // OC.VER
            new() { IdRol = 1, IdPermiso = 15, FechaAsignacion = DateTime.UtcNow }, // REPORTE.VER

            // Gerente de Area (IdRol = 2): ver (area), autorizar firma 2
            new() { IdRol = 2, IdPermiso = 3, FechaAsignacion = DateTime.UtcNow }, // OC.VER
            new() { IdRol = 2, IdPermiso = 5, FechaAsignacion = DateTime.UtcNow }, // OC.AUTORIZAR_F2
            new() { IdRol = 2, IdPermiso = 15, FechaAsignacion = DateTime.UtcNow }, // REPORTE.VER

            // CxP (IdRol = 3): ver (todas), autorizar firma 3, asignar cuentas
            new() { IdRol = 3, IdPermiso = 4, FechaAsignacion = DateTime.UtcNow }, // OC.VER_TODAS
            new() { IdRol = 3, IdPermiso = 6, FechaAsignacion = DateTime.UtcNow }, // OC.AUTORIZAR_F3
            new() { IdRol = 3, IdPermiso = 10, FechaAsignacion = DateTime.UtcNow }, // CXP.ASIGNAR_CUENTA
            new() { IdRol = 3, IdPermiso = 11, FechaAsignacion = DateTime.UtcNow }, // CXP.VER
            new() { IdRol = 3, IdPermiso = 15, FechaAsignacion = DateTime.UtcNow }, // REPORTE.VER

            // Gerente Admon/Finanzas (IdRol = 4): ver (todas), autorizar firma 4, reportes
            new() { IdRol = 4, IdPermiso = 4, FechaAsignacion = DateTime.UtcNow }, // OC.VER_TODAS
            new() { IdRol = 4, IdPermiso = 7, FechaAsignacion = DateTime.UtcNow }, // OC.AUTORIZAR_F4
            new() { IdRol = 4, IdPermiso = 11, FechaAsignacion = DateTime.UtcNow }, // CXP.VER
            new() { IdRol = 4, IdPermiso = 13, FechaAsignacion = DateTime.UtcNow }, // PAGO.VER
            new() { IdRol = 4, IdPermiso = 15, FechaAsignacion = DateTime.UtcNow }, // REPORTE.VER
            new() { IdRol = 4, IdPermiso = 17, FechaAsignacion = DateTime.UtcNow }, // REPORTE.EXPORTAR

            // Direccion Corporativa (IdRol = 5): ver (todas), autorizar firma 5, reportes ejecutivos
            new() { IdRol = 5, IdPermiso = 4, FechaAsignacion = DateTime.UtcNow }, // OC.VER_TODAS
            new() { IdRol = 5, IdPermiso = 8, FechaAsignacion = DateTime.UtcNow }, // OC.AUTORIZAR_F5
            new() { IdRol = 5, IdPermiso = 11, FechaAsignacion = DateTime.UtcNow }, // CXP.VER
            new() { IdRol = 5, IdPermiso = 13, FechaAsignacion = DateTime.UtcNow }, // PAGO.VER
            new() { IdRol = 5, IdPermiso = 15, FechaAsignacion = DateTime.UtcNow }, // REPORTE.VER
            new() { IdRol = 5, IdPermiso = 16, FechaAsignacion = DateTime.UtcNow }, // REPORTE.EJECUTIVO
            new() { IdRol = 5, IdPermiso = 17, FechaAsignacion = DateTime.UtcNow }, // REPORTE.EXPORTAR

            // Tesoreria (IdRol = 6): ver (autorizadas), registrar pagos
            new() { IdRol = 6, IdPermiso = 4, FechaAsignacion = DateTime.UtcNow }, // OC.VER_TODAS (autorizadas)
            new() { IdRol = 6, IdPermiso = 12, FechaAsignacion = DateTime.UtcNow }, // PAGO.REGISTRAR
            new() { IdRol = 6, IdPermiso = 13, FechaAsignacion = DateTime.UtcNow }, // PAGO.VER
            new() { IdRol = 6, IdPermiso = 15, FechaAsignacion = DateTime.UtcNow }, // REPORTE.VER

            // Auxiliar de Pagos (IdRol = 7): ver, conciliar
            new() { IdRol = 7, IdPermiso = 13, FechaAsignacion = DateTime.UtcNow }, // PAGO.VER
            new() { IdRol = 7, IdPermiso = 14, FechaAsignacion = DateTime.UtcNow }, // PAGO.CONCILIAR
            new() { IdRol = 7, IdPermiso = 15, FechaAsignacion = DateTime.UtcNow }, // REPORTE.VER

            // Administrador (IdRol = 8): CRUD catalogos, CRUD usuarios, configuracion
            new() { IdRol = 8, IdPermiso = 1, FechaAsignacion = DateTime.UtcNow }, // OC.CREAR
            new() { IdRol = 8, IdPermiso = 2, FechaAsignacion = DateTime.UtcNow }, // OC.EDITAR
            new() { IdRol = 8, IdPermiso = 3, FechaAsignacion = DateTime.UtcNow }, // OC.VER
            new() { IdRol = 8, IdPermiso = 4, FechaAsignacion = DateTime.UtcNow }, // OC.VER_TODAS
            new() { IdRol = 8, IdPermiso = 9, FechaAsignacion = DateTime.UtcNow }, // OC.CANCELAR
            new() { IdRol = 8, IdPermiso = 18, FechaAsignacion = DateTime.UtcNow }, // CATALOGO.CREAR
            new() { IdRol = 8, IdPermiso = 19, FechaAsignacion = DateTime.UtcNow }, // CATALOGO.EDITAR
            new() { IdRol = 8, IdPermiso = 20, FechaAsignacion = DateTime.UtcNow }, // CATALOGO.ELIMINAR
            new() { IdRol = 8, IdPermiso = 21, FechaAsignacion = DateTime.UtcNow }, // CATALOGO.VER
            new() { IdRol = 8, IdPermiso = 22, FechaAsignacion = DateTime.UtcNow }, // USUARIO.CREAR
            new() { IdRol = 8, IdPermiso = 23, FechaAsignacion = DateTime.UtcNow }, // USUARIO.EDITAR
            new() { IdRol = 8, IdPermiso = 24, FechaAsignacion = DateTime.UtcNow }, // USUARIO.ELIMINAR
            new() { IdRol = 8, IdPermiso = 25, FechaAsignacion = DateTime.UtcNow }, // USUARIO.VER
            new() { IdRol = 8, IdPermiso = 26, FechaAsignacion = DateTime.UtcNow }, // USUARIO.ASIGNAR_ROL
            new() { IdRol = 8, IdPermiso = 27, FechaAsignacion = DateTime.UtcNow }, // CONFIG.VER
            new() { IdRol = 8, IdPermiso = 28, FechaAsignacion = DateTime.UtcNow }, // CONFIG.EDITAR
            new() { IdRol = 8, IdPermiso = 15, FechaAsignacion = DateTime.UtcNow }, // REPORTE.VER
            new() { IdRol = 8, IdPermiso = 17, FechaAsignacion = DateTime.UtcNow }, // REPORTE.EXPORTAR
            new() { IdRol = 8, IdPermiso = 5, FechaAsignacion = DateTime.UtcNow }, // OC.AUTORIZAR_F2
            new() { IdRol = 8, IdPermiso = 6, FechaAsignacion = DateTime.UtcNow }, // OC.AUTORIZAR_F3
            new() { IdRol = 8, IdPermiso = 7, FechaAsignacion = DateTime.UtcNow }, // OC.AUTORIZAR_F4
            new() { IdRol = 8, IdPermiso = 8, FechaAsignacion = DateTime.UtcNow }, // OC.AUTORIZAR_F5
            new() { IdRol = 8, IdPermiso = 10, FechaAsignacion = DateTime.UtcNow }, // CXP.ASIGNAR_CUENTA
            new() { IdRol = 8, IdPermiso = 11, FechaAsignacion = DateTime.UtcNow }, // CXP.VER
            new() { IdRol = 8, IdPermiso = 12, FechaAsignacion = DateTime.UtcNow }, // PAGO.REGISTRAR
            new() { IdRol = 8, IdPermiso = 13, FechaAsignacion = DateTime.UtcNow }, // PAGO.VER
            new() { IdRol = 8, IdPermiso = 14, FechaAsignacion = DateTime.UtcNow }  // PAGO.CONCILIAR
        };

        await _context.RolesPermisos.AddRangeAsync(rolPermisos, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Seeded {Count} rol-permiso assignments", rolPermisos.Count);
    }

    private async Task SeedEmpresasAsync(CancellationToken cancellationToken)
    {
        if (await _context.Empresas.AnyAsync(cancellationToken))
        {
            _logger.LogInformation("Empresas already seeded, skipping...");
            return;
        }

        _logger.LogInformation("Seeding empresas...");

        var empresas = new List<Empresa>
        {
            new()
            {
                IdEmpresa = 1,
                Nombre = "Asokam",
                NombreNormalizado = "asokam",
                Descripcion = "Empresa Asokam - Division especializada",
                DescripcionNormalizada = "empresa asokam - division especializada",
                Clave = "ASK",
                RazonSocial = "Asokam S.A. de C.V.",
                RFC = "ASK123456ABC",
                Direccion = "Av. Principal 123",
                Colonia = "Centro",
                Ciudad = "Ciudad de Mexico",
                Estado = "CDMX",
                CodigoPostal = "06000",
                Telefono = "5555550101",
                Email = "contacto@asokam.com",
                PaginaWeb = "www.asokam.com",
                NumeroEmpleados = 50,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdEmpresa = 2,
                Nombre = "Lefarma",
                NombreNormalizado = "lefarma",
                Descripcion = "Lefarma - Farmaceutica principal",
                DescripcionNormalizada = "lefarma - farmaceutica principal",
                Clave = "LEF",
                RazonSocial = "Lefarma S.A. de C.V.",
                RFC = "LEF123456DEF",
                Direccion = "Av. Industria 456",
                Colonia = "Industrial",
                Ciudad = "Ciudad de Mexico",
                Estado = "CDMX",
                CodigoPostal = "07800",
                Telefono = "5555550202",
                Email = "contacto@lefarma.com",
                PaginaWeb = "www.lefarma.com",
                NumeroEmpleados = 120,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdEmpresa = 3,
                Nombre = "Artricenter",
                NombreNormalizado = "artricenter",
                Descripcion = "Artricenter - Centro de artritis y reumatologia",
                DescripcionNormalizada = "artricenter - centro de artritis y reumatologia",
                Clave = "ATC",
                RazonSocial = "Artricenter S.A. de C.V.",
                RFC = "ATC123456GHI",
                Direccion = "Av. Salud 789",
                Colonia = "Medica",
                Ciudad = "Ciudad de Mexico",
                Estado = "CDMX",
                CodigoPostal = "06700",
                Telefono = "5555550303",
                Email = "contacto@artricenter.com",
                PaginaWeb = "www.artricenter.com",
                NumeroEmpleados = 35,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdEmpresa = 4,
                Nombre = "Construmedika",
                NombreNormalizado = "construmedika",
                Descripcion = "Construmedika - Construccion medica",
                DescripcionNormalizada = "construmedika - construccion medica",
                Clave = "CON",
                RazonSocial = "Construmedika S.A. de C.V.",
                RFC = "CON123456JKL",
                Direccion = "Av. Obra 321",
                Colonia = "Construccion",
                Ciudad = "Ciudad de Mexico",
                Estado = "CDMX",
                CodigoPostal = "08900",
                Telefono = "5555550404",
                Email = "contacto@construmedika.com",
                PaginaWeb = "www.construmedika.com",
                NumeroEmpleados = 45,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdEmpresa = 5,
                Nombre = "Grupo Lefarma",
                NombreNormalizado = "grupo lefarma",
                Descripcion = "Grupo Lefarma - Holding corporativo",
                DescripcionNormalizada = "grupo lefarma - holding corporativo",
                Clave = "GRP",
                RazonSocial = "Grupo Lefarma S.A. de C.V.",
                RFC = "GRP123456MNO",
                Direccion = "Av. Corporativa 999",
                Colonia = "Corporativo",
                Ciudad = "Ciudad de Mexico",
                Estado = "CDMX",
                CodigoPostal = "11000",
                Telefono = "5555550505",
                Email = "corporativo@grupolefarma.com",
                PaginaWeb = "www.grupolefarma.com",
                NumeroEmpleados = 15,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            }
        };

        await _context.Empresas.AddRangeAsync(empresas, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Seeded {Count} empresas", empresas.Count);
    }

    private async Task SeedAreasAsync(CancellationToken cancellationToken)
    {
        if (await _context.Areas.AnyAsync(cancellationToken))
        {
            _logger.LogInformation("Areas already seeded, skipping...");
            return;
        }

        _logger.LogInformation("Seeding areas...");

        var areas = new List<Area>
        {
            new()
            {
                IdArea = 1,
                IdEmpresa = 1, // Asokam
                Nombre = "Recursos Humanos",
                NombreNormalizado = "recursos humanos",
                Descripcion = "Gestion de personal y recursos humanos",
                DescripcionNormalizada = "gestion de personal y recursos humanos",
                Clave = "RH",
                NumeroEmpleados = 5,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdArea = 2,
                IdEmpresa = 1, // Asokam
                Nombre = "Contabilidad",
                NombreNormalizado = "contabilidad",
                Descripcion = "Contabilidad general y estados financieros",
                DescripcionNormalizada = "contabilidad general y estados financieros",
                Clave = "CON",
                NumeroEmpleados = 8,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdArea = 3,
                IdEmpresa = 1, // Asokam
                Nombre = "Tesoreria",
                NombreNormalizado = "tesoreria",
                Descripcion = "Gestion de tesoreria y flujo de efectivo",
                DescripcionNormalizada = "gestion de tesoreria y flujo de efectivo",
                Clave = "TES",
                NumeroEmpleados = 4,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdArea = 4,
                IdEmpresa = 2, // Lefarma
                Nombre = "Compras",
                NombreNormalizado = "compras",
                Descripcion = "Adquisiciones y compras corporativas",
                DescripcionNormalizada = "adquisiciones y compras corporativas",
                Clave = "COM",
                NumeroEmpleados = 12,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdArea = 5,
                IdEmpresa = 2, // Lefarma
                Nombre = "Almacen",
                NombreNormalizado = "almacen",
                Descripcion = "Control de inventario y almacen",
                DescripcionNormalizada = "control de inventario y almacen",
                Clave = "ALM",
                NumeroEmpleados = 20,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdArea = 6,
                IdEmpresa = 2, // Lefarma
                Nombre = "Produccion",
                NombreNormalizado = "produccion",
                Descripcion = "Manufactura y produccion de medicamentos",
                DescripcionNormalizada = "manufactura y produccion de medicamentos",
                Clave = "PROD",
                NumeroEmpleados = 45,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdArea = 7,
                IdEmpresa = 2, // Lefarma
                Nombre = "Ventas",
                NombreNormalizado = "ventas",
                Descripcion = "Ventas corporativas y atencion a clientes",
                DescripcionNormalizada = "ventas corporativas y atencion a clientes",
                Clave = "VTA",
                NumeroEmpleados = 25,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdArea = 8,
                IdEmpresa = 2, // Lefarma
                Nombre = "Marketing",
                NombreNormalizado = "marketing",
                Descripcion = "Marketing y publicidad",
                DescripcionNormalizada = "marketing y publicidad",
                Clave = "MKT",
                NumeroEmpleados = 10,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdArea = 9,
                IdEmpresa = 3, // Artricenter
                Nombre = "Tecnologia",
                NombreNormalizado = "tecnologia",
                Descripcion = "Sistemas y tecnologia de la informacion",
                DescripcionNormalizada = "sistemas y tecnologia de la informacion",
                Clave = "TI",
                NumeroEmpleados = 8,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdArea = 10,
                IdEmpresa = 3, // Artricenter
                Nombre = "Calidad",
                NombreNormalizado = "calidad",
                Descripcion = "Control y aseguramiento de calidad",
                DescripcionNormalizada = "control y aseguramiento de calidad",
                Clave = "CAL",
                NumeroEmpleados = 6,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            }
        };

        await _context.Areas.AddRangeAsync(areas, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Seeded {Count} areas", areas.Count);
    }

    private async Task SeedTiposGastoAsync(CancellationToken cancellationToken)
    {
        if (await _context.TiposGasto.AnyAsync(cancellationToken))
        {
            _logger.LogInformation("TiposGasto already seeded, skipping...");
            return;
        }

        _logger.LogInformation("Seeding tipos de gasto...");

        var tiposGasto = new List<TipoGasto>
        {
            new()
            {
                IdTipoGasto = 1,
                Nombre = "Fijo",
                NombreNormalizado = "fijo",
                Descripcion = "Gastos fijos mensuales recurrentes como renta, servicios, nominas",
                DescripcionNormalizada = "gastos fijos mensuales recurrentes como renta, servicios, nominas",
                Clave = "FIJO",
                Concepto = "Gasto Fijo Operativo",
                Cuenta = "6000",
                SubCuenta = "6100",
                Analitica = "SAL",
                Integracion = "SAP",
                CuentaCatalogo = "6000-001",
                RequiereComprobacionPago = true,
                RequiereComprobacionGasto = true,
                PermiteSinDatosFiscales = false,
                DiasLimiteComprobacion = 30,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdTipoGasto = 2,
                Nombre = "Variable",
                NombreNormalizado = "variable",
                Descripcion = "Gastos variables segun produccion y ventas como materia prima, comisiones",
                DescripcionNormalizada = "gastos variables segun produccion y ventas como materia prima, comisiones",
                Clave = "VAR",
                Concepto = "Gasto Variable Operativo",
                Cuenta = "6100",
                SubCuenta = "6110",
                Analitica = "PRO",
                Integracion = "SAP",
                CuentaCatalogo = "6100-001",
                RequiereComprobacionPago = true,
                RequiereComprobacionGasto = true,
                PermiteSinDatosFiscales = false,
                DiasLimiteComprobacion = 15,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdTipoGasto = 3,
                Nombre = "Extraordinario",
                NombreNormalizado = "extraordinario",
                Descripcion = "Gastos extraordinarios no recurrentes como reparaciones mayores, emergencias",
                DescripcionNormalizada = "gastos extraordinarios no recurrentes como reparaciones mayores, emergencias",
                Clave = "EXT",
                Concepto = "Gasto Extraordinario",
                Cuenta = "7000",
                SubCuenta = "7100",
                Analitica = "OTR",
                Integracion = "SAP",
                CuentaCatalogo = "7000-001",
                RequiereComprobacionPago = true,
                RequiereComprobacionGasto = true,
                PermiteSinDatosFiscales = true,
                DiasLimiteComprobacion = 60,
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            }
        };

        await _context.TiposGasto.AddRangeAsync(tiposGasto, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Seeded {Count} tipos de gasto", tiposGasto.Count);
    }

    private async Task SeedTiposMedidaAsync(CancellationToken cancellationToken)
    {
        if (await _context.TiposMedida.AnyAsync(cancellationToken))
        {
            _logger.LogInformation("TiposMedida already seeded, skipping...");
            return;
        }

        _logger.LogInformation("Seeding tipos de medida...");

        var tiposMedida = new List<TipoMedida>
        {
            new()
            {
                IdTipoMedida = 1,
                Nombre = "Unidad",
                NombreNormalizado = "unidad",
                Descripcion = "Unidades individuales o piezas",
                DescripcionNormalizada = "unidades individuales o piezas",
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdTipoMedida = 2,
                Nombre = "Servicio",
                NombreNormalizado = "servicio",
                Descripcion = "Servicios prestados",
                DescripcionNormalizada = "servicios prestados",
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdTipoMedida = 3,
                Nombre = "Peso",
                NombreNormalizado = "peso",
                Descripcion = "Medidas de peso y masa",
                DescripcionNormalizada = "medidas de peso y masa",
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdTipoMedida = 4,
                Nombre = "Volumen",
                NombreNormalizado = "volumen",
                Descripcion = "Medidas de volumen y capacidad",
                DescripcionNormalizada = "medidas de volumen y capacidad",
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdTipoMedida = 5,
                Nombre = "Longitud",
                NombreNormalizado = "longitud",
                Descripcion = "Medidas de longitud y distancia",
                DescripcionNormalizada = "medidas de longitud y distancia",
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdTipoMedida = 6,
                Nombre = "Tiempo",
                NombreNormalizado = "tiempo",
                Descripcion = "Medidas de tiempo y duracion",
                DescripcionNormalizada = "medidas de tiempo y duracion",
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdTipoMedida = 7,
                Nombre = "Envase",
                NombreNormalizado = "envase",
                Descripcion = "Unidades de empaque y envase",
                DescripcionNormalizada = "unidades de empaque y envase",
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdTipoMedida = 8,
                Nombre = "Energia",
                NombreNormalizado = "energia",
                Descripcion = "Medidas de energia electrica",
                DescripcionNormalizada = "medidas de energia electrica",
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            }
        };

        await _context.TiposMedida.AddRangeAsync(tiposMedida, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Seeded {Count} tipos de medida", tiposMedida.Count);
    }

    private async Task SeedUnidadesMedidaAsync(CancellationToken cancellationToken)
    {
        if (await _context.UnidadesMedida.AnyAsync(cancellationToken))
        {
            _logger.LogInformation("UnidadesMedida already seeded, skipping...");
            return;
        }

        _logger.LogInformation("Seeding unidades de medida...");

        var unidadesMedida = new List<UnidadMedida>
        {
            new()
            {
                IdUnidadMedida = 1,
                IdTipoMedida = 1, // Unidad
                Nombre = "Piezas",
                NombreNormalizado = "piezas",
                Descripcion = "Piezas individuales",
                DescripcionNormalizada = "piezas individuales",
                Abreviatura = "pza",
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdUnidadMedida = 2,
                IdTipoMedida = 2, // Servicio
                Nombre = "Servicio",
                NombreNormalizado = "servicio",
                Descripcion = "Servicio prestado",
                DescripcionNormalizada = "servicio prestado",
                Abreviatura = "srv",
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdUnidadMedida = 3,
                IdTipoMedida = 3, // Peso
                Nombre = "Kilos",
                NombreNormalizado = "kilos",
                Descripcion = "Kilogramos",
                DescripcionNormalizada = "kilogramos",
                Abreviatura = "kg",
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdUnidadMedida = 4,
                IdTipoMedida = 4, // Volumen
                Nombre = "Litros",
                NombreNormalizado = "litros",
                Descripcion = "Litros",
                DescripcionNormalizada = "litros",
                Abreviatura = "L",
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdUnidadMedida = 5,
                IdTipoMedida = 5, // Longitud
                Nombre = "Metros",
                NombreNormalizado = "metros",
                Descripcion = "Metros lineales",
                DescripcionNormalizada = "metros lineales",
                Abreviatura = "m",
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdUnidadMedida = 6,
                IdTipoMedida = 6, // Tiempo
                Nombre = "Horas",
                NombreNormalizado = "horas",
                Descripcion = "Horas de servicio",
                DescripcionNormalizada = "horas de servicio",
                Abreviatura = "hr",
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdUnidadMedida = 7,
                IdTipoMedida = 7, // Envase
                Nombre = "Cajas",
                NombreNormalizado = "cajas",
                Descripcion = "Cajas o cajones",
                DescripcionNormalizada = "cajas o cajones",
                Abreviatura = "cja",
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            },
            new()
            {
                IdUnidadMedida = 8,
                IdTipoMedida = 8, // Energia
                Nombre = "Kilowatts",
                NombreNormalizado = "kilowatts",
                Descripcion = "Kilowatts hora",
                DescripcionNormalizada = "kilowatts hora",
                Abreviatura = "kW",
                Activo = true,
                FechaCreacion = DateTime.UtcNow
            }
        };

        await _context.UnidadesMedida.AddRangeAsync(unidadesMedida, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Seeded {Count} unidades de medida", unidadesMedida.Count);
    }
}
