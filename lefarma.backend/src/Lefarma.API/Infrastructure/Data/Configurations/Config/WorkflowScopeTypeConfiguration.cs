using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config {
    public class WorkflowScopeTypeConfiguration : IEntityTypeConfiguration<WorkflowScopeType>
    {
        public void Configure(EntityTypeBuilder<WorkflowScopeType> builder)
        {
            builder.ToTable("workflow_scope_types", "config");
            builder.HasKey(s => s.IdScopeType);
            builder.Property(s => s.IdScopeType).HasColumnName("id_scope_type").ValueGeneratedOnAdd();
            builder.Property(s => s.Codigo).HasColumnName("codigo").HasMaxLength(50).IsRequired();
            builder.Property(s => s.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
            builder.Property(s => s.NivelPrioridad).HasColumnName("nivel_prioridad").IsRequired();
            builder.Property(s => s.Descripcion).HasColumnName("descripcion").HasMaxLength(255);
            builder.Property(s => s.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(s => s.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");
            builder.HasIndex(s => s.Codigo).IsUnique();
        }
    }
}
