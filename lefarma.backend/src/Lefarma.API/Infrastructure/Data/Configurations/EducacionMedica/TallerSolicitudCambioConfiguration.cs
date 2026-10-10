using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class TallerSolicitudCambioConfiguration : IEntityTypeConfiguration<TallerSolicitudCambio>
{
    public void Configure(EntityTypeBuilder<TallerSolicitudCambio> builder)
    {
        builder.ToTable("taller_solicitudes_cambio", "educacion_medica");
        builder.HasKey(e => e.IdSolicitud);

        builder.Property(e => e.IdSolicitud).HasColumnName("id_solicitud");
        builder.Property(e => e.IdTaller).HasColumnName("id_taller");
        builder.Property(e => e.Estado).HasColumnName("estado").HasMaxLength(15);
        builder.Property(e => e.DatosJson).HasColumnName("datos_json");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasOne(e => e.Taller)
            .WithMany()
            .HasForeignKey(e => e.IdTaller)
            .HasConstraintName("FK_taller_solicitudes_cambio_taller")
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => e.IdTaller).HasDatabaseName("IX_taller_solicitudes_cambio_taller");
        builder.HasIndex(e => e.Estado).HasDatabaseName("IX_taller_solicitudes_cambio_estado");
    }
}
