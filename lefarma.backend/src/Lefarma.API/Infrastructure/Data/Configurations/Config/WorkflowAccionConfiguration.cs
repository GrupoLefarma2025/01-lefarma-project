using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config {
public class WorkflowAccionConfiguration : IEntityTypeConfiguration<WorkflowAccion>
    {
        public void Configure(EntityTypeBuilder<WorkflowAccion> builder)
        {
            builder.ToTable("workflow_acciones", "config");
            builder.HasKey(a => a.IdAccion);
            builder.Property(a => a.IdAccion).HasColumnName("id_accion").ValueGeneratedOnAdd();
            builder.Property(a => a.IdPasoOrigen).HasColumnName("id_paso_origen");
            builder.Property(a => a.IdPasoDestino).HasColumnName("id_paso_destino");
            builder.Property(a => a.IdTipoAccion).HasColumnName("id_tipo_accion");
            builder.Property(a => a.EnviaConcentrado).HasColumnName("envia_concentrado").HasDefaultValue(false);
            builder.Property(a => a.Activo).HasColumnName("activo").HasDefaultValue(true);

            builder.HasOne(a => a.TipoAccion).WithMany().HasForeignKey(a => a.IdTipoAccion).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(a => a.PasoDestino).WithMany().HasForeignKey(a => a.IdPasoDestino).OnDelete(DeleteBehavior.Restrict).IsRequired(false);
            builder.HasMany(a => a.AccionHandlers).WithOne(h => h.Accion).HasForeignKey(h => h.IdAccion).OnDelete(DeleteBehavior.Cascade);
            builder.HasMany(a => a.Notificaciones).WithOne(n => n.Accion).HasForeignKey(n => n.IdAccion).OnDelete(DeleteBehavior.Cascade);
        }
    }
}
