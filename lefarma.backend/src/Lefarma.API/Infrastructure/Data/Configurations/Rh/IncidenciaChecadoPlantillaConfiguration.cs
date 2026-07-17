using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh;

public class IncidenciaChecadoPlantillaConfiguration : IEntityTypeConfiguration<IncidenciaChecadoPlantilla>
{
    public void Configure(EntityTypeBuilder<IncidenciaChecadoPlantilla> builder)
    {
        builder.ToTable("plantillas_incidencias_checado", "rh");

        builder.HasKey(e => e.IdPlantilla);

        builder.Property(e => e.IdPlantilla)
            .HasColumnName("id_plantilla");

        builder.Property(e => e.Codigo)
            .HasColumnName("codigo")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.Nombre)
            .HasColumnName("nombre")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.CodigoCanal)
            .HasColumnName("codigo_canal")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.Asunto)
            .HasColumnName("asunto")
            .HasMaxLength(500)
            .IsRequired(false);

        builder.Property(e => e.Cuerpo)
            .HasColumnName("cuerpo")
            .IsRequired();

        builder.Property(e => e.EsDefecto)
            .HasColumnName("es_defecto");

        builder.Property(e => e.Activo)
            .HasColumnName("activo");

        builder.Property(e => e.FechaCreacion)
            .HasColumnName("fecha_creacion");

        builder.Property(e => e.FechaModificacion)
            .HasColumnName("fecha_modificacion");

        builder.HasIndex(e => new { e.Codigo, e.CodigoCanal })
            .IsUnique()
            .HasDatabaseName("UX_plantillas_incidencias_checado_codigo_canal");
    }
}
