using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class WorkflowNotificacionesPlantillasConfiguration : IEntityTypeConfiguration<WorkflowNotificacionesPlantillas>
    {
        public void Configure(EntityTypeBuilder<WorkflowNotificacionesPlantillas> builder)
        {
            builder.ToTable("workflow_notificaciones_plantillas", "config");
            builder.HasKey(p => p.IdPlantilla);

            builder.Property(p => p.IdPlantilla).HasColumnName("id_plantilla").ValueGeneratedOnAdd();
            builder.Property(p => p.Nombre).HasColumnName("nombre").HasMaxLength(100);
            builder.Property(p => p.CodigoTipoNotificacion).HasColumnName("codigo_tipo_notificacion").HasMaxLength(50);
            builder.Property(p => p.CodigoCanal).HasColumnName("codigo_canal").HasMaxLength(20);
            builder.Property(p => p.AsuntoTemplate).HasColumnName("asunto_template").HasMaxLength(500);
            builder.Property(p => p.CuerpoTemplate).HasColumnName("cuerpo_template");
            builder.Property(p => p.ListadoRowHtml).HasColumnName("listado_row_html");
            builder.Property(p => p.Activo).HasColumnName("activo").HasDefaultValue(true);
        }
    }
}
