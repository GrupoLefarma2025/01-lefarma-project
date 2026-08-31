using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh;

public class IncidenciaChecadoNotificacionHistorialConfiguration : IEntityTypeConfiguration<IncidenciaChecadoNotificacionHistorial>
{
    public void Configure(EntityTypeBuilder<IncidenciaChecadoNotificacionHistorial> builder)
    {
        builder.ToTable("incidencias_checado_notificaciones_historial", "rh");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("id");

        builder.Property(e => e.NotificationId).HasColumnName("notification_id");
        builder.Property(e => e.Nomina).HasColumnName("nomina").IsRequired();
        builder.Property(e => e.Nombre).HasColumnName("nombre").HasMaxLength(500);
        builder.Property(e => e.Periodo).HasColumnName("periodo").HasMaxLength(50);
        builder.Property(e => e.FechaInicio).HasColumnName("fecha_inicio").HasColumnType("DATE");
        builder.Property(e => e.FechaFin).HasColumnName("fecha_fin").HasColumnType("DATE");
        builder.Property(e => e.Asunto).HasColumnName("asunto").HasMaxLength(500);
        builder.Property(e => e.Mensaje).HasColumnName("mensaje").HasColumnType("NVARCHAR(MAX)");
        builder.Property(e => e.Canales).HasColumnName("canales").HasMaxLength(500);
        builder.Property(e => e.Exitoso).HasColumnName("exitoso").IsRequired();
        builder.Property(e => e.Error).HasColumnName("error").HasColumnType("NVARCHAR(MAX)");
        builder.Property(e => e.EnviadoPor).HasColumnName("enviado_por");
        builder.Property(e => e.FechaEnvio).HasColumnName("fecha_envio").IsRequired().HasDefaultValueSql("GETDATE()");
    }
}
