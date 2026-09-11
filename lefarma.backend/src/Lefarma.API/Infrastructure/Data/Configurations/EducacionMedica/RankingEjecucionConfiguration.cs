using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class RankingEjecucionConfiguration : IEntityTypeConfiguration<Domain.Entities.EducacionMedica.RankingEjecucion>
{
    public void Configure(EntityTypeBuilder<Domain.Entities.EducacionMedica.RankingEjecucion> builder)
    {
        builder.ToTable("ranking_ejecuciones", "educacion_medica");
        builder.HasKey(e => e.IdRankingEjecucion);

        builder.Property(e => e.IdRankingEjecucion).HasColumnName("id_ranking_ejecucion");
        builder.Property(e => e.IdSeleccionMensual).HasColumnName("id_seleccion_mensual");
        builder.Property(e => e.IdConfiguracion).HasColumnName("id_configuracion");
        builder.Property(e => e.VersionAlgoritmo).HasColumnName("version_algoritmo").HasMaxLength(20).IsRequired();
        builder.Property(e => e.CantidadSolicitada).HasColumnName("cantidad_solicitada");
        builder.Property(e => e.CantidadCandidatos).HasColumnName("cantidad_candidatos");
        builder.Property(e => e.PesosEfectivosJson).HasColumnName("pesos_efectivos_json");
        builder.Property(e => e.FiltrosJson).HasColumnName("filtros_json");
        builder.Property(e => e.FechaEjecucion).HasColumnName("fecha_ejecucion");
        builder.Property(e => e.IdUsuarioEjecucion).HasColumnName("id_usuario_ejecucion");

        builder.HasOne<Domain.Entities.EducacionMedica.SeleccionMensual>()
            .WithMany()
            .HasForeignKey(e => e.IdSeleccionMensual)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.Configuracion)
            .WithMany()
            .HasForeignKey(e => e.IdConfiguracion)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(e => new { e.IdSeleccionMensual, e.FechaEjecucion });
    }
}
