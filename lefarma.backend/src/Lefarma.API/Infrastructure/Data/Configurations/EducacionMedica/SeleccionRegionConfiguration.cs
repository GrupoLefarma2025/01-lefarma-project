using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class SeleccionRegionConfiguration : IEntityTypeConfiguration<SeleccionRegion>
{
    public void Configure(EntityTypeBuilder<SeleccionRegion> builder)
    {
        builder.ToTable("selecciones_regiones", "educacion_medica");
        builder.HasKey(e => e.IdRegion);

        builder.Property(e => e.IdRegion).HasColumnName("id_region");
        builder.Property(e => e.IdSeleccionMensual).HasColumnName("id_seleccion_mensual");
        builder.Property(e => e.Nombre).HasColumnName("nombre").HasMaxLength(80);
        builder.Property(e => e.CentroLatitud).HasColumnName("centro_latitud").HasPrecision(10, 7);
        builder.Property(e => e.CentroLongitud).HasColumnName("centro_longitud").HasPrecision(10, 7);
        builder.Property(e => e.CantidadHospitales).HasColumnName("cantidad_hospitales");
        builder.Property(e => e.Algoritmo).HasColumnName("algoritmo").HasMaxLength(50);
        builder.Property(e => e.FechaCalculo).HasColumnName("fecha_calculo");
        builder.Property(e => e.IdEquipo).HasColumnName("id_equipo");
        builder.Property(e => e.IdRegionCatalogo).HasColumnName("id_region_catalogo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasOne<SeleccionMensual>()
            .WithMany()
            .HasForeignKey(e => e.IdSeleccionMensual)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<EquipoPareo>()
            .WithMany()
            .HasForeignKey(e => e.IdEquipo)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<RegionCatalogo>()
            .WithMany()
            .HasForeignKey(e => e.IdRegionCatalogo)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
