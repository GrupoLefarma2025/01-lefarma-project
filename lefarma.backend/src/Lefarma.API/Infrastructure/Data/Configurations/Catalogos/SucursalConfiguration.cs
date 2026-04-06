using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos {
public class SucursalConfiguration : IEntityTypeConfiguration<Sucursal>
    {
        public void Configure(EntityTypeBuilder<Sucursal> builder)
        {
            builder.ToTable("sucursales", "catalogos");

            builder.HasKey(e => e.IdSucursal);
            builder.Property(e => e.IdSucursal)
                .HasColumnName("id_sucursal")
                .ValueGeneratedOnAdd();

            builder.Property(e => e.IdEmpresa)
                .HasColumnName("id_empresa")
                .IsRequired();

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

            builder.Property(e => e.ClaveContable)
                .HasColumnName("clave_contable")
                .HasMaxLength(255);

            builder.Property(e => e.Direccion)
                .HasColumnName("direccion")
                .HasMaxLength(255);

            builder.Property(e => e.CodigoPostal)
                .HasColumnName("codigo_postal")
                .HasMaxLength(10);

            builder.Property(e => e.Ciudad)
                .HasColumnName("ciudad")
                .HasMaxLength(100);

            builder.Property(e => e.Estado)
                .HasColumnName("estado")
                .HasMaxLength(100);

            builder.Property(e => e.Telefono)
                .HasColumnName("telefono")
                .HasMaxLength(20);

            builder.Property(e => e.Latitud)
                .HasColumnName("latitud")
                .HasColumnType("decimal(10, 7)");

            builder.Property(e => e.Longitud)
                .HasColumnName("longitud")
                .HasColumnType("decimal(10, 7)");

            builder.Property(e => e.NumeroEmpleados)
                .HasColumnName("numero_empleados");

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

            // Relaciones
            builder.HasOne(e => e.Empresa)
              .WithMany(e => e.Sucursales)
              .HasForeignKey(e => e.IdEmpresa)
              .OnDelete(DeleteBehavior.Restrict);

        }
    }
}