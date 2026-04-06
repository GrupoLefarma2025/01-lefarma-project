using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config {
public class WorkflowNotificacionConfiguration : IEntityTypeConfiguration<WorkflowNotificacion>
    {
        public void Configure(EntityTypeBuilder<WorkflowNotificacion> builder)
        {
            builder.ToTable("workflow_notificaciones", "config");
            builder.HasKey(n => n.IdNotificacion);
            builder.Property(n => n.IdNotificacion).HasColumnName("id_notificacion").ValueGeneratedOnAdd();
            builder.Property(n => n.IdAccion).HasColumnName("id_accion");
            builder.Property(n => n.IdPasoDestino).HasColumnName("id_paso_destino");
            builder.Property(n => n.EnviarEmail).HasColumnName("enviar_email").HasDefaultValue(true);
            builder.Property(n => n.EnviarWhatsapp).HasColumnName("enviar_whatsapp").HasDefaultValue(false);
            builder.Property(n => n.EnviarTelegram).HasColumnName("enviar_telegram").HasDefaultValue(false);
            builder.Property(n => n.AvisarAlCreador).HasColumnName("avisar_al_creador").HasDefaultValue(false);
            builder.Property(n => n.AvisarAlSiguiente).HasColumnName("avisar_al_siguiente").HasDefaultValue(true);
            builder.Property(n => n.AvisarAlAnterior).HasColumnName("avisar_al_anterior").HasDefaultValue(false);
            builder.Property(n => n.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(n => n.AsuntoTemplate).HasColumnName("asunto_template").HasMaxLength(200);
            builder.Property(n => n.CuerpoTemplate).HasColumnName("cuerpo_template").IsRequired();

            builder.HasOne(n => n.PasoDestino)
                .WithMany()
                .HasForeignKey(n => n.IdPasoDestino)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
