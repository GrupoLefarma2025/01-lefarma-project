using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos {
public class EstatusOrdenConfiguration : IEntityTypeConfiguration<EstatusOrden>
    {
        public void Configure(EntityTypeBuilder<EstatusOrden> builder)
        {
            builder.ToTable("estatus_orden", "catalogos");

            builder.HasKey(e => e.IdEstatusOrden);
            builder.Property(e => e.IdEstatusOrden)
                .HasColumnName("id_estatus_orden")
                .ValueGeneratedNever();

            builder.Property(e => e.Nombre)
                .HasColumnName("nombre")
                .HasMaxLength(100)
                .IsRequired();

            builder.Property(e => e.Descripcion)
                .HasColumnName("descripcion")
                .HasMaxLength(255);

            builder.Property(e => e.SiguienteEstatusId)
                .HasColumnName("siguiente_estatus_id");

            builder.Property(e => e.RequiereAccion)
                .HasColumnName("requiere_accion")
                .HasDefaultValue(false);

            builder.Property(e => e.Activo)
                .HasColumnName("activo")
                .HasDefaultValue(true);

            builder.Property(e => e.FechaCreacion)
                .HasColumnName("fecha_creacion")
                .IsRequired()
                .HasDefaultValueSql("GETDATE()");

            builder.HasOne(e => e.SiguienteEstatus)
                .WithMany()
                .HasForeignKey(e => e.SiguienteEstatusId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
