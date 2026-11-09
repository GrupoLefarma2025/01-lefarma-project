using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class EspecialistaGerenciaConfiguration : IEntityTypeConfiguration<EspecialistaGerencia>
{
    public void Configure(EntityTypeBuilder<EspecialistaGerencia> builder)
    {
        builder.ToTable("especialista_gerencia", "educacion_medica");
        builder.HasKey(e => e.IdEspecialistaGerencia);

        builder.Property(e => e.IdEspecialistaGerencia).HasColumnName("id_especialista_gerencia");
        builder.Property(e => e.IdUsuario).HasColumnName("id_usuario");
        builder.Property(e => e.IdTipoGerencia).HasColumnName("id_tipo_gerencia");
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasIndex(e => new { e.IdUsuario, e.IdTipoGerencia })
            .IsUnique()
            .HasFilter("[activo] = (1)")
            .HasDatabaseName("UX_especialista_gerencia_usuario_gerencia_activo");
        builder.HasIndex(e => e.IdUsuario).HasDatabaseName("IX_especialista_gerencia_usuario");
        builder.HasIndex(e => e.IdTipoGerencia).HasDatabaseName("IX_especialista_gerencia_gerencia");

        builder.HasOne(e => e.TipoGerencia)
            .WithMany()
            .HasForeignKey(e => e.IdTipoGerencia)
            .HasConstraintName("FK_especialista_gerencia_tipo_gerencia")
            .OnDelete(DeleteBehavior.Restrict);
    }
}
