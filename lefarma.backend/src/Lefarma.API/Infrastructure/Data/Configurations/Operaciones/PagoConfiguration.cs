using Lefarma.API.Domain.Entities.Operaciones;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Operaciones {
public class PagoConfiguration : IEntityTypeConfiguration<Pago>
    {
        public void Configure(EntityTypeBuilder<Pago> builder)
        {
            builder.ToTable("pagos", "operaciones");
            builder.HasKey(p => p.IdPago);
            builder.Property(p => p.IdPago).HasColumnName("id_pago").ValueGeneratedOnAdd();
            builder.Property(p => p.IdOrdenCompra).HasColumnName("id_orden_compra").IsRequired();
            builder.Property(p => p.Monto).HasColumnName("monto").HasColumnType("decimal(18,2)").IsRequired();
            builder.Property(p => p.IdMedioPago).HasColumnName("id_medio_pago").IsRequired();
            builder.Property(p => p.Referencia).HasColumnName("referencia").HasMaxLength(100);
            builder.Property(p => p.Nota).HasColumnName("nota").HasMaxLength(500);
            builder.Property(p => p.Estado).HasColumnName("estado").HasConversion<int>().HasDefaultValue(EstadoPago.Pendiente);
            builder.Property(p => p.IdUsuarioRegistra).HasColumnName("id_usuario_registra").IsRequired();
            builder.Property(p => p.FechaRegistro).HasColumnName("fecha_registro").HasDefaultValueSql("GETDATE()");
            builder.Property(p => p.FechaModificacion).HasColumnName("fecha_modificacion");

            builder.HasIndex(p => p.IdOrdenCompra);

            builder.HasOne(p => p.OrdenCompra).WithMany(o => o.Pagos).HasForeignKey(p => p.IdOrdenCompra).OnDelete(DeleteBehavior.Cascade);
        }
    }
}
