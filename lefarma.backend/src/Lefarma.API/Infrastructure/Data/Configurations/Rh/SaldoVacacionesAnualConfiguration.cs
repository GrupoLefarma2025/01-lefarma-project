using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh
{
    public class SaldoVacacionesAnualConfiguration : IEntityTypeConfiguration<SaldoVacacionesAnual>
    {
        public void Configure(EntityTypeBuilder<SaldoVacacionesAnual> builder)
        {
            builder.ToTable("saldos_vacaciones_anuales", "rh");
            builder.HasKey(e => e.IdSaldo);
            builder.Property(e => e.IdSaldo).HasColumnName("id_saldo").ValueGeneratedOnAdd();

            builder.Property(e => e.IdUsuario).HasColumnName("id_usuario");
            builder.Property(e => e.IdEmpresa).HasColumnName("id_empresa");
            builder.Property(e => e.Anio).HasColumnName("anio");
            builder.Property(e => e.DiasGenerados).HasColumnName("dias_generados").HasColumnType("decimal(5,2)").HasDefaultValue(0m);
            builder.Property(e => e.DiasVencidos).HasColumnName("dias_vencidos").HasColumnType("decimal(5,2)").HasDefaultValue(0m);
            builder.Property(e => e.DiasCompensados).HasColumnName("dias_compensados").HasColumnType("decimal(5,2)").HasDefaultValue(0m);
            builder.Property(e => e.DiasAjustados).HasColumnName("dias_ajustados").HasColumnType("decimal(5,2)").HasDefaultValue(0m);
            builder.Property(e => e.DiasTomados).HasColumnName("dias_tomados").HasColumnType("decimal(5,2)").HasDefaultValue(0m);
            builder.Property(e => e.DiasPendientes).HasColumnName("dias_pendientes").HasColumnType("decimal(5,2)").HasComputedColumnSql("dias_generados + dias_compensados + dias_ajustados - dias_vencidos - dias_tomados", stored: true);
            builder.Property(e => e.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");

            builder.HasIndex(e => new { e.IdEmpresa, e.Anio }).HasDatabaseName("IX_saldos_vacaciones_empresa_anio");
        }
    }
}
