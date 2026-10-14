using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class TallerMaterialConfiguration : IEntityTypeConfiguration<TallerMaterial>
{
    public void Configure(EntityTypeBuilder<TallerMaterial> builder)
    {
        builder.ToTable("taller_materiales", "educacion_medica");
        builder.HasKey(e => e.IdTallerMaterial);

        builder.Property(e => e.IdTallerMaterial).HasColumnName("id_taller_material");
        builder.Property(e => e.IdTaller).HasColumnName("id_taller");
        builder.Property(e => e.FechaEntrega).HasColumnName("fecha_entrega");
        builder.Property(e => e.CargoPuesto).HasColumnName("cargo_puesto").HasMaxLength(120);
        builder.Property(e => e.NombreProducto).HasColumnName("nombre_producto").HasMaxLength(160);
        builder.Property(e => e.CantidadProducto).HasColumnName("cantidad_producto");
        builder.Property(e => e.IncluyeListaAsistencia).HasColumnName("incluye_lista_asistencia");
        builder.Property(e => e.IncluyeFlayers).HasColumnName("incluye_flayers");
        builder.Property(e => e.IncluyeEquipoComputo).HasColumnName("incluye_equipo_computo");
        builder.Property(e => e.IncluyeProyector).HasColumnName("incluye_proyector");
        builder.Property(e => e.IncluyeDulces).HasColumnName("incluye_dulces");
        builder.Property(e => e.IncluyeModeloAnatomico).HasColumnName("incluye_modelo_anatomico");
        builder.Property(e => e.NombreEjecutivoRecepcion).HasColumnName("nombre_ejecutivo_recepcion").HasMaxLength(200);
        builder.Property(e => e.Observaciones).HasColumnName("observaciones").HasMaxLength(500);
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");
        builder.Property(e => e.FirmaUrl).HasColumnName("firma_url").HasMaxLength(500);
        builder.Property(e => e.FechaRecepcion).HasColumnName("fecha_recepcion");
        builder.Property(e => e.IdUsuarioRecepcion).HasColumnName("id_usuario_recepcion");

        builder.HasOne(e => e.Taller)
            .WithOne(t => t.Material)
            .HasForeignKey<TallerMaterial>(e => e.IdTaller)
            .HasConstraintName("FK_taller_material_taller")
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => e.IdTaller)
            .IsUnique()
            .HasDatabaseName("UQ_taller_material_id_taller");
    }
}
