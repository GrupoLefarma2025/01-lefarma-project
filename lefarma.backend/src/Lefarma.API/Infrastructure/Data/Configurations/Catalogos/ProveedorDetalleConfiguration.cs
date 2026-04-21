using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos;

public class ProveedorDetalleConfiguration : IEntityTypeConfiguration<ProveedorDetalle>
{
    public void Configure(EntityTypeBuilder<ProveedorDetalle> builder)
    {
        builder.ToTable("proveedores_detalle", "catalogos");

        builder.HasKey(e => e.IdDetalle);
        builder.Property(e => e.IdDetalle)
            .HasColumnName("id_detalle")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.IdProveedor)
            .HasColumnName("id_proveedor")
            .IsRequired();

        builder.Property(e => e.PersonaContactoNombre)
            .HasColumnName("persona_contacto_nombre")
            .HasMaxLength(255);

        builder.Property(e => e.ContactoTelefono)
            .HasColumnName("contacto_telefono")
            .HasMaxLength(20);

        builder.Property(e => e.ContactoEmail)
            .HasColumnName("contacto_email")
            .HasMaxLength(255);

        builder.Property(e => e.Comentario)
            .HasColumnName("comentario")
            .HasColumnType("nvarchar(max)");

        builder.Property(e => e.CaratulaPath)
            .HasColumnName("caratula_path")
            .HasMaxLength(500);

        builder.Property(e => e.FechaCreacion)
            .HasColumnName("fecha_creacion")
            .IsRequired()
            .HasDefaultValueSql("GETDATE()");

        builder.Property(e => e.FechaModificacion)
            .HasColumnName("fecha_modificacion")
            .HasDefaultValueSql("GETDATE()");
    }
}
