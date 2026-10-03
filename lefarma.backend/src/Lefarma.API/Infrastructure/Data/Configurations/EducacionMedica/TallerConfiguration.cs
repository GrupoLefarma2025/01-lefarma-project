using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class TallerConfiguration : IEntityTypeConfiguration<Taller>
{
    public void Configure(EntityTypeBuilder<Taller> builder)
    {
        builder.ToTable("talleres", "educacion_medica");
        builder.HasKey(e => e.IdTaller);

        builder.Property(e => e.IdTaller).HasColumnName("id_taller");
        builder.Property(e => e.IdSeleccionHospital).HasColumnName("id_seleccion_hospital");
        builder.Property(e => e.IdHospital).HasColumnName("id_hospital");
        builder.Property(e => e.Region).HasColumnName("region").HasMaxLength(60);
        builder.Property(e => e.EntidadFederativa).HasColumnName("entidad_federativa").HasMaxLength(60);
        builder.Property(e => e.CiudadMunicipio).HasColumnName("ciudad_municipio").HasMaxLength(160);
        builder.Property(e => e.NumeroParticipantes).HasColumnName("numero_participantes");
        builder.Property(e => e.IdEjecutivo).HasColumnName("id_ejecutivo");
        builder.Property(e => e.IdEspecialista).HasColumnName("id_especialista");
        builder.Property(e => e.UnidadMedica).HasColumnName("unidad_medica").HasMaxLength(160);
        builder.Property(e => e.Lugar).HasColumnName("lugar").HasMaxLength(200);
        builder.Property(e => e.FechaTaller).HasColumnName("fecha_taller");
        builder.Property(e => e.HoraTaller).HasColumnName("hora_taller").HasColumnType("time(0)");
        builder.Property(e => e.RequiereEquipoProyeccion).HasColumnName("requiere_equipo_proyeccion");
        builder.Property(e => e.TipoEquipoProyeccion).HasColumnName("tipo_equipo_proyeccion").HasMaxLength(10);
        builder.Property(e => e.Estado).HasColumnName("estado").HasMaxLength(15);
        builder.Property(e => e.Observaciones).HasColumnName("observaciones").HasMaxLength(500);
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");
        builder.Property(e => e.IdMatrizIndividual).HasColumnName("id_matriz_individual");
        builder.Property(e => e.IdMatrizGeneral).HasColumnName("id_matriz_general");

        builder.HasOne<SeleccionHospital>()
            .WithMany()
            .HasForeignKey(e => e.IdSeleccionHospital)
            .HasConstraintName("FK_talleres_seleccion_hospital")
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(e => e.MatrizIndividual)
            .WithMany(m => m.Talleres)
            .HasForeignKey(e => e.IdMatrizIndividual)
            .HasConstraintName("FK_talleres_matriz_individual")
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(e => e.MatrizGeneral)
            .WithMany(m => m.Talleres)
            .HasForeignKey(e => e.IdMatrizGeneral)
            .HasConstraintName("FK_talleres_matriz_general")
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(e => e.IdMatrizIndividual).HasDatabaseName("IX_talleres_id_matriz_individual");
        builder.HasIndex(e => e.IdMatrizGeneral).HasDatabaseName("IX_talleres_id_matriz_general");
    }
}
