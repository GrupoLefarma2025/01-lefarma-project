using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class SeleccionMensualConfiguration : IEntityTypeConfiguration<SeleccionMensual>
{
    public void Configure(EntityTypeBuilder<SeleccionMensual> builder)
    {
        builder.ToTable("selecciones_mensuales", "educacion_medica");
        builder.HasKey(e => e.IdSeleccionMensual);

        builder.Property(e => e.IdSeleccionMensual).HasColumnName("id_seleccion_mensual");
        builder.Property(e => e.FechaSeleccion).HasColumnName("fecha_seleccion");
        builder.Property(e => e.IdTipoGerencia).HasColumnName("id_tipo_gerencia");
        builder.Property(e => e.FechaInicioVigencia).HasColumnName("fecha_inicio_vigencia");
        builder.Property(e => e.FechaFinVigencia).HasColumnName("fecha_fin_vigencia");
        builder.Property(e => e.TalleresObjetivoMes).HasColumnName("talleres_objetivo_mes");
        builder.Property(e => e.Estado).HasColumnName("estado").HasMaxLength(15).IsRequired();
        builder.Property(e => e.FirmaGvFecha).HasColumnName("firma_gv_fecha");
        builder.Property(e => e.FirmaGgFecha).HasColumnName("firma_gg_fecha");
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasOne<TipoGerencia>()
            .WithMany()
            .HasForeignKey(e => e.IdTipoGerencia)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
