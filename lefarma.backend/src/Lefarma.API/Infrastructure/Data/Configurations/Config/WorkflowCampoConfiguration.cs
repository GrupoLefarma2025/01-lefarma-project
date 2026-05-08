using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class WorkflowCampoConfiguration : IEntityTypeConfiguration<WorkflowCampo>
    {
        public void Configure(EntityTypeBuilder<WorkflowCampo> builder)
        {
            builder.ToTable("workflow_campos", "config");
            builder.HasKey(c => c.IdWorkflowCampo);
            builder.Property(c => c.IdWorkflowCampo).HasColumnName("id_workflow_campo").ValueGeneratedOnAdd();
            builder.Property(c => c.NombreTecnico).HasColumnName("nombre_tecnico").HasMaxLength(100).IsRequired();
            builder.Property(c => c.EtiquetaUsuario).HasColumnName("etiqueta_usuario").HasMaxLength(120).IsRequired();
            builder.Property(c => c.TipoControl).HasColumnName("tipo_control").HasMaxLength(30).IsRequired();
            builder.Property(c => c.SourceCatalog).HasColumnName("source_catalog").HasMaxLength(120);
            builder.Property(c => c.PropiedadEntidad).HasColumnName("propiedad_entidad").HasMaxLength(100);
            builder.Property(c => c.ValidarFiscal).HasColumnName("validar_fiscal").HasDefaultValue(false);
            builder.Property(c => c.Activo).HasColumnName("activo").HasDefaultValue(true);

            builder.HasIndex(c => c.NombreTecnico)
                .IsUnique()
                .HasDatabaseName("UX_workflow_campos_nombre");
        }
    }
}
