using Lefarma.API.Domain.Entities.Archivos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Archivos;

public class ArchivoConfiguration : IEntityTypeConfiguration<Archivo>
{
    public void Configure(EntityTypeBuilder<Archivo> builder)
    {
        builder.ToTable("Archivos", "archivos");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.EntidadTipo)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(a => a.EntidadId)
            .IsRequired();

        builder.Property(a => a.Carpeta)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(a => a.NombreOriginal)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(a => a.NombreFisico)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(a => a.Extension)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(a => a.TipoMime)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(a => a.TamanoBytes)
            .IsRequired();

        builder.Property(a => a.Metadata)
            .HasColumnType("nvarchar(max)");

        builder.Property(a => a.FechaCreacion)
            .IsRequired();

        builder.Property(a => a.FechaEdicion);

        builder.Property(a => a.UsuarioId);

        builder.Property(a => a.Activo)
            .IsRequired()
            .HasDefaultValue(true);

        builder.HasIndex(a => new { a.EntidadTipo, a.EntidadId })
            .HasDatabaseName("IX_Archivos_Entidad");

        builder.HasIndex(a => a.Carpeta)
            .HasDatabaseName("IX_Archivos_Carpeta");
    }
}
