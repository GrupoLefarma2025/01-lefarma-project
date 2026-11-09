using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class EjecutivoSuplenteConfiguration : IEntityTypeConfiguration<EjecutivoSuplente>
{
    public void Configure(EntityTypeBuilder<EjecutivoSuplente> builder)
    {
        builder.ToTable("ejecutivo_suplente", "educacion_medica");
        builder.HasKey(e => e.IdEjecutivoSuplente);

        builder.Property(e => e.IdEjecutivoSuplente).HasColumnName("id_ejecutivo_suplente");
        builder.Property(e => e.IdUsuario).HasColumnName("id_usuario");
        builder.Property(e => e.IdTipoGerencia).HasColumnName("id_tipo_gerencia");
        builder.Property(e => e.IdRegionCatalogo).HasColumnName("id_region_catalogo");
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasIndex(e => new { e.IdUsuario, e.IdTipoGerencia, e.IdRegionCatalogo })
            .IsUnique()
            .HasFilter("[activo] = (1)")
            .HasDatabaseName("UX_ejecutivo_suplente_usuario_gerencia_region_activo");
        builder.HasIndex(e => e.IdUsuario).HasDatabaseName("IX_ejecutivo_suplente_usuario");
        builder.HasIndex(e => e.IdTipoGerencia).HasDatabaseName("IX_ejecutivo_suplente_gerencia");
        builder.HasIndex(e => e.IdRegionCatalogo).HasDatabaseName("IX_ejecutivo_suplente_region");

        builder.HasOne(e => e.TipoGerencia)
            .WithMany()
            .HasForeignKey(e => e.IdTipoGerencia)
            .HasConstraintName("FK_ejecutivo_suplente_tipo_gerencia")
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.Region)
            .WithMany()
            .HasForeignKey(e => e.IdRegionCatalogo)
            .HasConstraintName("FK_ejecutivo_suplente_region_catalogo")
            .OnDelete(DeleteBehavior.Restrict);
    }
}
