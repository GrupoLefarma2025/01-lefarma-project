using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh
{
    public class SaldoVacacionesArrastreConfiguration : IEntityTypeConfiguration<SaldoVacacionesArrastre>
    {
        public void Configure(EntityTypeBuilder<SaldoVacacionesArrastre> builder)
        {
            builder.ToTable("saldos_vacaciones_arrastre", "rh");
            builder.HasKey(e => e.IdArrastre);
            builder.Property(e => e.IdArrastre).HasColumnName("id_arrastre").ValueGeneratedOnAdd();

            builder.Property(e => e.IdUsuario).HasColumnName("id_usuario");
            builder.Property(e => e.IdEmpresa).HasColumnName("id_empresa");
            builder.Property(e => e.Descripcion).HasColumnName("descripcion").HasColumnType("nvarchar(200)");
            builder.Property(e => e.FechaCorte).HasColumnName("fecha_corte").HasColumnType("date");
            builder.Property(e => e.DiasTotal).HasColumnName("dias_total").HasColumnType("decimal(9,2)");
            builder.Property(e => e.DiasAplicados).HasColumnName("dias_aplicados").HasColumnType("decimal(9,2)").HasDefaultValue(0m);
            builder.Property(e => e.DiasRestante).HasColumnName("dias_restante").HasColumnType("decimal(9,2)")
                .HasComputedColumnSql("dias_total - dias_aplicados", stored: true);
            builder.Property(e => e.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");
            builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
            builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

            builder.HasIndex(e => new { e.IdUsuario, e.Activo, e.FechaCorte })
                .HasDatabaseName("IX_saldos_vacaciones_arrastre_usuario");
        }
    }
}
