using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh
{
    public class DiaNoHabilConfiguration : IEntityTypeConfiguration<DiaNoHabil>
    {
        public void Configure(EntityTypeBuilder<DiaNoHabil> builder)
        {
            builder.ToTable("dias_no_habiles", "rh");
            builder.HasKey(e => e.IdDiaNoHabil);
            builder.Property(e => e.IdDiaNoHabil).HasColumnName("id_dia_no_habil").ValueGeneratedOnAdd();

            builder.Property(e => e.IdEmpresa).HasColumnName("id_empresa");
            builder.Property(e => e.IdSucursal).HasColumnName("id_sucursal");
            builder.Property(e => e.Anio).HasColumnName("anio");
            builder.Property(e => e.Mes).HasColumnName("mes");
            builder.Property(e => e.Dia).HasColumnName("dia");
            builder.Property(e => e.Fecha).HasColumnName("fecha");
            builder.Property(e => e.Descripcion).HasColumnName("descripcion").HasMaxLength(100).IsRequired(false);
            builder.Property(e => e.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");

            builder.HasIndex(e => new { e.IdEmpresa, e.IdSucursal, e.Anio }).HasDatabaseName("IX_dias_no_habiles_empresa_sucursal_anio");
        }
    }
}
