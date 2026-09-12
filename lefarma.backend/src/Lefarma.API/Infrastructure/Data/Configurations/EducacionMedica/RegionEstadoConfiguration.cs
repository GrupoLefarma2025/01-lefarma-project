using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class RegionEstadoConfiguration : IEntityTypeConfiguration<RegionEstado>
{
    public void Configure(EntityTypeBuilder<RegionEstado> builder)
    {
        builder.ToTable("regiones_estados", "educacion_medica");
        builder.HasKey(e => e.IdRegionEstado);

        builder.Property(e => e.IdRegionEstado).HasColumnName("id_region_estado");
        builder.Property(e => e.CodigoEstado).HasColumnName("codigo_estado");
        builder.Property(e => e.IdRegion).HasColumnName("id_region");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasIndex(e => e.CodigoEstado).IsUnique();

        builder.HasOne(e => e.Region)
            .WithMany()
            .HasForeignKey(e => e.IdRegion);
    }
}
