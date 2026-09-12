using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class RegionCatalogoConfiguration : IEntityTypeConfiguration<RegionCatalogo>
{
    public void Configure(EntityTypeBuilder<RegionCatalogo> builder)
    {
        builder.ToTable("regiones_cat", "educacion_medica");
        builder.HasKey(e => e.IdRegion);

        builder.Property(e => e.IdRegion).HasColumnName("id_region");
        builder.Property(e => e.Nombre).HasColumnName("nombre").HasMaxLength(50);
        builder.Property(e => e.CentroLatitud).HasColumnName("centro_latitud").HasPrecision(9, 6);
        builder.Property(e => e.CentroLongitud).HasColumnName("centro_longitud").HasPrecision(9, 6);
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasIndex(e => e.Nombre).IsUnique();
    }
}
