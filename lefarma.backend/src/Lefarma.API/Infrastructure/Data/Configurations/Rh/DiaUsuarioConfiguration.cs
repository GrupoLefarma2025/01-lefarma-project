using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh
{
    public class DiaUsuarioConfiguration : IEntityTypeConfiguration<DiaUsuario>
    {
        public void Configure(EntityTypeBuilder<DiaUsuario> builder)
        {
            builder.ToTable("dias_usuario", "rh");
            builder.HasKey(e => e.IdDiaUsuario);
            builder.Property(e => e.IdDiaUsuario).HasColumnName("id_dia_usuario").ValueGeneratedOnAdd();

            builder.Property(e => e.IdUsuario).HasColumnName("id_usuario");
            builder.Property(e => e.IdEmpresa).HasColumnName("id_empresa");
            builder.Property(e => e.IdSucursal).HasColumnName("id_sucursal");
            builder.Property(e => e.Anio).HasColumnName("anio");
            builder.Property(e => e.Mes).HasColumnName("mes");
            builder.Property(e => e.Dia).HasColumnName("dia");
            builder.Property(e => e.Fecha).HasColumnName("fecha");
            builder.Property(e => e.IdTipoDia).HasColumnName("id_tipo_dia");
            builder.Property(e => e.Origen).HasColumnName("origen").HasMaxLength(50).IsRequired();
            builder.Property(e => e.Estado).HasColumnName("estado").HasMaxLength(20).IsRequired(false);
            builder.Property(e => e.ConsumeSaldo).HasColumnName("consume_saldo").HasDefaultValue(false);
            builder.Property(e => e.IdDiaNoHabil).HasColumnName("id_dia_no_habil").IsRequired(false);
            builder.Property(e => e.Comentarios).HasColumnName("comentarios").HasMaxLength(250).IsRequired(false);
            builder.Property(e => e.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");

            builder.HasOne(e => e.TipoDia)
                .WithMany()
                .HasForeignKey(e => e.IdTipoDia)
                .HasConstraintName("FK_dias_usuario_tipo_dia");

            builder.HasIndex(e => new { e.IdUsuario, e.Anio }).HasDatabaseName("IX_dias_usuario_usuario_anio");
            builder.HasIndex(e => new { e.IdEmpresa, e.IdSucursal }).HasDatabaseName("IX_dias_usuario_empresa_sucursal");
            builder.HasIndex(e => e.IdDiaNoHabil).HasDatabaseName("IX_dias_usuario_dia_no_habil");
        }
    }
}
