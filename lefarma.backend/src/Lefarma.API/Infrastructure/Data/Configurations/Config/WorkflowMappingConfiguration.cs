using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config {
    public class WorkflowMappingConfiguration : IEntityTypeConfiguration<WorkflowMapping>
    {
        public void Configure(EntityTypeBuilder<WorkflowMapping> builder)
        {
            builder.ToTable("workflow_mappings", "config");
            builder.HasKey(m => m.IdMapping);
            builder.Property(m => m.IdMapping).HasColumnName("id_mapping").ValueGeneratedOnAdd();
            builder.Property(m => m.CodigoProceso).HasColumnName("codigo_proceso").HasMaxLength(50).IsRequired();
            builder.Property(m => m.IdScopeType).HasColumnName("id_scope_type").IsRequired();
            builder.Property(m => m.ScopeId).HasColumnName("scope_id");
            builder.Property(m => m.IdWorkflow).HasColumnName("id_workflow").IsRequired();
            builder.Property(m => m.PrioridadManual).HasColumnName("prioridad_manual").HasDefaultValue(100);
            builder.Property(m => m.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(m => m.Observaciones).HasColumnName("observaciones").HasMaxLength(255);
            builder.Property(m => m.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");
            builder.Property(m => m.CreadoPor).HasColumnName("creado_por");
            builder.Property(m => m.FechaActualizacion).HasColumnName("fecha_actualizacion");

            builder.HasOne(m => m.ScopeType)
                .WithMany(s => s.Mappings)
                .HasForeignKey(m => m.IdScopeType)
                .HasConstraintName("FK_workflow_mappings_scope_type")
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(m => m.Workflow)
                .WithMany()
                .HasForeignKey(m => m.IdWorkflow)
                .HasConstraintName("FK_workflow_mappings_workflows")
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(m => new { m.CodigoProceso, m.IdScopeType, m.ScopeId });
        }
    }
}
