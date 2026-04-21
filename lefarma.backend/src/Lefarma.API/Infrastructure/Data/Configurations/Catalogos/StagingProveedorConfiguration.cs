using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos;

public class StagingProveedorConfiguration : IEntityTypeConfiguration<StagingProveedor>
{
    public void Configure(EntityTypeBuilder<StagingProveedor> builder)
    {
        builder.ToTable("proveedores", "staging");

        builder.HasKey(x => x.IdStaging);
        builder.Property(x => x.IdStaging)
            .HasColumnName("id_staging");

        builder.Property(x => x.IdProveedor)
            .HasColumnName("id_proveedor")
            .IsRequired();

        builder.Property(x => x.RazonSocial)
            .HasColumnName("razon_social")
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(x => x.RazonSocialNormalizada)
            .HasColumnName("razon_social_normalizada")
            .HasMaxLength(255);

        builder.Property(x => x.RFC)
            .HasColumnName("rfc")
            .HasMaxLength(13);

        builder.Property(x => x.CodigoPostal)
            .HasColumnName("codigo_postal")
            .HasMaxLength(10);

        builder.Property(x => x.RegimenFiscalId)
            .HasColumnName("regimen_fiscal_id");

        builder.Property(x => x.UsoCfdi)
            .HasColumnName("uso_cfdi")
            .HasMaxLength(10);

        builder.Property(x => x.SinDatosFiscales)
            .HasColumnName("sin_datos_fiscales");

        builder.Property(x => x.Estatus)
            .HasColumnName("estatus");

        builder.Property(x => x.CambioEstatusPor)
            .HasColumnName("cambio_estatus_por");

        builder.Property(x => x.FechaRegistro)
            .HasColumnName("fecha_registro");

        builder.Property(x => x.FechaModificacion)
            .HasColumnName("fecha_modificacion");

        builder.Property(x => x.FechaStaging)
            .HasColumnName("fecha_staging");

        builder.Property(x => x.EditadoPor)
            .HasColumnName("editado_por");

        builder.HasOne(x => x.Detalle)
            .WithOne(d => d.StagingProveedor)
            .HasForeignKey<StagingProveedorDetalle>(d => d.IdStaging);

        builder.HasMany(x => x.CuentasFormaPago)
            .WithOne(c => c.StagingProveedor)
            .HasForeignKey(c => c.IdStaging);
    }
}
