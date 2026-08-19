using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh;

public class IncidenciaChecadoConfigConfiguration : IEntityTypeConfiguration<IncidenciaChecadoConfig>
{
    public void Configure(EntityTypeBuilder<IncidenciaChecadoConfig> builder)
    {
        builder.ToTable("incidencias_checado_config", "rh");
        builder.HasKey(t => t.IdConfig);
        builder.Property(t => t.IdConfig).HasColumnName("id_config").ValueGeneratedOnAdd();
        builder.Property(t => t.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
        builder.Property(t => t.NombreNormalizado).HasColumnName("nombre_normalizado").HasMaxLength(100).IsRequired(false);
        builder.Property(t => t.Descripcion).HasColumnName("descripcion").HasMaxLength(500).IsRequired();
        builder.Property(t => t.DescripcionNormalizada).HasColumnName("descripcion_normalizada").HasMaxLength(500).IsRequired(false);
        builder.Property(t => t.TipoIncidencia).HasColumnName("tipo_incidencia").HasMaxLength(50).IsRequired();
        builder.Property(t => t.MinutosMin).HasColumnName("minutos_min");
        builder.Property(t => t.MinutosMax).HasColumnName("minutos_max");
        builder.Property(t => t.CantidadAcumulada).HasColumnName("cantidad_acumulada").IsRequired();
        builder.Property(t => t.Periodo).HasColumnName("periodo").HasMaxLength(20).IsRequired();
        builder.Property(t => t.Prioridad).HasColumnName("prioridad").HasDefaultValue(0);
        builder.Property(t => t.RegistroEntrada).HasColumnName("registro_entrada").HasDefaultValue(false);
        builder.Property(t => t.RegistroSalida).HasColumnName("registro_salida").HasDefaultValue(false);
        builder.Property(t => t.Activo).HasColumnName("activo").HasDefaultValue(true);
        builder.Property(t => t.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");
        builder.Property(t => t.FechaModificacion).HasColumnName("fecha_modificacion").IsRequired(false);
    }
}
