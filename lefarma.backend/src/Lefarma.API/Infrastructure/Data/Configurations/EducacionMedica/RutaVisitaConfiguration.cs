using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class RutaVisitaConfiguration : IEntityTypeConfiguration<RutaVisita>
{
    public void Configure(EntityTypeBuilder<RutaVisita> builder)
    {
        builder.ToTable("rutas_visitas", "educacion_medica");
        builder.HasKey(e => e.IdRutaVisita);

        builder.Property(e => e.IdRutaVisita).HasColumnName("id_ruta_visita");
        builder.Property(e => e.IdRuta).HasColumnName("id_ruta");
        builder.Property(e => e.IdSeleccionHospital).HasColumnName("id_seleccion_hospital");
        builder.Property(e => e.IdHospital).HasColumnName("id_hospital");
        builder.Property(e => e.FechaVisita).HasColumnName("fecha_visita");
        // Script 0007 declara orden TINYINT; el entity usa int. La conversion
        // explicita evita InvalidCastException (Byte -> Int32) al materializar.
        builder.Property(e => e.Orden)
            .HasColumnName("orden")
            .HasColumnType("tinyint")
            .HasConversion<byte>();
        builder.Property(e => e.HoraSalida).HasColumnName("hora_salida");
        builder.Property(e => e.HoraLlegada).HasColumnName("hora_llegada");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasOne<Ruta>()
            .WithMany()
            .HasForeignKey(e => e.IdRuta)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<SeleccionHospital>()
            .WithMany()
            .HasForeignKey(e => e.IdSeleccionHospital)
            .OnDelete(DeleteBehavior.Restrict);

        // UN UNIQUE (id_ruta, fecha_visita, orden) y (id_ruta, id_seleccion_hospital)
        // viven en el script 0007; EF los replica para el proveedor InMemory de pruebas.
        builder.HasIndex(e => new { e.IdRuta, e.FechaVisita, e.Orden })
            .IsUnique()
            .HasDatabaseName("UQ_rutas_visitas_orden");

        builder.HasIndex(e => new { e.IdRuta, e.IdSeleccionHospital })
            .IsUnique()
            .HasDatabaseName("UQ_rutas_visitas_hospital");
    }
}
