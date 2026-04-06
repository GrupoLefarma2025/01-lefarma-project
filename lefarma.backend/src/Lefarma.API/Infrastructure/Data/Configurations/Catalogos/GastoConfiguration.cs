using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos {
public class GastoConfiguration : IEntityTypeConfiguration<Gasto>
    {
        public void Configure(EntityTypeBuilder<Gasto> builder)
        {
            builder.ToTable("gastos", "catalogos");

            builder.HasKey(e => e.IdGasto);
            builder.Property(e => e.IdGasto)
                .HasColumnName("id_gasto")
                .ValueGeneratedOnAdd();

            builder.Property(e => e.Nombre)
                .HasColumnName("nombre")
                .HasMaxLength(255)
                .IsRequired();

            builder.Property(e => e.NombreNormalizado)
                .HasColumnName("nombre_normalizado")
                .HasMaxLength(255)
                .IsRequired();

            builder.Property(e => e.Descripcion)
                .HasColumnName("descripcion")
                .HasMaxLength(500);

            builder.Property(e => e.DescripcionNormalizada)
                .HasColumnName("descripcion_normalizada")
                .HasMaxLength(500);

            builder.Property(e => e.Clave)
                .HasColumnName("clave")
                .HasMaxLength(50);

            builder.Property(e => e.Concepto)
                .HasColumnName("concepto")
                .HasMaxLength(255);

            builder.Property(e => e.Cuenta)
                .HasColumnName("cuenta")
                .HasMaxLength(3);

            builder.Property(e => e.SubCuenta)
                .HasColumnName("sub_cuenta")
                .HasMaxLength(3);

            builder.Property(e => e.Analitica)
                .HasColumnName("analitica")
                .HasMaxLength(3);

            builder.Property(e => e.Integracion)
                .HasColumnName("integracion")
                .HasMaxLength(2);

            builder.Property(e => e.CuentaCatalogo)
                .HasColumnName("cuenta_catalogo")
                .HasMaxLength(255);

            builder.Property(e => e.RequiereComprobacionPago)
                .HasColumnName("requiere_comprobacion_pago")
                .HasDefaultValue(true);

            builder.Property(e => e.RequiereComprobacionGasto)
                .HasColumnName("requiere_comprobacion_gasto")
                .HasDefaultValue(true);

            builder.Property(e => e.PermiteSinDatosFiscales)
                .HasColumnName("permite_sin_datos_fiscales")
                .HasDefaultValue(false);

            builder.Property(e => e.DiasLimiteComprobacion)
                .HasColumnName("dias_limite_comprobacion");

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

        }
    }
}