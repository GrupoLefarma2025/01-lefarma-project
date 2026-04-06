using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos {
public class AreaConfiguration : IEntityTypeConfiguration<Area>
    {
        public void Configure(EntityTypeBuilder<Area> builder)
        {
            builder.ToTable("areas", "catalogos");

            builder.HasKey(e => e.IdArea);
            builder.Property(e => e.IdArea)
                .HasColumnName("id_area")
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

            builder.Property(e => e.IdSupervisorResponsable)
                .HasColumnName("id_supervisor_responsable");

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

            builder.HasOne(e => e.Empresa)
            .WithMany(e => e.Areas)
            .HasForeignKey(e => e.IdEmpresa)
            .OnDelete(DeleteBehavior.Cascade);

        }
    }
}