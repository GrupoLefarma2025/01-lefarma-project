using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class HospitalExtensionConfiguration : IEntityTypeConfiguration<HospitalExtension>
{
    public void Configure(EntityTypeBuilder<HospitalExtension> builder)
    {
        builder.ToTable("hospital_extension", "educacion_medica");
        builder.HasKey(e => e.IdHospitalExtension);

        builder.Property(e => e.IdHospitalExtension).HasColumnName("id_hospital_extension");
        builder.Property(e => e.IdHospital).HasColumnName("id_hospital");
        builder.Property(e => e.Fecha).HasColumnName("fecha");
        builder.Property(e => e.IdTipoGerencia).HasColumnName("id_tipo_gerencia");
        builder.Property(e => e.IdRegion).HasColumnName("id_region");
        builder.Property(e => e.ConSia).HasColumnName("con_sia");
        builder.Property(e => e.NumeroQuirofanos).HasColumnName("numero_quirofanos");
        builder.Property(e => e.EsZonaMetropolitana).HasColumnName("es_zona_metropolitana");

        builder.Property(e => e.AnestesiasTotales).HasColumnName("anestesias_totales").HasPrecision(18, 2);
        builder.Property(e => e.AnestesiasGenerales).HasColumnName("anestesias_generales").HasPrecision(18, 2);
        builder.Property(e => e.AnestesiasRegionales).HasColumnName("anestesias_regionales").HasPrecision(18, 2);
        builder.Property(e => e.AnestesiasEpidurales).HasColumnName("anestesias_epidurales").HasPrecision(18, 2);
        builder.Property(e => e.AnestesiasSubdurales).HasColumnName("anestesias_subdurales").HasPrecision(18, 2);
        builder.Property(e => e.AnestesiasMixtasObesos).HasColumnName("anestesias_mixtas_obesos").HasPrecision(18, 2);
        builder.Property(e => e.AnestesiasMixtasNoObesos).HasColumnName("anestesias_mixtas_no_obesos").HasPrecision(18, 2);

        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasIndex(e => e.IdHospital).IsUnique();
        builder.HasIndex(e => e.IdTipoGerencia);
        builder.HasIndex(e => e.IdRegion);
    }
}
