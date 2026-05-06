using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config {
public class WorkflowPasoConfiguration : IEntityTypeConfiguration<WorkflowPaso>
    {
        public void Configure(EntityTypeBuilder<WorkflowPaso> builder)
        {
            builder.ToTable("workflow_pasos", "config");
            builder.HasKey(p => p.IdPaso);
            builder.Property(p => p.IdPaso).HasColumnName("id_paso").ValueGeneratedOnAdd();
            builder.Property(p => p.IdWorkflow).HasColumnName("id_workflow");
            builder.Property(p => p.Orden).HasColumnName("orden");
            builder.Property(p => p.NombrePaso).HasColumnName("nombre_paso").HasMaxLength(100).IsRequired();
            builder.Property(p => p.IdEstado).HasColumnName("id_estado");
            builder.HasOne(p => p.Estado)
                .WithMany()
                .HasForeignKey(p => p.IdEstado)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Property(p => p.DescripcionAyuda).HasColumnName("descripcion_ayuda").HasMaxLength(255);
            builder.Property(p => p.EsInicio).HasColumnName("es_inicio").HasDefaultValue(false);
            builder.Property(p => p.EsFinal).HasColumnName("es_final").HasDefaultValue(false);
            builder.Property(p => p.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(p => p.RequiereFirma).HasColumnName("requiere_firma").HasDefaultValue(false);
            builder.Property(p => p.RequiereComentario).HasColumnName("requiere_comentario").HasDefaultValue(false);
            builder.Property(p => p.RequiereAdjunto).HasColumnName("requiere_adjunto").HasDefaultValue(false);
            builder.Property(p => p.PermiteAdjunto).HasColumnName("permite_adjunto").HasDefaultValue(true);

            builder.HasMany(p => p.AccionesOrigen).WithOne(a => a.PasoOrigen).HasForeignKey(a => a.IdPasoOrigen).OnDelete(DeleteBehavior.Restrict);
            builder.HasMany(p => p.Condiciones).WithOne(c => c.Paso).HasForeignKey(c => c.IdPaso).OnDelete(DeleteBehavior.Cascade);
            builder.HasMany(p => p.Participantes).WithOne(pa => pa.Paso).HasForeignKey(pa => pa.IdPaso).OnDelete(DeleteBehavior.Cascade);
        }
    }
}
