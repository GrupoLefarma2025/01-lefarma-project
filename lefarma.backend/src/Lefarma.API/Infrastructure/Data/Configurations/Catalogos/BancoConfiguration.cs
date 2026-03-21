using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Lefarma.API.Domain.Entities.Catalogos;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos
{
    public class BancoConfiguration : IEntityTypeConfiguration<Banco>
    {
        public void Configure(EntityTypeBuilder<Banco> builder)
        {
            // Tabla
            builder.ToTable("bancos", "catalogos");

            // Clave primaria
            builder.HasKey(b => b.IdBanco);
            builder.Property(b => b.IdBanco)
                .HasColumnName("id_banco")
                .ValueGeneratedOnAdd();

            // Propiedades requeridas
            builder.Property(b => b.Nombre)
                .HasColumnName("nombre")
                .HasMaxLength(255)
                .IsRequired();

            builder.Property(b => b.NombreNormalizado)
                .HasColumnName("nombre_normalizado")
                .HasMaxLength(300);

            builder.Property(b => b.Clave)
                .HasColumnName("clave")
                .HasMaxLength(100);

            builder.Property(b => b.CodigoSWIFT)
                .HasColumnName("codigo_swift")
                .HasMaxLength(11);

            builder.Property(b => b.Descripcion)
                .HasColumnName("descripcion")
                .HasMaxLength(1000);

            builder.Property(b => b.DescripcionNormalizada)
                .HasColumnName("descripcion_normalizada")
                .HasMaxLength(1000);

            builder.Property(b => b.Activo)
                .HasColumnName("activo")
                .HasDefaultValue(true);

            builder.Property(b => b.FechaCreacion)
                .HasColumnName("fecha_creacion")
                .HasDefaultValueSql("GETUTCDATE()")
                .IsRequired();

            builder.Property(b => b.FechaModificacion)
                .HasColumnName("fecha_modificacion");

            // Índices
            builder.HasIndex(b => b.NombreNormalizado)
                .HasDatabaseName("ix_bancos_nombre_normalizado");

            builder.HasIndex(b => b.Activo)
                .HasDatabaseName("ix_bancos_activo");

            builder.HasIndex(b => b.Clave)
                .HasDatabaseName("ix_bancos_clave");
        }
    }
}
