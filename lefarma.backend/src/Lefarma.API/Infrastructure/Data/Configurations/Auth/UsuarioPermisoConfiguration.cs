using Lefarma.API.Domain.Entities.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Auth {
public class UsuarioPermisoConfiguration : IEntityTypeConfiguration<UsuarioPermiso>
    {
        public void Configure(EntityTypeBuilder<UsuarioPermiso> builder)
        {
            builder.ToTable("UsuariosPermisos", "app");

            builder.HasKey(e => e.IdUsuarioPermiso);
            builder.Property(e => e.IdUsuarioPermiso)
                .ValueGeneratedOnAdd();

            builder.Property(e => e.EsConcedido)
                .HasDefaultValue(true);

            builder.Property(e => e.FechaAsignacion)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.HasOne(e => e.Usuario)
                .WithMany(u => u.UsuariosPermisos)
                .HasForeignKey(e => e.IdUsuario)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(e => e.Permiso)
                .WithMany(p => p.UsuariosPermisos)
                .HasForeignKey(e => e.IdPermiso)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(e => new { e.IdUsuario, e.IdPermiso })
                .IsUnique()
                .HasDatabaseName("IX_UsuariosPermisos_UsuarioPermiso");
        }
    }
}
