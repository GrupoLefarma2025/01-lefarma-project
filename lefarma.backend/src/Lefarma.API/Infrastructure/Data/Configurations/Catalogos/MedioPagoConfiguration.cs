using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos {
public class MedioPagoConfiguration : IEntityTypeConfiguration<MedioPago>
    {
        public void Configure(EntityTypeBuilder<MedioPago> builder)
        {
            // Tabla
            builder.ToTable("medios_pago", "catalogos");

            // Clave primaria
            builder.HasKey(e => e.IdMedioPago);
            builder.Property(e => e.IdMedioPago)
                .HasColumnName("id_medio_pago")
                .ValueGeneratedOnAdd();

            // Propiedades requeridas
            builder.Property(e => e.Nombre)
                .HasColumnName("nombre")
                .HasMaxLength(255)
                .IsRequired();

            builder.Property(e => e.NombreNormalizado)
                .HasColumnName("nombre_normalizado")
                .HasMaxLength(255);

            builder.Property(e => e.Descripcion)
                .HasColumnName("descripcion")
                .HasMaxLength(500);

            builder.Property(e => e.DescripcionNormalizada)
                .HasColumnName("descripcion_normalizada")
                .HasMaxLength(500);

            builder.Property(e => e.Clave)
                .HasColumnName("clave")
                .HasMaxLength(50);

            builder.Property(e => e.CodigoSAT)
                .HasColumnName("codigo_sat")
                .HasMaxLength(10);

            builder.Property(e => e.RequiereReferencia)
                .HasColumnName("requiere_referencia")
                .HasDefaultValue(false);

            builder.Property(e => e.RequiereAutorizacion)
                .HasColumnName("requiere_autorizacion")
                .HasDefaultValue(false);

            builder.Property(e => e.LimiteMonto)
                .HasColumnName("limite_monto")
                .HasColumnType("decimal(18,2)");

            builder.Property(e => e.PlazoMaximoDias)
                .HasColumnName("plazo_maximo_dias");

            builder.Property(e => e.Activo)
                .HasColumnName("activo")
                .HasDefaultValue(true);

            builder.Property(e => e.FechaCreacion)
                .HasColumnName("fecha_creacion")
                .HasDefaultValueSql("GETDATE()")
                .IsRequired();

            builder.Property(e => e.FechaModificacion)
                .HasColumnName("fecha_modificacion");

            // Índices para búsqueda optimizada
            builder.HasIndex(e => e.NombreNormalizado)
                .HasDatabaseName("idx_medios_pago_nombre_normalizado");

            builder.HasIndex(e => e.Clave)
                .HasDatabaseName("idx_medios_pago_clave");

            builder.HasIndex(e => e.CodigoSAT)
                .HasDatabaseName("idx_medios_pago_codigo_sat");

            builder.HasIndex(e => e.Activo)
                .HasDatabaseName("idx_medios_pago_activo");
        }
    }
}
