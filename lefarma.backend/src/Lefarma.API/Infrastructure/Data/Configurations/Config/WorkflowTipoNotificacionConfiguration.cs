using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config {
    public class WorkflowTipoNotificacionConfiguration : IEntityTypeConfiguration<WorkflowTipoNotificacion>
    {
        public void Configure(EntityTypeBuilder<WorkflowTipoNotificacion> builder)
        {
            builder.ToTable("workflow_tipo_notificacion", "config");
            builder.HasKey(t => t.IdTipo);
            builder.Property(t => t.IdTipo).HasColumnName("id_tipo").ValueGeneratedOnAdd();
            builder.Property(t => t.Codigo).HasColumnName("codigo").HasMaxLength(30).IsRequired();
            builder.Property(t => t.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
            builder.Property(t => t.ColorTema).HasColumnName("color_tema").HasMaxLength(7).IsRequired();
            builder.Property(t => t.ColorClaro).HasColumnName("color_claro").HasMaxLength(7).IsRequired();
            builder.Property(t => t.Icono).HasColumnName("icono").HasMaxLength(10).IsRequired();
            builder.Property(t => t.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.HasIndex(t => t.Codigo).IsUnique();
        }
    }
}
