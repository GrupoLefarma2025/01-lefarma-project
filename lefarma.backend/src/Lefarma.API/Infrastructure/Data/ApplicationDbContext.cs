using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.Logging;
using Lefarma.API.Domain.Entities.Notifications;
using Microsoft.EntityFrameworkCore;
using System.Reflection;

namespace Lefarma.API.Infrastructure.Data
{
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

        // DbSets - Catalogos Nuevos (Sistema CxP)
        public DbSet<Proveedor> Proveedores { get; set; }
        public DbSet<CentroCosto> CentrosCosto { get; set; }
        public DbSet<CuentaContable> CuentasContables { get; set; }
        public DbSet<EstatusOrden> EstatusOrden { get; set; }
        public DbSet<RegimenFiscal> RegimenesFiscales { get; set; }
        public DbSet<Banco> Bancos { get; set; }
        public DbSet<MedioPago> MediosPago { get; set; }

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

        // DbSets - Notifications
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<NotificationChannel> NotificationChannels { get; set; }
        public DbSet<UserNotification> UserNotifications { get; set; }

        // DbSets - Views (read-only)
        public DbSet<VwDirectorioActivo> VwDirectorioActivo { get; set; }

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