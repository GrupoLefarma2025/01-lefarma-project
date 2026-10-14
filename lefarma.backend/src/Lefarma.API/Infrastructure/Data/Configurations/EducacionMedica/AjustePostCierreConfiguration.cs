using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class AjustePostCierreConfiguration : IEntityTypeConfiguration<AjustePostCierre>
{
    public void Configure(EntityTypeBuilder<AjustePostCierre> builder)
    {
        builder.ToTable("ajustes_post_cierre", "educacion_medica");
        builder.HasKey(e => e.IdAjuste);

        builder.Property(e => e.IdAjuste).HasColumnName("id_ajuste");
        builder.Property(e => e.EntidadTipo).HasColumnName("entidad_tipo").HasMaxLength(20);
        builder.Property(e => e.IdEntidad).HasColumnName("id_entidad");
        builder.Property(e => e.Accion).HasColumnName("accion").HasMaxLength(30);
        builder.Property(e => e.ValoresAntes).HasColumnName("valores_antes");
        builder.Property(e => e.ValoresDespues).HasColumnName("valores_despues");
        builder.Property(e => e.Motivo).HasColumnName("motivo").HasMaxLength(500);
        builder.Property(e => e.IdUsuario).HasColumnName("id_usuario");
        builder.Property(e => e.FechaAjuste).HasColumnName("fecha_ajuste");

        builder.HasIndex(e => new { e.EntidadTipo, e.IdEntidad })
            .HasDatabaseName("IX_ajustes_post_cierre_entidad");
    }
}
