using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config {
public class WorkflowCondicionConfiguration : IEntityTypeConfiguration<WorkflowCondicion>
    {
        public void Configure(EntityTypeBuilder<WorkflowCondicion> builder)
        {
            builder.ToTable("workflow_condiciones", "config");
            builder.HasKey(c => c.IdCondicion);
            builder.Property(c => c.IdCondicion).HasColumnName("id_condicion").ValueGeneratedOnAdd();
            builder.Property(c => c.IdPaso).HasColumnName("id_paso");
            builder.Property(c => c.CampoEvaluacion).HasColumnName("campo_evaluacion").HasMaxLength(50).IsRequired();
            builder.Property(c => c.Operador).HasColumnName("operador").HasMaxLength(10).IsRequired();
            builder.Property(c => c.ValorComparacion).HasColumnName("valor_comparacion").HasMaxLength(100).IsRequired();
            builder.Property(c => c.IdPasoSiCumple).HasColumnName("id_paso_si_cumple");
            builder.Property(c => c.Activo).HasColumnName("activo").HasDefaultValue(true);
        }
    }
}
