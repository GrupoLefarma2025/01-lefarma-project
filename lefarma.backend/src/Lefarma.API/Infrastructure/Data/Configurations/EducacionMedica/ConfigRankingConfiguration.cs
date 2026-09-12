using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class ConfigRankingConfiguration : IEntityTypeConfiguration<Domain.Entities.EducacionMedica.ConfigRanking>
{
    public void Configure(EntityTypeBuilder<Domain.Entities.EducacionMedica.ConfigRanking> builder)
    {
        builder.ToTable("config_ranking", "educacion_medica");
        builder.HasKey(e => e.IdConfiguracion);

        builder.Property(e => e.IdConfiguracion).HasColumnName("id_configuracion");
        builder.Property(e => e.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
        builder.Property(e => e.Version).HasColumnName("version");
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaVigenciaInicio).HasColumnName("fecha_vigencia_inicio");
        builder.Property(e => e.FechaVigenciaFin).HasColumnName("fecha_vigencia_fin");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasIndex(e => new { e.Nombre, e.Version }).IsUnique();

        builder.HasMany(e => e.Factores)
            .WithOne(f => f.Configuracion)
            .HasForeignKey(f => f.IdConfiguracion)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
