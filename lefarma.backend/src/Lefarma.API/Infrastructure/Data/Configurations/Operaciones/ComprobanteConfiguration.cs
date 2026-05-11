using Lefarma.API.Domain.Entities.Operaciones;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Operaciones;

public class ComprobanteConfiguration : IEntityTypeConfiguration<Comprobante>
{
    public void Configure(EntityTypeBuilder<Comprobante> builder)
    {
        builder.ToTable("comprobantes", "operaciones");
        builder.HasKey(c => c.IdComprobante);
        builder.Property(c => c.IdComprobante).HasColumnName("id_comprobante").ValueGeneratedOnAdd();
        builder.Property(c => c.IdEmpresa).HasColumnName("id_empresa").IsRequired();
        builder.Property(c => c.IdUsuarioSubio).HasColumnName("id_usuario_subio").IsRequired();
        builder.Property(c => c.IdPasoWorkflow).HasColumnName("id_paso_workflow");
        builder.Property(c => c.IdMedioPago).HasColumnName("id_medio_pago");
        builder.Property(c => c.Categoria).HasColumnName("categoria").HasMaxLength(10).HasDefaultValue("gasto");
        builder.Property(c => c.TipoComprobante).HasColumnName("tipo_comprobante").HasMaxLength(20).IsRequired();
        builder.Property(c => c.Total).HasColumnName("total").HasColumnType("decimal(18,2)").HasDefaultValue(0m);
        builder.Property(c => c.ReferenciaPago).HasColumnName("referencia_pago").HasMaxLength(100);
        builder.Property(c => c.FechaPago).HasColumnName("fecha_pago");
        builder.Property(c => c.MontoPago).HasColumnName("monto_pago").HasColumnType("decimal(18,2)");
        builder.Property(c => c.DatosAdicionales).HasColumnName("datos_adicionales").HasColumnType("nvarchar(max)");
        builder.Property(c => c.Estado).HasColumnName("estado").HasDefaultValue((byte)0);
        builder.Property(c => c.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");
        builder.Property(c => c.FechaModificacion).HasColumnName("fecha_modificacion");

        builder.HasOne(c => c.MedioPago)
            .WithMany()
            .HasForeignKey(c => c.IdMedioPago)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(c => c.Asignaciones)
            .WithOne(cp => cp.Comprobante)
            .HasForeignKey(cp => cp.IdComprobante)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
