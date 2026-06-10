using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh
{
    public class TipoSolicitudesConfiguration : IEntityTypeConfiguration<TipoSolicitud>
    {
        public void Configure(EntityTypeBuilder<TipoSolicitud> builder)
        {
            builder.ToTable("tipo_solicitud", "rh");
            builder.HasKey(t => t.IdTipoSolicitud);
            builder.Property(t => t.IdTipoSolicitud).HasColumnName("id_tipo_solicitud").ValueGeneratedOnAdd();
            builder.Property(t => t.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
            builder.Property(t => t.NombreNormalizado).HasColumnName("nombre_normalizado").HasMaxLength(100).IsRequired(false);
            builder.Property(t => t.Descripcion).HasColumnName("descripcion").HasMaxLength(500).IsRequired();
            builder.Property(t => t.DescripcionNormalizada).HasColumnName("descripcion_normalizada").HasMaxLength(500).IsRequired(false);
            builder.Property(t => t.Clave).HasColumnName("clave").HasMaxLength(50).IsRequired();
            builder.Property(t => t.Categoria).HasColumnName("categoria").HasConversion<int>().IsRequired();
            builder.Property(t => t.RequiereReposicionTiempo).HasColumnName("requiere_reposicion_tiempo").HasDefaultValue(false);
            builder.Property(t => t.RequiereFechaFin).HasColumnName("requiere_fecha_fin").HasDefaultValue(false);
            builder.Property(t => t.RequiereFechaRegreso).HasColumnName("requiere_fecha_regreso").HasDefaultValue(false);
            builder.Property(t => t.RequiereLugarComision).HasColumnName("requiere_lugar_comision").HasDefaultValue(false);
            builder.Property(t => t.DescuentaNomina).HasColumnName("descuenta_nomina").HasDefaultValue(false);
            builder.Property(t => t.DescuentaVacaciones).HasColumnName("descuenta_vacaciones").HasDefaultValue(false);
            builder.Property(t => t.RequiereDocumentacion).HasColumnName("requiere_documentacion").HasDefaultValue(false);
            builder.Property(t => t.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(t => t.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");
            builder.Property(t => t.FechaModificacion).HasColumnName("fecha_modificacion").IsRequired(false);

            builder.HasIndex(t => t.Clave).IsUnique();
        }
    }
}
