using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class TipoVisitaConfiguration : IEntityTypeConfiguration<TipoVisita>
{
    public void Configure(EntityTypeBuilder<TipoVisita> builder)
    {
        builder.ToTable("tipo_visita", "educacion_medica");
        builder.HasKey(e => e.IdTipoVisita);

        builder.Property(e => e.IdTipoVisita).HasColumnName("id_tipo_visita");
        builder.Property(e => e.Clave).HasColumnName("clave").HasMaxLength(30).IsRequired();
        builder.Property(e => e.Descripcion).HasColumnName("descripcion").HasMaxLength(100).IsRequired();
        builder.Property(e => e.EsTaller).HasColumnName("es_taller");
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasIndex(e => e.Clave).IsUnique();
    }
}
