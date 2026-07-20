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
            builder.Property(x => x.CodigoProceso).HasColumnName("codigo_proceso").HasMaxLength(50).IsRequired(false);
            builder.Property(t => t.CodigoCanal).HasColumnName("codigo_canal").HasMaxLength(50).IsRequired();
            builder.Property(t => t.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
            builder.Property(x => x.UrlButton).HasColumnName("url_button").HasMaxLength(200).IsRequired(false);
            builder.Property(t => t.LayoutHtml).HasColumnName("layout_html").IsRequired();
            builder.Property(t => t.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(t => t.FechaModificacion).HasColumnName("fecha_modificacion")
                .HasDefaultValueSql("getutcdate()");

            builder.HasIndex(x => new { x.CodigoCanal, x.CodigoProceso })
                .HasDatabaseName("UX_workflow_canal_templates_canal_proceso")
                .HasFilter("[codigo_proceso] IS NOT NULL");
        }
    }
}
