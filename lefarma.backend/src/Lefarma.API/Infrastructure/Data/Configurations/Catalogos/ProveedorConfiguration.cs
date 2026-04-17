using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos;

public class ProveedorConfiguration : IEntityTypeConfiguration<Proveedor>
{
    public void Configure(EntityTypeBuilder<Proveedor> builder)
    {
        builder.ToTable("proveedores", "catalogos");

        builder.HasKey(e => e.IdProveedor);
        builder.Property(e => e.IdProveedor)
            .HasColumnName("id_proveedor")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.RazonSocial)
            .HasColumnName("razon_social")
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(e => e.RazonSocialNormalizada)
            .HasColumnName("razon_social_normalizada")
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(e => e.RFC)
            .HasColumnName("rfc")
            .HasMaxLength(13);

        builder.Property(e => e.CodigoPostal)
            .HasColumnName("codigo_postal")
            .HasMaxLength(10);

        builder.Property(e => e.RegimenFiscalId)
            .HasColumnName("regimen_fiscal_id");

        builder.Property(e => e.UsoCfdi)
            .HasColumnName("uso_cfdi")
            .HasMaxLength(10);

        builder.Property(e => e.SinDatosFiscales)
            .HasColumnName("sin_datos_fiscales")
            .HasDefaultValue(false);

        builder.Property(e => e.Estatus)
            .HasColumnName("estatus")
            .IsRequired()
            .HasDefaultValue(1);

        builder.Property(e => e.CambioEstatusPor)
            .HasColumnName("cambio_estatus_por");

        builder.Property(e => e.FechaRegistro)
            .HasColumnName("fecha_registro")
            .IsRequired()
            .HasDefaultValueSql("GETDATE()");

        builder.Property(e => e.FechaModificacion)
            .HasColumnName("fecha_modificacion")
            .HasDefaultValueSql("GETDATE()");

        builder.HasOne(e => e.RegimenFiscal)
            .WithMany()
            .HasForeignKey(e => e.RegimenFiscalId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(e => e.CuentasFormaPago)
            .WithOne(c => c.Proveedor)
            .HasForeignKey(c => c.IdProveedor)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Detalle)
            .WithOne(d => d.Proveedor)
            .HasForeignKey<ProveedorDetalle>(d => d.IdProveedor)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => e.RFC).IsUnique();
    }
}
