using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos;

public class ProveedorFormaPagoCuentaConfiguration : IEntityTypeConfiguration<ProveedorFormaPagoCuenta>
{
    public void Configure(EntityTypeBuilder<ProveedorFormaPagoCuenta> builder)
    {
        builder.ToTable("proveedor_forma_pago_cuentas", "catalogos");

        builder.HasKey(e => e.IdCuen);
        builder.Property(e => e.IdCuen)
            .HasColumnName("id_cuenta")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.IdProveedor)
            .HasColumnName("id_proveedor")
            .IsRequired();

        builder.Property(e => e.IdFormaPago)
            .HasColumnName("id_forma_pago")
            .IsRequired();

        builder.Property(e => e.IdBanco)
            .HasColumnName("id_banco");

        builder.Property(e => e.NumeroCuenta)
            .HasColumnName("numero_cuenta")
            .HasMaxLength(50);

        builder.Property(e => e.Clabe)
            .HasColumnName("clabe")
            .HasMaxLength(34);

        builder.Property(e => e.NumeroTarjeta)
            .HasColumnName("numero_tarjeta")
            .HasMaxLength(20);

        builder.Property(e => e.Beneficiario)
            .HasColumnName("beneficiario")
            .HasMaxLength(255);

        builder.Property(e => e.CorreoNotificacion)
            .HasColumnName("correo_notificacion")
            .HasMaxLength(100);

        builder.Property(e => e.Activo)
            .HasColumnName("activo")
            .HasDefaultValue(true);

        builder.Property(e => e.FechaCreacion)
            .HasColumnName("fecha_creacion")
            .IsRequired()
            .HasDefaultValueSql("GETDATE()");

        builder.Property(e => e.FechaModificacion)
            .HasColumnName("fecha_modificacion")
            .HasDefaultValueSql("GETDATE()");

        builder.HasOne(e => e.Proveedor)
            .WithMany(p => p.CuentasFormaPago)
            .HasForeignKey(e => e.IdProveedor)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.FormaPago)
            .WithMany(fp => fp.ProveedorCuentas)
            .HasForeignKey(e => e.IdFormaPago)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.Banco)
            .WithMany()
            .HasForeignKey(e => e.IdBanco)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
