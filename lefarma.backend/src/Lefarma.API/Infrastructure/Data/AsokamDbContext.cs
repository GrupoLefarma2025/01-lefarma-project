using Lefarma.API.Domain.Entities.Auth;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data;
public class AsokamDbContext : DbContext
{
    public AsokamDbContext(DbContextOptions<AsokamDbContext> options) : base(options)
    {
    }

    // Auth tables
    public DbSet<Usuario> Usuarios { get; set; } = null!;
    public DbSet<Rol> Roles { get; set; } = null!;
    public DbSet<Permiso> Permisos { get; set; } = null!;
    public DbSet<UsuarioRol> UsuariosRoles { get; set; } = null!;
    public DbSet<RolPermiso> RolesPermisos { get; set; } = null!;
    public DbSet<UsuarioPermiso> UsuariosPermisos { get; set; } = null!;
    public DbSet<Sesion> Sesiones { get; set; } = null!;
    public DbSet<RefreshToken> RefreshTokens { get; set; } = null!;
    public DbSet<DominioConfig> DominioConfigs { get; set; } = null!;
    public DbSet<AuditLog> AuditLogs { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply all configurations from this assembly
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AsokamDbContext).Assembly);

        // Specify primary keys for all entities
        modelBuilder.Entity<Usuario>(entity =>
        {
            entity.HasKey(e => e.IdUsuario);
            entity.ToTable("Usuarios", "app");
        });

        modelBuilder.Entity<Rol>(entity =>
        {
            entity.HasKey(e => e.IdRol);
            entity.ToTable("Roles", "app");
        });

        modelBuilder.Entity<Permiso>(entity =>
        {
            entity.HasKey(e => e.IdPermiso);
            entity.ToTable("Permisos", "app");
        });

        modelBuilder.Entity<UsuarioRol>(entity =>
        {
            entity.HasKey(e => e.IdUsuarioRol);
            entity.ToTable("UsuariosRoles", "app");
        });

        modelBuilder.Entity<RolPermiso>(entity =>
        {
            entity.HasKey(e => e.IdRolPermiso);
            entity.ToTable("RolesPermisos", "app");
        });

        modelBuilder.Entity<UsuarioPermiso>(entity =>
        {
            entity.HasKey(e => e.IdUsuarioPermiso);
            entity.ToTable("UsuariosPermisos", "app");
        });

        modelBuilder.Entity<Sesion>(entity =>
        {
            entity.HasKey(e => e.IdSesion);
            entity.ToTable("Sesiones", "app");
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(e => e.IdRefreshToken);
            entity.ToTable("RefreshTokens", "app");
        });

        modelBuilder.Entity<DominioConfig>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.ToTable("DominioConfig", "app");
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(e => e.IdAudit);
            entity.ToTable("AuditLog", "app");
        });
    }
}
