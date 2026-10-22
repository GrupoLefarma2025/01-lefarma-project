using Lefarma.API.Domain.Entities.Viaticos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Viaticos;

/// <summary>
/// Mapeo de la tabla liga [viaticos].[solicitud_origen_em_visita] (ADR-00014).
/// `id_ruta`/`id_ruta_visita` son referencias lógicas a educacion_medica; no
/// se declara FK física para no acoplar el despliegue de los módulos.
/// </summary>
public class SolicitudOrigenEmVisitaConfiguration : IEntityTypeConfiguration<SolicitudOrigenEmVisita>
{
    public void Configure(EntityTypeBuilder<SolicitudOrigenEmVisita> builder)
    {
        builder.ToTable("solicitud_origen_em_visita", "viaticos");
        builder.HasKey(e => new { e.IdSolicitud, e.IdRutaVisita });

        builder.Property(e => e.IdSolicitud).HasColumnName("id_solicitud");
        builder.Property(e => e.IdRuta).HasColumnName("id_ruta");
        builder.Property(e => e.IdRutaVisita).HasColumnName("id_ruta_visita");
        builder.Property(e => e.IdSeleccionMensual).HasColumnName("id_seleccion_mensual");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");

        builder.HasOne(e => e.Solicitud)
            .WithMany(s => s.OrigenEmVisitas)
            .HasForeignKey(e => e.IdSolicitud)
            .HasConstraintName("FK_solicitud_origen_em_visita_solicitud")
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.IdRuta, e.IdRutaVisita })
            .HasDatabaseName("IX_solicitud_origen_em_visita_ruta");
        builder.HasIndex(e => e.IdSolicitud)
            .HasDatabaseName("IX_solicitud_origen_em_visita_solicitud");
    }
}
