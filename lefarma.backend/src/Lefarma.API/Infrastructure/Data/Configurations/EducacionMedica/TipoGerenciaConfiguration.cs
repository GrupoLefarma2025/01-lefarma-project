using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class TipoGerenciaConfiguration : IEntityTypeConfiguration<TipoGerencia>
{
    public void Configure(EntityTypeBuilder<TipoGerencia> builder)
    {
        builder.ToTable("tipo_gerencia", "educacion_medica");
        builder.HasKey(e => e.IdTipoGerencia);

        builder.Property(e => e.IdTipoGerencia).HasColumnName("id_tipo_gerencia");
        builder.Property(e => e.Descripcion).HasColumnName("descripcion").HasMaxLength(50).IsRequired();
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasIndex(e => e.Descripcion).IsUnique();
    }
}
