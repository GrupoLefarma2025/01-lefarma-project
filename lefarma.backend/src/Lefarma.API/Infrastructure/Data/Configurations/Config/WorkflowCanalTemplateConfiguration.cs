using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class WorkflowCanalTemplateConfiguration : IEntityTypeConfiguration<WorkflowCanalTemplate>
    {
        public void Configure(EntityTypeBuilder<WorkflowCanalTemplate> builder)
        {
            builder.ToTable("workflow_canal_templates", "config");
            builder.HasKey(t => t.IdTemplate);
            builder.Property(t => t.IdTemplate).HasColumnName("id_template").ValueGeneratedOnAdd();
            builder.Property(t => t.CodigoCanal).HasColumnName("codigo_canal").HasMaxLength(50).IsRequired();
            builder.Property(t => t.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
            builder.Property(t => t.LayoutHtml).HasColumnName("layout_html").IsRequired();
            builder.Property(t => t.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(t => t.FechaModificacion).HasColumnName("fecha_modificacion")
                .HasDefaultValueSql("getutcdate()");

            builder.HasIndex(t => t.CodigoCanal).IsUnique();
        }
    }
}
