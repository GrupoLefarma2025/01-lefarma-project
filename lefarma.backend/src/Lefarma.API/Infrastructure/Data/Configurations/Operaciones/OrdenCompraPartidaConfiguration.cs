using Lefarma.API.Domain.Entities.Operaciones;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Operaciones {
public class OrdenCompraPartidaConfiguration : IEntityTypeConfiguration<OrdenCompraPartida>
    {
        public void Configure(EntityTypeBuilder<OrdenCompraPartida> builder)
        {
            builder.ToTable("ordenes_compra_partidas", "operaciones");
            builder.HasKey(p => p.IdPartida);
            builder.Property(p => p.IdPartida).HasColumnName("id_partida").ValueGeneratedOnAdd();
            builder.Property(p => p.IdOrden).HasColumnName("id_orden");
            builder.Property(p => p.NumeroPartida).HasColumnName("numero_partida");
            builder.Property(p => p.Descripcion).HasColumnName("descripcion").HasMaxLength(500).IsRequired();
            builder.Property(p => p.Cantidad).HasColumnName("cantidad").HasColumnType("decimal(18,2)");
            builder.Property(p => p.IdUnidadMedida).HasColumnName("id_unidad_medida");
            builder.Property(p => p.PrecioUnitario).HasColumnName("precio_unitario").HasColumnType("decimal(18,2)");
            builder.Property(p => p.Descuento).HasColumnName("descuento").HasColumnType("decimal(18,2)").HasDefaultValue(0);
            builder.Property(p => p.PorcentajeIva).HasColumnName("porcentaje_iva").HasColumnType("decimal(5,2)").HasDefaultValue(16);
            builder.Property(p => p.TotalRetenciones).HasColumnName("total_retenciones").HasColumnType("decimal(18,2)").HasDefaultValue(0);
            builder.Property(p => p.OtrosImpuestos).HasColumnName("otros_impuestos").HasColumnType("decimal(18,2)").HasDefaultValue(0);
            builder.Property(p => p.Deducible).HasColumnName("deducible").HasDefaultValue(true);
            builder.Property(p => p.Total).HasColumnName("total").HasColumnType("decimal(18,2)");
        }
    }
}
