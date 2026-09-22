using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class RutaVersionConfiguration : IEntityTypeConfiguration<RutaVersion>
{
    public void Configure(EntityTypeBuilder<RutaVersion> builder)
    {
        builder.ToTable("rutas_versiones", "educacion_medica");
        builder.HasKey(e => e.IdRutaVersion);

        builder.Property(e => e.IdRutaVersion).HasColumnName("id_ruta_version");
        builder.Property(e => e.IdSeleccionMensual).HasColumnName("id_seleccion_mensual");
        builder.Property(e => e.Version).HasColumnName("version");
        builder.Property(e => e.IdTipoGerencia).HasColumnName("id_tipo_gerencia");
        builder.Property(e => e.Estado).HasColumnName("estado").HasMaxLength(15).IsRequired();
        builder.Property(e => e.FechaConfirmacion).HasColumnName("fecha_confirmacion");
        builder.Property(e => e.IdWorkflow).HasColumnName("id_workflow");
        builder.Property(e => e.IdPasoActual).HasColumnName("id_paso_actual");
        builder.Property(e => e.IdEstado).HasColumnName("id_estado");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasIndex(e => new { e.IdSeleccionMensual, e.Version })
            .IsUnique()
            .HasDatabaseName("UQ_rutas_versiones_seleccion_version");

        builder.HasOne<SeleccionMensual>()
            .WithMany()
            .HasForeignKey(e => e.IdSeleccionMensual)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.EstadoWorkflow)
            .WithMany()
            .HasForeignKey(e => e.IdEstado)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
