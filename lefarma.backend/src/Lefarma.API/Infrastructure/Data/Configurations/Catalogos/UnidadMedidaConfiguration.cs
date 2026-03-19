using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos
{
    public class UnidadMedidaConfiguration : IEntityTypeConfiguration<UnidadMedida>
    {
        public void Configure(EntityTypeBuilder<UnidadMedida> builder)
        {
            builder.ToTable("unidades_medida", "catalogos");

            builder.HasKey(e => e.IdUnidadMedida);
            builder.Property(e => e.IdUnidadMedida)
                .HasColumnName("id_unidad_medida")
                .ValueGeneratedOnAdd();

            builder.Property(e => e.IdMedida)
                .HasColumnName("id_medida")
                .IsRequired();

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

            builder.Property(e => e.DescripcionNormalizada)
                .HasColumnName("descripcion_normalizada")
                .HasMaxLength(500);

            builder.Property(e => e.Abreviatura)
                .HasColumnName("abreviatura")
                .HasMaxLength(20)
                .IsRequired();

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

            //builder.HasOne(e => e.TipoMedida)
            //  .WithMany(e => e.UnidadMedidas)
            //  .HasForeignKey(e => e.IdTipoMedida)
            //  .OnDelete(DeleteBehavior.Restrict);

        }
    }
}