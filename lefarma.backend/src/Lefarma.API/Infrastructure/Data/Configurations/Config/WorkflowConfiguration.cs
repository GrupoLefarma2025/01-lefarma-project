using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class WorkflowConfiguration : IEntityTypeConfiguration<Workflow>
    {
        public void Configure(EntityTypeBuilder<Workflow> builder)
        {
            builder.ToTable("workflows", "config");
            builder.HasKey(w => w.IdWorkflow);
            builder.Property(w => w.IdWorkflow).HasColumnName("id_workflow").ValueGeneratedOnAdd();
            builder.Property(w => w.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
            builder.Property(w => w.Descripcion).HasColumnName("descripcion").HasMaxLength(255);
            builder.Property(w => w.CodigoProceso).HasColumnName("codigo_proceso").HasMaxLength(50).IsRequired();
            builder.HasIndex(w => w.CodigoProceso).IsUnique();
            builder.Property(w => w.Version).HasColumnName("version").HasDefaultValue(1);
            builder.Property(w => w.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(w => w.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");
            builder.HasMany(w => w.Pasos).WithOne(p => p.Workflow).HasForeignKey(p => p.IdWorkflow).OnDelete(DeleteBehavior.Cascade);
        }
    }
}
