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
        builder.Property(c => c.Categoria).HasColumnName("categoria").HasMaxLength(10).HasDefaultValue("gasto");
        builder.Property(c => c.TipoComprobante).HasColumnName("tipo_comprobante").HasMaxLength(20).IsRequired();
        builder.Property(c => c.EsCfdi).HasColumnName("es_cfdi").HasDefaultValue(false);
        builder.Property(c => c.UuidCfdi).HasColumnName("uuid_cfdi").HasMaxLength(36);
        builder.Property(c => c.VersionCfdi).HasColumnName("version_cfdi").HasMaxLength(5);
        builder.Property(c => c.Serie).HasColumnName("serie").HasMaxLength(25);
        builder.Property(c => c.FolioCfdi).HasColumnName("folio_cfdi").HasMaxLength(40);
        builder.Property(c => c.FechaEmision).HasColumnName("fecha_emision");
        builder.Property(c => c.RfcEmisor).HasColumnName("rfc_emisor").HasMaxLength(13);
        builder.Property(c => c.NombreEmisor).HasColumnName("nombre_emisor").HasMaxLength(255);
        builder.Property(c => c.RfcReceptor).HasColumnName("rfc_receptor").HasMaxLength(13);
        builder.Property(c => c.NombreReceptor).HasColumnName("nombre_receptor").HasMaxLength(255);
        builder.Property(c => c.UsoCfdi).HasColumnName("uso_cfdi").HasMaxLength(10);
        builder.Property(c => c.MetodoPago).HasColumnName("metodo_pago").HasMaxLength(3);
        builder.Property(c => c.FormaPagoCfdi).HasColumnName("forma_pago_cfdi").HasMaxLength(3);
        builder.Property(c => c.Moneda).HasColumnName("moneda").HasMaxLength(3).HasDefaultValue("MXN");
        builder.Property(c => c.TipoCambio).HasColumnName("tipo_cambio").HasColumnType("decimal(10,6)").HasDefaultValue(1m);
        builder.Property(c => c.Subtotal).HasColumnName("subtotal").HasColumnType("decimal(18,2)").HasDefaultValue(0m);
        builder.Property(c => c.Descuento).HasColumnName("descuento").HasColumnType("decimal(18,2)").HasDefaultValue(0m);
        builder.Property(c => c.TotalIva).HasColumnName("total_iva").HasColumnType("decimal(18,2)").HasDefaultValue(0m);
        builder.Property(c => c.TotalRetenciones).HasColumnName("total_retenciones").HasColumnType("decimal(18,2)").HasDefaultValue(0m);
        builder.Property(c => c.Total).HasColumnName("total").HasColumnType("decimal(18,2)").HasDefaultValue(0m);
        builder.Property(c => c.XmlOriginal).HasColumnName("xml_original").HasColumnType("nvarchar(max)");
        builder.Property(c => c.ReferenciaPago).HasColumnName("referencia_pago").HasMaxLength(100);
        builder.Property(c => c.FechaPago).HasColumnName("fecha_pago");
        builder.Property(c => c.MontoPago).HasColumnName("monto_pago").HasColumnType("decimal(18,2)");
        builder.Property(c => c.Estado).HasColumnName("estado").HasDefaultValue((byte)0);
        builder.Property(c => c.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");
        builder.Property(c => c.FechaModificacion).HasColumnName("fecha_modificacion");

        builder.HasMany(c => c.Conceptos)
            .WithOne(cc => cc.Comprobante)
            .HasForeignKey(cc => cc.IdComprobante)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(c => c.Asignaciones)
            .WithOne(cp => cp.Comprobante)
            .HasForeignKey(cp => cp.IdComprobante)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
