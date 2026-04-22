using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class WorkflowAccionHandlerConfiguration : IEntityTypeConfiguration<WorkflowAccionHandler>
    {
        public void Configure(EntityTypeBuilder<WorkflowAccionHandler> builder)
        {
            builder.ToTable("workflow_accion_handlers", "config");
            builder.HasKey(h => h.IdHandler);
            builder.Property(h => h.IdHandler).HasColumnName("id_handler").ValueGeneratedOnAdd();
            builder.Property(h => h.IdAccion).HasColumnName("id_accion");
            builder.Property(h => h.HandlerKey).HasColumnName("handler_key").HasMaxLength(100).IsRequired();
            builder.Property(h => h.Requerido).HasColumnName("requerido").HasDefaultValue(true);
            builder.Property(h => h.ConfiguracionJson).HasColumnName("configuracion_json").HasColumnType("nvarchar(max)");
            builder.Property(h => h.OrdenEjecucion).HasColumnName("orden_ejecucion").HasDefaultValue(1);
            builder.Property(h => h.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(h => h.IdWorkflowCampo).HasColumnName("id_workflow_campo");

            builder.HasOne(h => h.Accion)
                .WithMany(a => a.AccionHandlers)
                .HasForeignKey(h => h.IdAccion)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(h => h.Campo)
                .WithMany()
                .HasForeignKey(h => h.IdWorkflowCampo)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(h => new { h.IdAccion, h.OrdenEjecucion, h.Activo })
                .HasDatabaseName("IX_workflow_accion_handlers_accion_orden_activo");
        }
    }
}
