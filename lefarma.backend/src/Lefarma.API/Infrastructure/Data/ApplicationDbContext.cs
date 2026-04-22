using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Logging;
using Lefarma.API.Domain.Entities.Notifications;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Entities.Help;
using Lefarma.API.Domain.Entities.Archivos;
using Microsoft.EntityFrameworkCore;
using System.Reflection;

namespace Lefarma.API.Infrastructure.Data {
public class ApplicationDbContext : DbContext
    {
        // Constructor del ApplicationDbContext
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }

        // DbSets - Catalogos
        public DbSet<Empresa> Empresas { get; set; }
        public DbSet<Sucursal> Sucursales { get; set; }
        public DbSet<Gasto> Gastos { get; set; }
        public DbSet<Area> Areas { get; set; }
        public DbSet<Medida> Medidas { get; set; }
        public DbSet<UnidadMedida> UnidadesMedida { get; set; }
        public DbSet<GastoUnidadMedida> GastosUnidadesMedida { get; set; }
        public DbSet<UsuarioDetalle> UsuariosDetalle { get; set; }
        public DbSet<FormaPago> FormasPago { get; set; }

        // DbSets - Config (Motor de Workflows)
        public DbSet<Workflow> Workflows { get; set; }
        public DbSet<WorkflowPaso> WorkflowPasos { get; set; }
        public DbSet<WorkflowParticipante> WorkflowParticipantes { get; set; }
        public DbSet<WorkflowAccion> WorkflowAcciones { get; set; }
        public DbSet<WorkflowAccionHandler> WorkflowAccionHandlers { get; set; }
        public DbSet<WorkflowCampo> WorkflowCampos { get; set; }
        public DbSet<WorkflowNotificacion> WorkflowNotificaciones { get; set; }
        public DbSet<WorkflowCanalTemplate> WorkflowCanalTemplates { get; set; }
        public DbSet<WorkflowTipoNotificacion> WorkflowTiposNotificacion { get; set; }
        public DbSet<WorkflowCondicion> WorkflowCondiciones { get; set; }
        public DbSet<WorkflowBitacora> WorkflowBitacoras { get; set; }
        public DbSet<WorkflowRecordatorio> WorkflowRecordatorios { get; set; }
        public DbSet<WorkflowRecordatorioLog> WorkflowRecordatorioLogs { get; set; }
        public DbSet<WorkflowRecordatorioCanal> WorkflowRecordatorioCanales { get; set; }
        public DbSet<WorkflowNotificacionCanal> WorkflowNotificacionCanales { get; set; }
        public DbSet<WorkflowNotificacionesPlantillas> WorkflowNotificacionesPlantillas { get; set; }

        // DbSets - Operaciones
        public DbSet<OrdenCompra> OrdenesCompra { get; set; }
        public DbSet<OrdenCompraPartida> OrdenesCompraPartidas { get; set; }
        public DbSet<Pago> Pagos { get; set; }
        public DbSet<Comprobacion> Comprobaciones { get; set; }

        // DbSets - Catalogos Nuevos (Sistema CxP)
        public DbSet<Proveedor> Proveedores { get; set; }
        public DbSet<ProveedorDetalle> ProveedoresDetalle { get; set; }
        public DbSet<ProveedorFormaPagoCuenta> ProveedoresFormasPagoCuentas { get; set; }
        public DbSet<StagingProveedor> StagingProveedores { get; set; }
        public DbSet<StagingProveedorDetalle> StagingProveedoresDetalle { get; set; }
        public DbSet<StagingProveedorFormaPagoCuenta> StagingProveedoresFormasPagoCuentas { get; set; }
        public DbSet<CentroCosto> CentrosCosto { get; set; }
        public DbSet<CuentaContable> CuentasContables { get; set; }
        public DbSet<EstatusOrden> EstatusOrden { get; set; }
        public DbSet<RegimenFiscal> RegimenesFiscales { get; set; }
        public DbSet<Banco> Bancos { get; set; }
        public DbSet<MedioPago> MediosPago { get; set; }
        public DbSet<TipoImpuesto> TiposImpuesto { get; set; }
        public DbSet<Moneda> Monedas { get; set; }

        // DbSets - Auth/Identity
        public DbSet<Usuario> Usuarios { get; set; }
        public DbSet<Rol> Roles { get; set; }
        public DbSet<Permiso> Permisos { get; set; }
        public DbSet<UsuarioRol> UsuariosRoles { get; set; }
        public DbSet<RolPermiso> RolesPermisos { get; set; }
        public DbSet<UsuarioPermiso> UsuariosPermisos { get; set; }
        public DbSet<Sesion> Sesiones { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<DominioConfig> DominioConfigs { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }

        // DbSets - Logging
        public DbSet<ErrorLog> ErrorLogs { get; set; }
        public DbSet<BusinessAuditLog> BusinessAuditLogs { get; set; }

        // DbSets - Notifications
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<NotificationChannel> NotificationChannels { get; set; }
        public DbSet<UserNotification> UserNotifications { get; set; }

        // DbSets - Views (read-only)
        public DbSet<VwDirectorioActivo> VwDirectorioActivo { get; set; }

        // DbSets - Help System
        public DbSet<HelpModule> HelpModules { get; set; }
        public DbSet<HelpArticle> HelpArticles { get; set; }
        public DbSet<HelpImage> HelpImages { get; set; }

        // DbSets - Archivos
        public DbSet<Archivo> Archivos { get; set; }

        // DbSets - Comprobantes (CFDI / facturas)
        public DbSet<Comprobante> Comprobantes { get; set; }
        public DbSet<ComprobanteConcepto> ComprobantesConceptos { get; set; }
        public DbSet<ComprobantePartida> ComprobantesPartidas { get; set; }

        // Configuración mediante Fluent API
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Aplicar todas las configuraciones automáticamente
            // Encuentra y aplica TODAS las clases que implementen IEntityTypeConfiguration<T>
            modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());

            // Mapeo
            //modelBuilder.ApplyConfiguration(new EmpresaConfiguration());
        }
    }
}
