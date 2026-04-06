using Lefarma.API.Domain.Entities.Help;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Help;
public class HelpImageConfiguration : IEntityTypeConfiguration<HelpImage>
{
    public void Configure(EntityTypeBuilder<HelpImage> builder)
    {
        builder.ToTable("HelpImages", schema: "help");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        builder.Property(x => x.NombreOriginal)
            .HasColumnName("nombre_original")
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(x => x.NombreArchivo)
            .HasColumnName("nombre_archivo")
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(x => x.RutaRelativa)
            .HasColumnName("ruta_relativa")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(x => x.TamanhoBytes)
            .HasColumnName("tamano_bytes")
            .IsRequired();

        builder.Property(x => x.MimeType)
            .HasColumnName("mime_type")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(x => x.Ancho)
            .HasColumnName("ancho")
            .IsRequired(false);

        builder.Property(x => x.Alto)
            .HasColumnName("alto")
            .IsRequired(false);

        builder.Property(x => x.FechaSubida)
            .HasColumnName("fecha_subida")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(x => x.SubidoPor)
            .HasColumnName("subido_por")
            .HasMaxLength(100);

        // Índices
        builder.HasIndex(x => x.NombreArchivo)
            .HasDatabaseName("IX_HelpImages_nombre_archivo");

        builder.HasIndex(x => x.FechaSubida)
            .IsDescending()
            .HasDatabaseName("IX_HelpImages_fecha_subida");
    }
}
