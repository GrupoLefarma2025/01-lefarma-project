using Lefarma.API.Domain.Entities.Configuracion;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Configuracion;

public class ConfigVariableBitacoraConfiguration : IEntityTypeConfiguration<ConfigVariableBitacora>
{
    public void Configure(EntityTypeBuilder<ConfigVariableBitacora> builder)
    {
        builder.ToTable("variables_bitacora", "config");

        builder.HasKey(b => b.IdBitacora);
        builder.Property(b => b.IdBitacora).HasColumnName("id_bitacora").ValueGeneratedOnAdd();

        builder.Property(b => b.IdOperacion).HasColumnName("id_operacion").IsRequired();
        builder.Property(b => b.IdVariable).HasColumnName("id_variable").IsRequired();
        builder.Property(b => b.Clave).HasColumnName("clave").HasMaxLength(200).IsRequired();
        builder.Property(b => b.Accion).HasColumnName("accion").HasMaxLength(30).IsRequired();
        builder.Property(b => b.DatosAnterioresJson).HasColumnName("datos_anteriores_json").HasColumnType("nvarchar(max)");
        builder.Property(b => b.DatosNuevosJson).HasColumnName("datos_nuevos_json").HasColumnType("nvarchar(max)").IsRequired();
        builder.Property(b => b.IdBitacoraOrigen).HasColumnName("id_bitacora_origen");
        builder.Property(b => b.IdUsuario).HasColumnName("id_usuario");
        builder.Property(b => b.FechaCreacion).HasColumnName("fecha_creacion").IsRequired();

        builder.HasIndex(b => b.IdOperacion)
            .IsUnique()
            .HasDatabaseName("UQ_config_variables_bitacora_operacion");

        builder.HasIndex(b => new { b.IdVariable, b.IdBitacora })
            .HasDatabaseName("IX_config_variables_bitacora_variable");

        builder.HasOne(b => b.Variable)
            .WithMany(v => v.Bitacora)
            .HasForeignKey(b => b.IdVariable)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
