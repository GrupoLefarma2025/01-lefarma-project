using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class EmpleadoJefeConfigConfiguration : IEntityTypeConfiguration<EmpleadoJefeConfig>
    {
        public void Configure(EntityTypeBuilder<EmpleadoJefeConfig> builder)
        {
            builder.ToTable("empleado_jefes_config", "config");
            builder.HasKey(e => e.IdConfig);
            builder.Property(e => e.IdConfig).HasColumnName("id_config").ValueGeneratedOnAdd();
            builder.Property(e => e.IdUsuario).HasColumnName("id_usuario");
            builder.Property(e => e.Nivel).HasColumnName("nivel");
            builder.Property(e => e.Aplica).HasColumnName("aplica").HasDefaultValue(true);
            builder.Property(e => e.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
            builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
            builder.HasIndex(e => new { e.IdUsuario, e.Nivel }).IsUnique();
        }
    }
}
