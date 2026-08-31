using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class EmpleadoJefeOverrideConfiguration : IEntityTypeConfiguration<EmpleadoJefeOverride>
    {
        public void Configure(EntityTypeBuilder<EmpleadoJefeOverride> builder)
        {
            builder.ToTable("empleado_jefes_override", "config");
            builder.HasKey(e => e.IdOverride);
            builder.Property(e => e.IdOverride).HasColumnName("id_override").ValueGeneratedOnAdd();
            builder.Property(e => e.IdUsuario).HasColumnName("id_usuario");
            builder.Property(e => e.Nivel).HasColumnName("nivel");
            builder.Property(e => e.IdUsuarioJefe).HasColumnName("id_usuario_jefe");
            builder.Property(e => e.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
            builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
            builder.HasIndex(e => new { e.IdUsuario, e.Nivel }).IsUnique();
        }
    }
}