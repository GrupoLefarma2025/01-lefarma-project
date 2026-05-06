using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos {
public class CuentaContableConfiguration : IEntityTypeConfiguration<CuentaContable>
    {
        public void Configure(EntityTypeBuilder<CuentaContable> builder)
        {
            builder.ToTable("cuentas_contables", "catalogos");

            builder.HasKey(e => e.IdCuentaContable);
            builder.Property(e => e.IdCuentaContable)
                .HasColumnName("id_cuenta_contable")
                .ValueGeneratedOnAdd();

            builder.Property(e => e.Cuenta)
                .HasColumnName("cuenta")
                .HasMaxLength(20)
                .IsRequired();

            builder.Property(e => e.Descripcion)
                .HasColumnName("descripcion")
                .HasMaxLength(255)
                .IsRequired();

            builder.Property(e => e.DescripcionNormalizada)
                .HasColumnName("descripcion_normalizada")
                .HasMaxLength(255)
                .IsRequired();

            builder.Property(e => e.Nivel1)
                .HasColumnName("nivel1")
                .HasMaxLength(3)
                .IsRequired();

            builder.Property(e => e.Nivel2)
                .HasColumnName("nivel2")
                .HasMaxLength(10)
                .IsRequired();

            //builder.Property(e => e.EmpresaPrefijo)
            //    .HasColumnName("empresa_prefijo")
            //    .HasMaxLength(20);

            builder.Property(e => e.IdEmpresa)
                .HasColumnName("id_empresa");

            builder.Property(e => e.CentroCostoId)
                .HasColumnName("centro_costo_id");

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

            builder.HasOne(e => e.CentroCosto)
                .WithMany()
                .HasForeignKey(e => e.CentroCostoId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(e => e.Empresa)
                .WithMany()
                .HasForeignKey(e => e.IdEmpresa)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
