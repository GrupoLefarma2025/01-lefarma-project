using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class RankingEjecucionHospitalConfiguration : IEntityTypeConfiguration<Domain.Entities.EducacionMedica.RankingEjecucionHospital>
{
    public void Configure(EntityTypeBuilder<Domain.Entities.EducacionMedica.RankingEjecucionHospital> builder)
    {
        builder.ToTable("ranking_ejecucion_hospitales", "educacion_medica");
        builder.HasKey(e => e.IdEjecucionHospital);

        builder.Property(e => e.IdEjecucionHospital).HasColumnName("id_ejecucion_hospital");
        builder.Property(e => e.IdRankingEjecucion).HasColumnName("id_ranking_ejecucion");
        builder.Property(e => e.IdHospital).HasColumnName("id_hospital");
        builder.Property(e => e.Posicion).HasColumnName("posicion");
        builder.Property(e => e.ScoreTotal).HasColumnName("score_total").HasPrecision(5, 2);
        builder.Property(e => e.PorcentajeCompletitud).HasColumnName("porcentaje_completitud").HasPrecision(5, 2);
        builder.Property(e => e.EsTopSugerido).HasColumnName("es_top_sugerido");
        builder.Property(e => e.Decision).HasColumnName("decision").HasMaxLength(25).IsRequired();
        builder.Property(e => e.FactoresJson).HasColumnName("factores_json");

        builder.HasOne(e => e.Ejecucion)
            .WithMany(e => e.Hospitales)
            .HasForeignKey(e => e.IdRankingEjecucion)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.IdRankingEjecucion, e.IdHospital }).IsUnique();
        builder.HasIndex(e => e.IdHospital);
    }
}
