using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class ParametroModuloConfiguration : IEntityTypeConfiguration<ParametroModulo>
{
    public void Configure(EntityTypeBuilder<ParametroModulo> builder)
    {
        builder.ToTable("parametros_modulo", "educacion_medica");
        builder.HasKey(e => e.Clave);

        builder.Property(e => e.Clave).HasColumnName("clave").HasMaxLength(50).IsRequired();
        builder.Property(e => e.Valor).HasColumnName("valor").HasPrecision(10, 2).IsRequired();
        builder.Property(e => e.Descripcion).HasColumnName("descripcion").HasMaxLength(200);
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");
    }
}
