using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh
{
    public class SaldoVacacionesPeriodoConfiguration : IEntityTypeConfiguration<SaldoVacacionesPeriodo>
    {
        public void Configure(EntityTypeBuilder<SaldoVacacionesPeriodo> builder)
        {
            builder.ToTable("saldos_vacaciones_periodos", "rh", tb => tb.UseSqlOutputClause(false));
            builder.HasKey(e => e.IdSaldo);
            builder.Property(e => e.IdSaldo).HasColumnName("id_saldo").ValueGeneratedOnAdd();

            builder.Property(e => e.IdUsuario).HasColumnName("id_usuario");
            builder.Property(e => e.IdEmpresa).HasColumnName("id_empresa");
            builder.Property(e => e.FechaInicioPeriodo).HasColumnName("fecha_inicio_periodo").HasColumnType("date");
            builder.Property(e => e.FechaFinPeriodo).HasColumnName("fecha_fin_periodo").HasColumnType("date");
            builder.Property(e => e.FechaLimiteDisfrute).HasColumnName("fecha_limite_disfrute").HasColumnType("date");
            builder.Property(e => e.NumeroPeriodo).HasColumnName("numero_periodo");
            builder.Property(e => e.DiasGenerados).HasColumnName("dias_generados").HasColumnType("decimal(5,2)").HasDefaultValue(0m);
            builder.Property(e => e.DiasVencidos).HasColumnName("dias_vencidos").HasColumnType("decimal(5,2)").HasDefaultValue(0m);
            builder.Property(e => e.DiasCompensados).HasColumnName("dias_compensados").HasColumnType("decimal(5,2)").HasDefaultValue(0m);
            builder.Property(e => e.DiasAjustados).HasColumnName("dias_ajustados").HasColumnType("decimal(5,2)").HasDefaultValue(0m);
            builder.Property(e => e.DiasAjustadosArrastre).HasColumnName("dias_ajustados_arrastre").HasColumnType("decimal(5,2)").HasDefaultValue(0m);
            builder.Property(e => e.DiasTomados).HasColumnName("dias_tomados").HasColumnType("decimal(5,2)").HasDefaultValue(0m);
            builder.Property(e => e.DiasPendientes).HasColumnName("dias_pendientes").HasColumnType("decimal(9,2)")
                .HasComputedColumnSql("dias_generados + dias_compensados + dias_ajustados + dias_ajustados_arrastre - dias_vencidos - dias_tomados", stored: true);
            builder.Property(e => e.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");
            builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");
            builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
            builder.Property(e => e.HistorialAjustes).HasColumnName("historial_ajustes").HasColumnType("nvarchar(max)").IsRequired(false);

            builder.HasIndex(e => new { e.IdUsuario, e.FechaInicioPeriodo })
                .IsUnique()
                .HasDatabaseName("UQ_saldos_vacaciones_usuario_periodo");
            builder.HasIndex(e => new { e.IdEmpresa, e.FechaInicioPeriodo })
                .HasDatabaseName("IX_saldos_vacaciones_empresa_periodo");
        }
    }
}
