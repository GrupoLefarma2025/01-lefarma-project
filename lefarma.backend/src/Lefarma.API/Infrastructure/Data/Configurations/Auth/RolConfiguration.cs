using Lefarma.API.Domain.Entities.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Auth {
public class RolConfiguration : IEntityTypeConfiguration<Rol>
    {
        public void Configure(EntityTypeBuilder<Rol> builder)
        {
            builder.ToTable("Roles", "app");

            builder.HasKey(e => e.IdRol);
            builder.Property(e => e.IdRol)
                .ValueGeneratedOnAdd();

            builder.Property(e => e.NombreRol)
                .IsRequired()
                .HasMaxLength(256);

            builder.Property(e => e.Descripcion)
                .HasMaxLength(1024);

            builder.Property(e => e.EsActivo)
                .HasDefaultValue(true);

            builder.Property(e => e.EsSistema)
                .HasDefaultValue(false);

            builder.Property(e => e.FechaCreacion)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.HasIndex(e => e.NombreRol)
                .IsUnique()
                .HasDatabaseName("IX_Roles_NombreRol");
        }
    }
}
