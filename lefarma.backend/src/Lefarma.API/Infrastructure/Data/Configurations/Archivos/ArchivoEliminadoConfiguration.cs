using Lefarma.API.Domain.Entities.Archivos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Archivos;
public class ArchivoEliminadoConfiguration : IEntityTypeConfiguration<ArchivoEliminado>
{
    public void Configure(EntityTypeBuilder<ArchivoEliminado> builder)
    {
        builder.ToTable("ArchivosEliminados", "archivos");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.IdArchivo)
            .IsRequired();

        builder.Property(e => e.EntidadTipo)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(e => e.EntidadId)
            .IsRequired();

        builder.Property(e => e.Carpeta)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(e => e.NombreOriginal)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(e => e.NombreFisico)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(e => e.Extension)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(e => e.TipoMime)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(e => e.TamanoBytes)
            .IsRequired();

        builder.Property(e => e.HashSha256)
            .HasMaxLength(64);

        builder.Property(e => e.RutaHistorica)
            .HasMaxLength(400);

        builder.Property(e => e.Metadata)
            .HasColumnType("nvarchar(max)");

        builder.Property(e => e.FechaEliminacion)
            .IsRequired(false);

        builder.Property(e => e.Motivo)
            .IsRequired()
            .HasMaxLength(20);

        builder.HasIndex(e => e.IdArchivo)
            .HasDatabaseName("IX_ArchivosEliminados_IdArchivo");
    }
}
