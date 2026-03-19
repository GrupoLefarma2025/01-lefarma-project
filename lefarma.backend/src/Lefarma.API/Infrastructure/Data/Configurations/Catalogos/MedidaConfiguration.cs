using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos
{
    public class MedidaConfiguration : IEntityTypeConfiguration<Medida>
    {
        public void Configure(EntityTypeBuilder<Medida> builder)
        {
            builder.ToTable("medidas", "catalogos");

            builder.HasKey(t => t.IdMedida);

            builder.Property(t => t.IdMedida)
                .HasColumnName("id_medida")
                .UseIdentityColumn(1, 1);

            builder.Property(t => t.Nombre)
                .HasColumnName("nombre")
                .HasMaxLength(80)
                .IsRequired();

            builder.Property(t => t.NombreNormalizado)
                .HasColumnName("nombre_normalizado")
                .HasMaxLength(80);

            builder.Property(t => t.Descripcion)
                .HasColumnName("descripcion")
                .HasMaxLength(255);

            builder.Property(t => t.DescripcionNormalizada)
                .HasColumnName("descripcion_normalizada")
                .HasMaxLength(255);

            builder.Property(t => t.Activo)
                .HasColumnName("activo")
                .HasDefaultValue(true);

            builder.Property(t => t.FechaCreacion)
                .HasColumnName("fecha_creacion")
                .HasDefaultValueSql("GETDATE()")
                .IsRequired();

            builder.Property(t => t.FechaModificacion)
                .HasColumnName("fecha_modificacion")
                .HasDefaultValueSql("GETDATE()");

            // Relaciones
            builder.HasMany(e => e.UnidadesMedida)
                .WithOne(s => s.Medida)
                .HasForeignKey(s => s.IdMedida)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
