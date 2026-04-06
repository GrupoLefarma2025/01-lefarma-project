using Lefarma.API.Domain.Entities.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Auth {
public class PermisoConfiguration : IEntityTypeConfiguration<Permiso>
    {
        public void Configure(EntityTypeBuilder<Permiso> builder)
        {
            builder.ToTable("Permisos", "app");

            builder.HasKey(e => e.IdPermiso);
            builder.Property(e => e.IdPermiso)
                .ValueGeneratedOnAdd();

            builder.Property(e => e.CodigoPermiso)
                .IsRequired()
                .HasMaxLength(256);

            builder.Property(e => e.NombrePermiso)
                .IsRequired()
                .HasMaxLength(512);

            builder.Property(e => e.Descripcion)
                .HasMaxLength(1024);

            builder.Property(e => e.Categoria)
                .HasMaxLength(256);

            builder.Property(e => e.Recurso)
                .HasMaxLength(256);

            builder.Property(e => e.Accion)
                .HasMaxLength(256);

            builder.Property(e => e.EsActivo)
                .HasDefaultValue(true);

            builder.Property(e => e.EsSistema)
                .HasDefaultValue(false);

            builder.Property(e => e.FechaCreacion)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.HasIndex(e => e.CodigoPermiso)
                .IsUnique()
                .HasDatabaseName("IX_Permisos_CodigoPermiso");
        }
    }
}
