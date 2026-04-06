using Lefarma.API.Domain.Entities.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Auth {
public class RolPermisoConfiguration : IEntityTypeConfiguration<RolPermiso>
    {
        public void Configure(EntityTypeBuilder<RolPermiso> builder)
        {
            builder.ToTable("RolesPermisos", "app");

            builder.HasKey(e => e.IdRolPermiso);
            builder.Property(e => e.IdRolPermiso)
                .ValueGeneratedOnAdd();

            builder.Property(e => e.FechaAsignacion)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.HasOne(e => e.Rol)
                .WithMany(r => r.RolesPermisos)
                .HasForeignKey(e => e.IdRol)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(e => e.Permiso)
                .WithMany(p => p.RolesPermisos)
                .HasForeignKey(e => e.IdPermiso)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(e => new { e.IdRol, e.IdPermiso })
                .IsUnique()
                .HasDatabaseName("IX_RolesPermisos_RolPermiso");
        }
    }
}
