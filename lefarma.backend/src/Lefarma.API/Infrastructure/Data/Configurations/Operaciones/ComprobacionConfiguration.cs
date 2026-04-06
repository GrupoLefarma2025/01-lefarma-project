using Lefarma.API.Domain.Entities.Operaciones;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Operaciones {
public class ComprobacionConfiguration : IEntityTypeConfiguration<Comprobacion>
    {
        public void Configure(EntityTypeBuilder<Comprobacion> builder)
        {
            builder.ToTable("comprobaciones", "operaciones");
            builder.HasKey(c => c.IdComprobacion);
            builder.Property(c => c.IdComprobacion).HasColumnName("id_comprobacion").ValueGeneratedOnAdd();
            builder.Property(c => c.IdOrdenCompra).HasColumnName("id_orden_compra").IsRequired();
            builder.Property(c => c.Tipo).HasColumnName("tipo").HasConversion<int>().IsRequired();
            builder.Property(c => c.Estado).HasColumnName("estado").HasConversion<int>().HasDefaultValue(EstadoComprobacion.Pendiente);
            builder.Property(c => c.Uuid).HasColumnName("uuid").HasMaxLength(36);
            builder.Property(c => c.RfcEmisor).HasColumnName("rfc_emisor").HasMaxLength(13);
            builder.Property(c => c.RfcReceptor).HasColumnName("rfc_receptor").HasMaxLength(13);
            builder.Property(c => c.Subtotal).HasColumnName("subtotal").HasColumnType("decimal(18,2)");
            builder.Property(c => c.TotalIva).HasColumnName("total_iva").HasColumnType("decimal(18,2)");
            builder.Property(c => c.TotalRetenciones).HasColumnName("total_retenciones").HasColumnType("decimal(18,2)");
            builder.Property(c => c.Total).HasColumnName("total").HasColumnType("decimal(18,2)");
            builder.Property(c => c.FechaCfdi).HasColumnName("fecha_cfdi");
            builder.Property(c => c.MontoManual).HasColumnName("monto_manual").HasColumnType("decimal(18,2)");
            builder.Property(c => c.Descripcion).HasColumnName("descripcion").HasMaxLength(500);
            builder.Property(c => c.IdUsuarioSube).HasColumnName("id_usuario_sube").IsRequired();
            builder.Property(c => c.IdUsuarioValida).HasColumnName("id_usuario_valida");
            builder.Property(c => c.MotivoRechazo).HasColumnName("motivo_rechazo").HasMaxLength(500);
            builder.Property(c => c.FechaSubida).HasColumnName("fecha_subida").HasDefaultValueSql("GETDATE()");
            builder.Property(c => c.FechaValidacion).HasColumnName("fecha_validacion");

            builder.HasIndex(c => c.IdOrdenCompra);
            builder.HasIndex(c => c.Uuid).IsUnique().HasFilter("[Uuid] IS NOT NULL");

            builder.HasOne(c => c.OrdenCompra).WithMany(o => o.Comprobaciones).HasForeignKey(c => c.IdOrdenCompra).OnDelete(DeleteBehavior.Cascade);
        }
    }
}
