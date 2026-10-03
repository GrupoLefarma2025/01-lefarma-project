using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class TallerRecursoConfiguration : IEntityTypeConfiguration<TallerRecurso>
{
    public void Configure(EntityTypeBuilder<TallerRecurso> builder)
    {
        builder.ToTable("taller_recursos", "educacion_medica");
        builder.HasKey(e => e.IdTallerRecurso);

        builder.Property(e => e.IdTallerRecurso).HasColumnName("id_taller_recurso");
        builder.Property(e => e.IdTaller).HasColumnName("id_taller");
        builder.Property(e => e.TipoRecurso).HasColumnName("tipo_recurso").HasMaxLength(15).IsRequired();
        builder.Property(e => e.IdProducto).HasColumnName("id_producto").HasMaxLength(50);
        builder.Property(e => e.Descripcion).HasColumnName("descripcion").HasMaxLength(200);
        builder.Property(e => e.TipoEnvio).HasColumnName("tipo_envio").HasMaxLength(10);
        builder.Property(e => e.Cantidad).HasColumnName("cantidad");
        builder.Property(e => e.CostoUnitario).HasColumnName("costo_unitario").HasColumnType("decimal(18,2)");
        builder.Property(e => e.Subtotal).HasColumnName("subtotal").HasColumnType("decimal(18,2)");
        builder.Property(e => e.Observaciones).HasColumnName("observaciones").HasMaxLength(300);
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasOne(e => e.Taller)
            .WithMany(t => t.Recursos)
            .HasForeignKey(e => e.IdTaller)
            .HasConstraintName("FK_taller_recurso_taller")
            .OnDelete(DeleteBehavior.Cascade);
    }
}
