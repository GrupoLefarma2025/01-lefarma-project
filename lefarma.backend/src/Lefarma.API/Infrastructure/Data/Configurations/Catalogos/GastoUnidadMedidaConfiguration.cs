using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos {
public class GastoUnidadMedidaConfiguration : IEntityTypeConfiguration<GastoUnidadMedida>
    {
        public void Configure(EntityTypeBuilder<GastoUnidadMedida> builder)
        {
            builder.ToTable("gastos_unidades_medida", "catalogos");

            // Composite Primary Key
            builder.HasKey(gu => new { gu.IdGasto, gu.IdUnidadMedida });

            // Properties
            builder.Property(gu => gu.IdGasto)
                .HasColumnName("id_gasto")
                .IsRequired();

            builder.Property(gu => gu.IdUnidadMedida)
                .HasColumnName("id_unidad_medida")
                .IsRequired();

            builder.Property(gu => gu.Activo)
                .HasColumnName("activo")
                .HasDefaultValue(true)
                .IsRequired();

            builder.Property(gu => gu.FechaCreacion)
                .HasColumnName("fecha_creacion")
                .HasDefaultValueSql("GETDATE()")
                .IsRequired();

            // Relationships
            builder.HasOne(gu => gu.Gasto)
                .WithMany(g => g.GastoUnidadesMedida)
                .HasForeignKey(gu => gu.IdGasto)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(gu => gu.UnidadMedida)
                .WithMany(u => u.GastoUnidadesMedida)
                .HasForeignKey(gu => gu.IdUnidadMedida)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
