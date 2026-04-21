using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos;

public class StagingProveedorFormaPagoCuentaConfiguration : IEntityTypeConfiguration<StagingProveedorFormaPagoCuenta>
{
    public void Configure(EntityTypeBuilder<StagingProveedorFormaPagoCuenta> builder)
    {
        builder.ToTable("proveedor_forma_pago_cuentas", "staging");

        builder.HasKey(x => x.IdStagingCuenta);
        builder.Property(x => x.IdStagingCuenta)
            .HasColumnName("id_staging_cuenta");

        builder.Property(x => x.IdStaging)
            .HasColumnName("id_staging");

        builder.Property(x => x.IdFormaPago)
            .HasColumnName("id_forma_pago");

        builder.Property(x => x.IdBanco)
            .HasColumnName("id_banco");

        builder.Property(x => x.NumeroCuenta)
            .HasColumnName("numero_cuenta")
            .HasMaxLength(50);

        builder.Property(x => x.Clabe)
            .HasColumnName("clabe")
            .HasMaxLength(20);

        builder.Property(x => x.NumeroTarjeta)
            .HasColumnName("numero_tarjeta")
            .HasMaxLength(20);

        builder.Property(x => x.Beneficiario)
            .HasColumnName("beneficiario")
            .HasMaxLength(255);

        builder.Property(x => x.CorreoNotificacion)
            .HasColumnName("correo_notificacion")
            .HasMaxLength(255);

        builder.Property(x => x.Activo)
            .HasColumnName("activo");
    }
}
