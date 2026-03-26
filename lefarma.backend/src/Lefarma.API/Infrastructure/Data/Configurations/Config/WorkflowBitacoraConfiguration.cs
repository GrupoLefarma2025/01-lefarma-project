using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class WorkflowBitacoraConfiguration : IEntityTypeConfiguration<WorkflowBitacora>
    {
        public void Configure(EntityTypeBuilder<WorkflowBitacora> builder)
        {
            builder.ToTable("workflow_bitacora", "config");
            builder.HasKey(b => b.IdEvento);
            builder.Property(b => b.IdEvento).HasColumnName("id_evento").ValueGeneratedOnAdd();
            builder.Property(b => b.IdOrden).HasColumnName("id_orden");
            builder.Property(b => b.IdWorkflow).HasColumnName("id_workflow");
            builder.Property(b => b.IdPaso).HasColumnName("id_paso");
            builder.Property(b => b.IdAccion).HasColumnName("id_accion");
            builder.Property(b => b.IdUsuario).HasColumnName("id_usuario");
            builder.Property(b => b.Comentario).HasColumnName("comentario").HasMaxLength(500);
            builder.Property(b => b.DatosSnapshot).HasColumnName("datos_snapshot");
            builder.Property(b => b.FechaEvento).HasColumnName("fecha_evento").HasDefaultValueSql("GETDATE()");

            builder.HasIndex(b => b.IdOrden).HasDatabaseName("IX_workflow_bitacora_orden");
            builder.HasIndex(b => b.FechaEvento).HasDatabaseName("IX_workflow_bitacora_fecha");

            builder.HasOne(b => b.Workflow).WithMany().HasForeignKey(b => b.IdWorkflow).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(b => b.Paso).WithMany().HasForeignKey(b => b.IdPaso).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(b => b.Accion).WithMany(a => a.Bitacora).HasForeignKey(b => b.IdAccion).OnDelete(DeleteBehavior.Restrict);
        }
    }
}
