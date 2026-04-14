using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class WorkflowNotificacionCanalConfiguration : IEntityTypeConfiguration<WorkflowNotificacionCanal>
    {
        public void Configure(EntityTypeBuilder<WorkflowNotificacionCanal> builder)
        {
            builder.ToTable("workflow_notificacion_canal", "config");
            builder.HasKey(c => c.IdNotificacionCanal);

            builder.Property(c => c.IdNotificacionCanal).HasColumnName("id_notificacion_canal").ValueGeneratedOnAdd();
            builder.Property(c => c.IdNotificacion).HasColumnName("id_notificacion");
            builder.Property(c => c.CodigoCanal).HasColumnName("codigo_canal").HasMaxLength(20);
            builder.Property(c => c.AsuntoTemplate).HasColumnName("asunto_template").HasMaxLength(500);
            builder.Property(c => c.CuerpoTemplate).HasColumnName("cuerpo_template");
            builder.Property(c => c.ListadoRowHtml).HasColumnName("listado_row_html");
            builder.Property(c => c.Activo).HasColumnName("activo").HasDefaultValue(true);

            builder.HasIndex(c => new { c.IdNotificacion, c.CodigoCanal })
                .HasDatabaseName("UQ_notificacion_canal")
                .IsUnique();

            builder.HasOne(c => c.Notificacion)
                .WithMany(n => n.Canales)
                .HasForeignKey(c => c.IdNotificacion)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
