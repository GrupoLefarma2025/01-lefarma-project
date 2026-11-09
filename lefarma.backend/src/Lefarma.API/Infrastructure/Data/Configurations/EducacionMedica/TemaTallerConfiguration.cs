using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class TemaTallerConfiguration : IEntityTypeConfiguration<TemaTaller>
{
    public void Configure(EntityTypeBuilder<TemaTaller> builder)
    {
        builder.ToTable("tema_taller", "educacion_medica");
        builder.HasKey(e => e.IdTemaTaller);

        builder.Property(e => e.IdTemaTaller).HasColumnName("id_tema_taller");
        builder.Property(e => e.Clave).HasColumnName("clave").HasMaxLength(50).IsRequired();
        builder.Property(e => e.Descripcion).HasColumnName("descripcion").HasMaxLength(150).IsRequired();
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasIndex(e => e.Clave).IsUnique();
    }
}
