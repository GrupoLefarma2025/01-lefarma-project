using Lefarma.API.Domain.Entities.Operaciones;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Operaciones;

public class ComprobanteConceptoConfiguration : IEntityTypeConfiguration<ComprobanteConcepto>
{
    public void Configure(EntityTypeBuilder<ComprobanteConcepto> builder)
    {
        builder.ToTable("comprobantes_conceptos", "operaciones");
        builder.HasKey(c => c.IdConcepto);
        builder.Property(c => c.IdConcepto).HasColumnName("id_concepto").ValueGeneratedOnAdd();
        builder.Property(c => c.IdComprobante).HasColumnName("id_comprobante").IsRequired();
        builder.Property(c => c.NumeroConcepto).HasColumnName("numero_concepto").IsRequired();
        builder.Property(c => c.ClaveProdServ).HasColumnName("clave_prod_serv").HasMaxLength(10);
        builder.Property(c => c.ClaveUnidad).HasColumnName("clave_unidad").HasMaxLength(10);
        builder.Property(c => c.Descripcion).HasColumnName("descripcion").HasMaxLength(1000).IsRequired();
        builder.Property(c => c.Cantidad).HasColumnName("cantidad").HasColumnType("decimal(18,6)").IsRequired();
        builder.Property(c => c.ValorUnitario).HasColumnName("valor_unitario").HasColumnType("decimal(18,6)").IsRequired();
        builder.Property(c => c.Descuento).HasColumnName("descuento").HasColumnType("decimal(18,2)").HasDefaultValue(0m);
        builder.Property(c => c.Importe).HasColumnName("importe").HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(c => c.TasaIva).HasColumnName("tasa_iva").HasColumnType("decimal(5,4)");
        builder.Property(c => c.ImporteIva).HasColumnName("importe_iva").HasColumnType("decimal(18,2)");
        builder.Property(c => c.CantidadAsignada).HasColumnName("cantidad_asignada").HasColumnType("decimal(18,6)").HasDefaultValue(0m);
        builder.Property(c => c.ImporteAsignado).HasColumnName("importe_asignado").HasColumnType("decimal(18,2)").HasDefaultValue(0m);

        builder.HasIndex(c => new { c.IdComprobante, c.NumeroConcepto })
            .IsUnique()
            .HasDatabaseName("UQ_concepto_por_comprobante");

        builder.HasMany(c => c.Asignaciones)
            .WithOne(cp => cp.Concepto)
            .HasForeignKey(cp => cp.IdConcepto)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
