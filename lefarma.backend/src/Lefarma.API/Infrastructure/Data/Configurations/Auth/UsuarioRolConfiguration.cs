using Lefarma.API.Domain.Entities.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Auth
{
    public class UsuarioRolConfiguration : IEntityTypeConfiguration<UsuarioRol>
    {
        public void Configure(EntityTypeBuilder<UsuarioRol> builder)
        {
            builder.ToTable("UsuariosRoles", "app");

            builder.HasKey(e => e.IdUsuarioRol);
            builder.Property(e => e.IdUsuarioRol)
                .ValueGeneratedOnAdd();

            // Explicitly map FK column names to match database
            builder.Property(e => e.IdUsuario).HasColumnName("IdUsuario");
            builder.Property(e => e.IdRol).HasColumnName("IdRol");

            builder.Property(e => e.FechaAsignacion)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.HasOne(e => e.Usuario)
                .WithMany(u => u.UsuariosRoles)
                .HasForeignKey(e => e.IdUsuario)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(e => e.Rol)
                .WithMany(r => r.UsuariosRoles)
                .HasForeignKey(e => e.IdRol)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(e => new { e.IdUsuario, e.IdRol })
                .IsUnique()
                .HasDatabaseName("IX_UsuariosRoles_UsuarioRol");
        }
    }
}
