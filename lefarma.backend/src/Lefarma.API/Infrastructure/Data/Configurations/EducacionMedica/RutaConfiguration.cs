using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class RutaConfiguration : IEntityTypeConfiguration<Ruta>
{
    public void Configure(EntityTypeBuilder<Ruta> builder)
    {
        builder.ToTable("rutas", "educacion_medica");
        builder.HasKey(e => e.IdRuta);

        builder.Property(e => e.IdRuta).HasColumnName("id_ruta");
        builder.Property(e => e.IdSeleccionMensual).HasColumnName("id_seleccion_mensual");
        builder.Property(e => e.IdEquipo).HasColumnName("id_equipo");
        builder.Property(e => e.Version).HasColumnName("version");
        builder.Property(e => e.Nombre).HasColumnName("nombre").HasMaxLength(80);
        builder.Property(e => e.Estado).HasColumnName("estado").HasMaxLength(15).IsRequired();
        builder.Property(e => e.FechaConfirmacion).HasColumnName("fecha_confirmacion");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasIndex(e => new { e.IdSeleccionMensual, e.Version })
            .HasDatabaseName("IX_rutas_seleccion_version");

        builder.HasOne<SeleccionMensual>()
            .WithMany()
            .HasForeignKey(e => e.IdSeleccionMensual)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<EquipoPareo>()
            .WithMany()
            .HasForeignKey(e => e.IdEquipo)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
