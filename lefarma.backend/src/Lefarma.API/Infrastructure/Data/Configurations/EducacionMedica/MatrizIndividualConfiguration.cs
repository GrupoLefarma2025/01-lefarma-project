using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class MatrizIndividualConfiguration : IEntityTypeConfiguration<MatrizIndividual>
{
    public void Configure(EntityTypeBuilder<MatrizIndividual> builder)
    {
        builder.ToTable("matrices_individuales", "educacion_medica");
        builder.HasKey(e => e.IdMatrizIndividual);

        builder.Property(e => e.IdMatrizIndividual).HasColumnName("id_matriz_individual");
        builder.Property(e => e.IdEquipo).HasColumnName("id_equipo");
        builder.Property(e => e.Periodo).HasColumnName("periodo");
        builder.Property(e => e.Estado).HasColumnName("estado").HasMaxLength(15).IsRequired();
        builder.Property(e => e.FechaGeneracion).HasColumnName("fecha_generacion");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasIndex(e => new { e.IdEquipo, e.Periodo })
            .IsUnique()
            .HasDatabaseName("UQ_matrices_individuales_equipo_periodo");

        builder.HasOne(e => e.Equipo)
            .WithMany()
            .HasForeignKey(e => e.IdEquipo)
            .HasConstraintName("FK_matrices_individuales_equipo")
            .OnDelete(DeleteBehavior.NoAction);
    }
}
