using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class EquipoPareoConfiguration : IEntityTypeConfiguration<EquipoPareo>
{
    public void Configure(EntityTypeBuilder<EquipoPareo> builder)
    {
        builder.ToTable("equipos_pareo", "educacion_medica");
        builder.HasKey(e => e.IdEquipo);

        builder.Property(e => e.IdEquipo).HasColumnName("id_equipo");
        builder.Property(e => e.IdRegion).HasColumnName("id_region").IsRequired();
        builder.Property(e => e.IdEjecutivo).HasColumnName("id_ejecutivo").IsRequired();
        builder.Property(e => e.IdEspecialista).HasColumnName("id_especialista").IsRequired();
        builder.Property(e => e.FechaInicio).HasColumnName("fecha_inicio").IsRequired();
        builder.Property(e => e.FechaFin).HasColumnName("fecha_fin");
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        // Exclusividad de integrantes solo entre equipos activos (regla actual,
        // no historica): indices unicos filtrados que replican los del script 0006.
        builder.HasIndex(e => e.IdEjecutivo)
            .IsUnique()
            .HasFilter("[activo] = 1")
            .HasDatabaseName("UX_equipos_pareo_ejecutivo_activo");

        builder.HasIndex(e => e.IdEspecialista)
            .IsUnique()
            .HasFilter("[activo] = 1")
            .HasDatabaseName("UX_equipos_pareo_especialista_activo");

        // Region fija del equipo (1 equipo = 1 region): FK fisica del script 0006.
        builder.HasOne(e => e.Region)
            .WithMany()
            .HasForeignKey(e => e.IdRegion)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
