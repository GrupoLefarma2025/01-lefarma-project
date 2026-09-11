using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class SeleccionHospitalConfiguration : IEntityTypeConfiguration<SeleccionHospital>
{
    public void Configure(EntityTypeBuilder<SeleccionHospital> builder)
    {
        builder.ToTable("selecciones_mensuales_hospitales", "educacion_medica");
        builder.HasKey(e => e.IdSeleccionHospital);

        builder.Property(e => e.IdSeleccionHospital).HasColumnName("id_seleccion_hospital");
        builder.Property(e => e.IdSeleccionMensual).HasColumnName("id_seleccion_mensual");
        builder.Property(e => e.IdHospital).HasColumnName("id_hospital");
        builder.Property(e => e.Region).HasColumnName("region").HasMaxLength(60);
        builder.Property(e => e.EntidadFederativa).HasColumnName("entidad_federativa").HasMaxLength(60);
        builder.Property(e => e.CiudadMunicipio).HasColumnName("ciudad_municipio").HasMaxLength(120);
        builder.Property(e => e.IdEjecutivo).HasColumnName("id_ejecutivo");
        builder.Property(e => e.ProductoAPromocionar).HasColumnName("producto_a_promocionar").HasMaxLength(150);
        builder.Property(e => e.Observaciones).HasColumnName("observaciones").HasMaxLength(300);
        builder.Property(e => e.LatitudSnapshot).HasColumnName("latitud_snapshot").HasPrecision(10, 7);
        builder.Property(e => e.LongitudSnapshot).HasColumnName("longitud_snapshot").HasPrecision(10, 7);
        builder.Property(e => e.IdRegion).HasColumnName("id_region");
        builder.Property(e => e.Origen).HasColumnName("origen").HasMaxLength(20);
        builder.Property(e => e.IdRankingEjecucion).HasColumnName("id_ranking_ejecucion");
        builder.Property(e => e.ScoreSugerencia).HasColumnName("score_sugerencia").HasPrecision(5, 2);
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasOne<SeleccionMensual>()
            .WithMany()
            .HasForeignKey(e => e.IdSeleccionMensual)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Ejecucion)
            .WithMany()
            .HasForeignKey(e => e.IdRankingEjecucion)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne<SeleccionRegion>()
            .WithMany()
            .HasForeignKey(e => e.IdRegion)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
