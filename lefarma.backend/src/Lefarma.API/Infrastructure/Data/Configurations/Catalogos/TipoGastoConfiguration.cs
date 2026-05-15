using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos
{
    public class TipoGastoConfiguration : IEntityTypeConfiguration<TipoGasto>
    {
        public void Configure(EntityTypeBuilder<TipoGasto> builder)
        {
            builder.ToTable("tipos_gasto", "catalogos");

            builder.HasKey(e => e.IdTipoGasto);
            builder.Property(e => e.IdTipoGasto)
                .HasColumnName("id_tipo_gasto")
                .ValueGeneratedOnAdd();

            builder.Property(e => e.Nombre)
                .HasColumnName("nombre")
                .HasMaxLength(255)
                .IsRequired();

            builder.Property(e => e.NombreNormalizado)
                .HasColumnName("nombre_normalizado")
                .HasMaxLength(255)
                .IsRequired();

            builder.Property(e => e.Descripcion)
                .HasColumnName("descripcion")
                .HasMaxLength(500);

            builder.Property(e => e.Clave)
                .HasColumnName("clave")
                .HasMaxLength(50);

            builder.Property(e => e.RequiereComprobacionPago)
                .HasColumnName("requiere_comprobacion_pago")
                .HasDefaultValue(true);

            builder.Property(e => e.RequiereComprobacionGasto)
                .HasColumnName("requiere_comprobacion_gasto")
                .HasDefaultValue(true);

            builder.Property(e => e.Activo)
                .HasColumnName("activo")
                .HasDefaultValue(true);

            builder.Property(e => e.FechaCreacion)
                .HasColumnName("fecha_creacion")
                .IsRequired()
                .HasDefaultValueSql("GETDATE()");

            builder.Property(e => e.FechaModificacion)
                .HasColumnName("fecha_modificacion")
                .HasDefaultValueSql("GETDATE()");

            builder.HasIndex(e => e.Nombre)
                .IsUnique()
                .HasDatabaseName("IX_tipos_gasto_nombre");

            builder.HasIndex(e => e.Activo)
                .HasDatabaseName("IX_tipos_gasto_activo");

            builder.HasIndex(e => e.NombreNormalizado)
                .HasDatabaseName("IX_tipos_gasto_nombre_normalizado");
        }
    }
}
