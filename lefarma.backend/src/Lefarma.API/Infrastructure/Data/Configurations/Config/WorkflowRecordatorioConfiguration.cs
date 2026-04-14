using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class WorkflowRecordatorioConfiguration : IEntityTypeConfiguration<WorkflowRecordatorio>
    {
        public void Configure(EntityTypeBuilder<WorkflowRecordatorio> builder)
        {
            builder.ToTable("workflow_recordatorio", "config");
            builder.HasKey(r => r.IdRecordatorio);

            builder.Property(r => r.IdRecordatorio).HasColumnName("id_recordatorio").ValueGeneratedOnAdd();
            builder.Property(r => r.IdWorkflow).HasColumnName("id_workflow");
            builder.Property(r => r.IdPaso).HasColumnName("id_paso");
            builder.Property(r => r.Nombre).HasColumnName("nombre").HasMaxLength(100);
            builder.Property(r => r.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(r => r.TipoTrigger).HasColumnName("tipo_trigger").HasMaxLength(20).HasDefaultValue("horario");
            builder.Property(r => r.HoraEnvio).HasColumnName("hora_envio");
            builder.Property(r => r.DiasSemana).HasColumnName("dias_semana").HasMaxLength(20);
            builder.Property(r => r.IntervaloHoras).HasColumnName("intervalo_horas");
            builder.Property(r => r.FechaEspecifica).HasColumnName("fecha_especifica");
            builder.Property(r => r.MinOrdenesPendientes).HasColumnName("min_ordenes_pendientes");
            builder.Property(r => r.MinDiasEnPaso).HasColumnName("min_dias_en_paso");
            builder.Property(r => r.MontoMinimo).HasColumnName("monto_minimo").HasColumnType("decimal(18,2)");
            builder.Property(r => r.MontoMaximo).HasColumnName("monto_maximo").HasColumnType("decimal(18,2)");
            builder.Property(r => r.EscalarAJerarquia).HasColumnName("escalar_a_jerarquia").HasDefaultValue(false);
            builder.Property(r => r.DiasParaEscalar).HasColumnName("dias_para_escalar");
            builder.Property(r => r.EnviarAlResponsable).HasColumnName("enviar_al_responsable").HasDefaultValue(true);
            builder.Property(r => r.EnviarEmail).HasColumnName("enviar_email").HasDefaultValue(true);
            builder.Property(r => r.EnviarWhatsapp).HasColumnName("enviar_whatsapp").HasDefaultValue(false);
            builder.Property(r => r.EnviarTelegram).HasColumnName("enviar_telegram").HasDefaultValue(false);
            builder.Property(r => r.FechaCreacion).HasColumnName("fecha_creacion");

            builder.HasOne(r => r.Workflow)
                .WithMany()
                .HasForeignKey(r => r.IdWorkflow)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(r => r.Paso)
                .WithMany()
                .HasForeignKey(r => r.IdPaso)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasMany(r => r.Logs)
                .WithOne(l => l.Recordatorio)
                .HasForeignKey(l => l.IdRecordatorio);

            builder.HasMany(r => r.Canales)
                .WithOne(c => c.Recordatorio)
                .HasForeignKey(c => c.IdRecordatorio);
        }
    }
}
