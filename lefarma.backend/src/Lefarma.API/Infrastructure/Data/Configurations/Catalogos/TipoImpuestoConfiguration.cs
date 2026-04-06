using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Lefarma.API.Domain.Entities.Catalogos;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos;

public class TipoImpuestoConfiguration : IEntityTypeConfiguration<TipoImpuesto>
{
    public void Configure(EntityTypeBuilder<TipoImpuesto> builder)
    {
        // Tabla
        builder.ToTable("tipos_impuesto", "catalogos");

        // Clave primaria
        builder.HasKey(t => t.IdTipoImpuesto);
        builder.Property(t => t.IdTipoImpuesto)
            .HasColumnName("id_tipo_impuesto")
            .ValueGeneratedOnAdd();

        // Propiedades requeridas
        builder.Property(t => t.Nombre)
            .HasColumnName("nombre")
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(t => t.NombreNormalizado)
            .HasColumnName("nombre_normalizado")
            .HasMaxLength(300);

        builder.Property(t => t.Clave)
            .HasColumnName("clave")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(t => t.Tasa)
            .HasColumnName("tasa")
            .HasPrecision(18, 6)
            .IsRequired();

        builder.Property(t => t.Descripcion)
            .HasColumnName("descripcion")
            .HasMaxLength(1000);

        builder.Property(t => t.DescripcionNormalizada)
            .HasColumnName("descripcion_normalizada")
            .HasMaxLength(1000);

        builder.Property(t => t.Activo)
            .HasColumnName("activo")
            .HasDefaultValue(true);

        builder.Property(t => t.FechaCreacion)
            .HasColumnName("fecha_creacion")
            .HasDefaultValueSql("GETUTCDATE()")
            .IsRequired();

        builder.Property(t => t.FechaModificacion)
            .HasColumnName("fecha_modificacion");

        // Índices
        builder.HasIndex(t => t.NombreNormalizado)
            .HasDatabaseName("ix_tipos_impuesto_nombre_normalizado");

        builder.HasIndex(t => t.Activo)
            .HasDatabaseName("ix_tipos_impuesto_activo");

        builder.HasIndex(t => t.Clave)
            .HasDatabaseName("ix_tipos_impuesto_clave");
    }
}
