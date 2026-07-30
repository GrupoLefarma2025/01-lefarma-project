using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class WorkflowJefeExcluidoConfiguration : IEntityTypeConfiguration<WorkflowJefeExcluido>
    {
        public void Configure(EntityTypeBuilder<WorkflowJefeExcluido> builder)
        {
            builder.ToTable("workflow_jefes_excluidos", "config");
            builder.HasKey(e => e.IdExclusion);
            builder.Property(e => e.IdExclusion).HasColumnName("id_exclusion").ValueGeneratedOnAdd();
            builder.Property(e => e.IdWorkflow).HasColumnName("id_workflow");
            builder.Property(e => e.IdUsuarioJefe).HasColumnName("id_usuario_jefe");
            builder.Property(e => e.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
            builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
            builder.HasIndex(e => new { e.IdWorkflow, e.IdUsuarioJefe }).IsUnique();
        }
    }
}
