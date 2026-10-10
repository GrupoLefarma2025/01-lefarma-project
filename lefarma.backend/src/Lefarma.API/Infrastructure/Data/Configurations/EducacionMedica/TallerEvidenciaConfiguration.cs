using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class TallerEvidenciaConfiguration : IEntityTypeConfiguration<TallerEvidencia>
{
    public void Configure(EntityTypeBuilder<TallerEvidencia> builder)
    {
        builder.ToTable("taller_evidencias", "educacion_medica");
        builder.HasKey(e => e.IdEvidencia);

        builder.Property(e => e.IdEvidencia).HasColumnName("id_evidencia");
        builder.Property(e => e.IdTaller).HasColumnName("id_taller");
        builder.Property(e => e.TipoEvidencia).HasColumnName("tipo_evidencia").HasMaxLength(10);
        builder.Property(e => e.ArchivoUrl).HasColumnName("archivo_url").HasMaxLength(500);
        builder.Property(e => e.Descripcion).HasColumnName("descripcion").HasMaxLength(300);
        builder.Property(e => e.FechaEvidencia).HasColumnName("fecha_evidencia");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasOne(e => e.Taller)
            .WithMany(t => t.Evidencias)
            .HasForeignKey(e => e.IdTaller)
            .HasConstraintName("FK_taller_evidencia_taller")
            .OnDelete(DeleteBehavior.Cascade);
    }
}
