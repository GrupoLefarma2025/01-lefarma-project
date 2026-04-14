using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class WorkflowRecordatorioCanalConfiguration : IEntityTypeConfiguration<WorkflowRecordatorioCanal>
    {
        public void Configure(EntityTypeBuilder<WorkflowRecordatorioCanal> builder)
        {
            builder.ToTable("workflow_recordatorio_canal", "config");
            builder.HasKey(c => c.IdRecordatorioCanal);

            builder.Property(c => c.IdRecordatorioCanal).HasColumnName("id_recordatorio_canal").ValueGeneratedOnAdd();
            builder.Property(c => c.IdRecordatorio).HasColumnName("id_recordatorio");
            builder.Property(c => c.CodigoCanal).HasColumnName("codigo_canal").HasMaxLength(20);
            builder.Property(c => c.AsuntoTemplate).HasColumnName("asunto_template").HasMaxLength(500);
            builder.Property(c => c.CuerpoTemplate).HasColumnName("cuerpo_template");
            builder.Property(c => c.ListadoRowHtml).HasColumnName("listado_row_html");
            builder.Property(c => c.Activo).HasColumnName("activo").HasDefaultValue(true);

            builder.HasIndex(c => new { c.IdRecordatorio, c.Activo })
                .HasDatabaseName("IX_recordatorio_canal_recordatorio");

            builder.HasOne(c => c.Recordatorio)
                .WithMany(r => r.Canales)
                .HasForeignKey(c => c.IdRecordatorio)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
