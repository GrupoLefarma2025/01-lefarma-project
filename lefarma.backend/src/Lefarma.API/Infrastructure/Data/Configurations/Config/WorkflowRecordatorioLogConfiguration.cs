using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class WorkflowRecordatorioLogConfiguration : IEntityTypeConfiguration<WorkflowRecordatorioLog>
    {
        public void Configure(EntityTypeBuilder<WorkflowRecordatorioLog> builder)
        {
            builder.ToTable("workflow_recordatorio_log", "config");
            builder.HasKey(l => l.IdLog);

            builder.Property(l => l.IdLog).HasColumnName("id_log").ValueGeneratedOnAdd();
            builder.Property(l => l.IdRecordatorio).HasColumnName("id_recordatorio");
            builder.Property(l => l.IdUsuario).HasColumnName("id_usuario");
            builder.Property(l => l.IdOrden).HasColumnName("id_orden");
            builder.Property(l => l.OrdenesIncluidas).HasColumnName("ordenes_incluidas");
            builder.Property(l => l.FechaEnvio).HasColumnName("fecha_envio");
            builder.Property(l => l.Canal).HasColumnName("canal").HasMaxLength(20);
            builder.Property(l => l.Estado).HasColumnName("estado").HasMaxLength(20).HasDefaultValue("enviado");
            builder.Property(l => l.DetalleError).HasColumnName("detalle_error").HasMaxLength(500);

            builder.HasOne(l => l.Recordatorio)
                .WithMany(r => r.Logs)
                .HasForeignKey(l => l.IdRecordatorio)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
