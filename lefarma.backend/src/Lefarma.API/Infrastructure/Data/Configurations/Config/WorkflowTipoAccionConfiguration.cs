using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class WorkflowTipoAccionConfiguration : IEntityTypeConfiguration<WorkflowTipoAccion>
    {
        public void Configure(EntityTypeBuilder<WorkflowTipoAccion> builder)
        {
            builder.ToTable("workflow_tipos_accion", "config");
            builder.HasKey(e => e.IdTipoAccion);
            builder.Property(e => e.IdTipoAccion).HasColumnName("id_tipo_accion").ValueGeneratedOnAdd();
            builder.Property(e => e.Codigo).HasColumnName("codigo").HasMaxLength(50).IsRequired();
            builder.Property(e => e.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
            builder.Property(e => e.Descripcion).HasColumnName("descripcion").HasMaxLength(255);
            builder.Property(e => e.CambiaEstado).HasColumnName("cambia_estado").HasDefaultValue(true);
            builder.Property(e => e.Activo).HasColumnName("activo").HasDefaultValue(true);

            builder.HasIndex(e => e.Codigo).IsUnique();
        }
    }
}
