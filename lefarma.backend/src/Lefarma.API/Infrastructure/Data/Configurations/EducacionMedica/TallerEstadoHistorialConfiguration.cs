using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class TallerEstadoHistorialConfiguration : IEntityTypeConfiguration<TallerEstadoHistorial>
{
    public void Configure(EntityTypeBuilder<TallerEstadoHistorial> builder)
    {
        builder.ToTable("taller_estados_historial", "educacion_medica");
        builder.HasKey(e => e.IdHistorial);

        builder.Property(e => e.IdHistorial).HasColumnName("id_historial");
        builder.Property(e => e.IdTaller).HasColumnName("id_taller");
        builder.Property(e => e.EstadoAnterior).HasColumnName("estado_anterior").HasMaxLength(15);
        builder.Property(e => e.EstadoNuevo).HasColumnName("estado_nuevo").HasMaxLength(15);
        builder.Property(e => e.Origen).HasColumnName("origen").HasMaxLength(12);
        builder.Property(e => e.Motivo).HasColumnName("motivo").HasMaxLength(500);
        builder.Property(e => e.IdUsuario).HasColumnName("id_usuario");
        builder.Property(e => e.Fecha).HasColumnName("fecha");
        builder.Property(e => e.DatosJson).HasColumnName("datos_json");

        builder.HasOne(e => e.Taller)
            .WithMany(t => t.EstadosHistorial)
            .HasForeignKey(e => e.IdTaller)
            .HasConstraintName("FK_taller_estados_historial_taller")
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.IdTaller, e.Fecha })
            .HasDatabaseName("IX_taller_estados_historial_taller");
    }
}
