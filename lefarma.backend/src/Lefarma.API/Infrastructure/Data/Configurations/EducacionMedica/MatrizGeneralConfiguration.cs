using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class MatrizGeneralConfiguration : IEntityTypeConfiguration<MatrizGeneral>
{
    public void Configure(EntityTypeBuilder<MatrizGeneral> builder)
    {
        builder.ToTable("matrices_generales", "educacion_medica");
        builder.HasKey(e => e.IdMatrizGeneral);

        builder.Property(e => e.IdMatrizGeneral).HasColumnName("id_matriz_general");
        builder.Property(e => e.IdTipoGerencia).HasColumnName("id_tipo_gerencia");
        builder.Property(e => e.Periodo).HasColumnName("periodo");
        builder.Property(e => e.IdWorkflow).HasColumnName("id_workflow");
        builder.Property(e => e.IdPasoActual).HasColumnName("id_paso_actual");
        builder.Property(e => e.IdEstado).HasColumnName("id_estado");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasIndex(e => new { e.IdTipoGerencia, e.Periodo })
            .IsUnique()
            .HasDatabaseName("UQ_matrices_generales_gerencia_periodo");

        builder.HasOne(e => e.TipoGerencia)
            .WithMany()
            .HasForeignKey(e => e.IdTipoGerencia)
            .HasConstraintName("FK_matrices_generales_tipo_gerencia")
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(e => e.EstadoWorkflow)
            .WithMany()
            .HasForeignKey(e => e.IdEstado)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
