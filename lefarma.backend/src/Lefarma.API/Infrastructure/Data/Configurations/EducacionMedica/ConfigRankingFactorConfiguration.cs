using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class ConfigRankingFactorConfiguration : IEntityTypeConfiguration<Domain.Entities.EducacionMedica.ConfigRankingFactor>
{
    public void Configure(EntityTypeBuilder<Domain.Entities.EducacionMedica.ConfigRankingFactor> builder)
    {
        builder.ToTable("config_ranking_factores", "educacion_medica");
        builder.HasKey(e => e.IdFactor);

        builder.Property(e => e.IdFactor).HasColumnName("id_factor");
        builder.Property(e => e.IdConfiguracion).HasColumnName("id_configuracion");
        builder.Property(e => e.Clave).HasColumnName("clave").HasMaxLength(50).IsRequired();
        builder.Property(e => e.Grupo).HasColumnName("grupo").HasMaxLength(30);
        builder.Property(e => e.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
        builder.Property(e => e.Descripcion).HasColumnName("descripcion").HasMaxLength(300).IsRequired();
        builder.Property(e => e.Peso).HasColumnName("peso").HasPrecision(5, 2);
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.TipoNormalizacion).HasColumnName("tipo_normalizacion").HasMaxLength(30);
        builder.Property(e => e.ParametrosJson).HasColumnName("parametros_json");

        builder.HasIndex(e => new { e.IdConfiguracion, e.Clave }).IsUnique();

        builder.HasOne(e => e.Configuracion)
            .WithMany(c => c.Factores)
            .HasForeignKey(e => e.IdConfiguracion)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
