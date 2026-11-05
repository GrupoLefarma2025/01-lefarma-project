using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class EspecialistaRegionConfiguration : IEntityTypeConfiguration<EspecialistaRegion>
{
    public void Configure(EntityTypeBuilder<EspecialistaRegion> builder)
    {
        builder.ToTable("especialista_region", "educacion_medica");
        builder.HasKey(e => e.IdEspecialistaRegion);

        builder.Property(e => e.IdEspecialistaRegion).HasColumnName("id_especialista_region");
        builder.Property(e => e.IdUsuario).HasColumnName("id_usuario");
        builder.Property(e => e.IdRegionCatalogo).HasColumnName("id_region_catalogo");
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasIndex(e => new { e.IdUsuario, e.IdRegionCatalogo })
            .IsUnique()
            .HasFilter("[activo] = (1)")
            .HasDatabaseName("UX_especialista_region_usuario_region_activo");
        builder.HasIndex(e => e.IdUsuario).HasDatabaseName("IX_especialista_region_usuario");

        builder.HasOne(e => e.Region)
            .WithMany()
            .HasForeignKey(e => e.IdRegionCatalogo)
            .HasConstraintName("FK_especialista_region_region_catalogo")
            .OnDelete(DeleteBehavior.Restrict);
    }
}
