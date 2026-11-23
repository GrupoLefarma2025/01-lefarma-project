using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh
{
    public class DiaNoHabilConfiguration : IEntityTypeConfiguration<DiaHabil>
    {
        public void Configure(EntityTypeBuilder<DiaHabil> builder)
        {
            builder.ToTable("dias_habiles", "rh");
            builder.HasKey(e => e.IdDiaHabil);
            builder.Property(e => e.IdDiaHabil).HasColumnName("id_dia_habil").ValueGeneratedOnAdd();

            builder.Property(e => e.IdEmpresa).HasColumnName("id_empresa");
            builder.Property(e => e.IdSucursal).HasColumnName("id_sucursal");
            builder.Property(e => e.Anio).HasColumnName("anio");
            builder.Property(e => e.Mes).HasColumnName("mes");
            builder.Property(e => e.Dia).HasColumnName("dia");
            builder.Property(e => e.Fecha).HasColumnName("fecha");
            builder.Property(e => e.Descripcion).HasColumnName("descripcion").HasMaxLength(100).IsRequired(false);
            builder.Property(e => e.ConsumeSaldo).HasColumnName("consume_saldo");
            builder.Property(e => e.PermiteSaldoNegativo).HasColumnName("permite_saldo_negativo");
            builder.Property(e => e.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");

            builder.HasIndex(e => new { e.IdEmpresa, e.IdSucursal, e.Anio }).HasDatabaseName("IX_dias_habiles_empresa_sucursal_anio");
        }
    }
}
