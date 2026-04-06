using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos {
public class EmpresaConfiguration : IEntityTypeConfiguration<Empresa>
    {
        public void Configure(EntityTypeBuilder<Empresa> builder)
        {
            // Tabla
            builder.ToTable("empresas", "catalogos");

            // Clave primaria
            builder.HasKey(e => e.IdEmpresa);
            builder.Property(e => e.IdEmpresa)
                .HasColumnName("id_empresa")
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

            builder.Property(e => e.Clave)
                .HasColumnName("clave")
                .HasMaxLength(50);

            builder.Property(e => e.DescripcionNormalizada)
                .HasColumnName("descripcion_normalizada")
                .HasMaxLength(500);

            builder.Property(e => e.RazonSocial)
                .HasColumnName("razon_social")
                .HasMaxLength(255);

            builder.Property(e => e.RFC)
                .HasColumnName("rfc")
                .HasMaxLength(13);

            builder.Property(e => e.Direccion)
                .HasColumnName("direccion")
                .HasMaxLength(255);

            builder.Property(e => e.Colonia)
                .HasColumnName("colonia")
                .HasMaxLength(100);

            builder.Property(e => e.Ciudad)
                .HasColumnName("ciudad")
                .HasMaxLength(100);

            builder.Property(e => e.Estado)
                .HasColumnName("estado")
                .HasMaxLength(100);

            builder.Property(e => e.CodigoPostal)
                .HasColumnName("codigo_postal")
                .HasMaxLength(10);

            builder.Property(e => e.Telefono)
                .HasColumnName("telefono")
                .HasMaxLength(20);

            builder.Property(e => e.Email)
                .HasColumnName("email")
                .HasMaxLength(100);

            builder.Property(e => e.PaginaWeb)
                .HasColumnName("pagina_web")
                .HasMaxLength(255);

            builder.Property(e => e.NumeroEmpleados)
                .HasColumnName("numero_empleados");

            builder.Property(e => e.Activo)
                .HasColumnName("activo")
                .HasDefaultValue(true);

            builder.Property(e => e.FechaCreacion)
                .HasColumnName("fecha_creacion")
                .HasDefaultValueSql("GETDATE()")
                .IsRequired();

            builder.Property(e => e.FechaModificacion)
                .HasColumnName("fecha_modificacion");

            // Relaciones
            builder.HasMany(e => e.Sucursales)
                .WithOne(s => s.Empresa)
                .HasForeignKey(s => s.IdEmpresa)
                .OnDelete(DeleteBehavior.Restrict);
            //.HasConstraintName("FK_sucursales_empresas");

            builder.HasMany(e => e.Areas)
                .WithOne(a => a.Empresa)
                .HasForeignKey(a => a.IdEmpresa)
                .OnDelete(DeleteBehavior.Restrict);
            //.HasConstraintName("FK_areas_empresas");
        }
    }
}