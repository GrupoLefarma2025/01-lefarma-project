using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class ParametroAnestesiaConfiguration : IEntityTypeConfiguration<ParametroAnestesia>
{
    public void Configure(EntityTypeBuilder<ParametroAnestesia> builder)
    {
        builder.ToTable("parametros_anestesias", "educacion_medica");
        builder.HasKey(e => e.IdParametroAnestesia);

        builder.Property(e => e.IdParametroAnestesia).HasColumnName("id_parametro_anestesia");
        builder.Property(e => e.Anio).HasColumnName("anio");
        builder.Property(e => e.Clave).HasColumnName("clave").HasMaxLength(50).IsRequired();
        builder.Property(e => e.Valor).HasColumnName("valor").HasPrecision(10, 6);
        builder.Property(e => e.Descripcion).HasColumnName("descripcion").HasMaxLength(250);
        builder.Property(e => e.Orden).HasColumnName("orden");
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasIndex(e => new { e.Anio, e.Clave }).IsUnique();
        builder.HasIndex(e => e.Activo);
    }
}
