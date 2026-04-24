using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos;

public class StagingProveedorDetalleConfiguration : IEntityTypeConfiguration<StagingProveedorDetalle>
{
    public void Configure(EntityTypeBuilder<StagingProveedorDetalle> builder)
    {
        builder.ToTable("proveedores_detalles", "staging");

        builder.HasKey(x => x.IdStagingDetalle);
        builder.Property(x => x.IdStagingDetalle)
            .HasColumnName("id_staging_detalle");

        builder.Property(x => x.IdStaging)
            .HasColumnName("id_staging");

        builder.Property(x => x.IdDetalle)
            .HasColumnName("id_detalle");

        builder.Property(x => x.PersonaContactoNombre)
            .HasColumnName("persona_contacto_nombre")
            .HasMaxLength(255);

        builder.Property(x => x.ContactoTelefono)
            .HasColumnName("contacto_telefono")
            .HasMaxLength(50);

        builder.Property(x => x.ContactoEmail)
            .HasColumnName("contacto_email")
            .HasMaxLength(255);

        builder.Property(x => x.Comentario)
            .HasColumnName("comentario");

        builder.Property(x => x.FechaCreacion)
            .HasColumnName("fecha_creacion");

        builder.Property(x => x.FechaModificacion)
            .HasColumnName("fecha_modificacion");

        builder.Property(x => x.CaratulaPath)
            .HasColumnName("caratula_path")
            .HasMaxLength(500);
    }
}
