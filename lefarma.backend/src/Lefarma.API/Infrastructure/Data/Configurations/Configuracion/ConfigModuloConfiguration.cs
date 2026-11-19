using Lefarma.API.Domain.Entities.Configuracion;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Configuracion;

public class ConfigModuloConfiguration : IEntityTypeConfiguration<ConfigModulo>
{
    public void Configure(EntityTypeBuilder<ConfigModulo> builder)
    {
        builder.ToTable("modulos", "config");

        builder.HasKey(m => m.IdModulo);
        builder.Property(m => m.IdModulo).HasColumnName("id_modulo").ValueGeneratedOnAdd();

        builder.Property(m => m.Clave).HasColumnName("clave").HasMaxLength(50).IsRequired();
        builder.Property(m => m.Nombre).HasColumnName("nombre").HasMaxLength(200).IsRequired();
        builder.Property(m => m.Descripcion).HasColumnName("descripcion").HasMaxLength(1000);
        builder.Property(m => m.Activo).HasColumnName("activo").HasDefaultValue(true).IsRequired();
        builder.Property(m => m.FechaCreacion).HasColumnName("fecha_creacion").IsRequired();
        builder.Property(m => m.FechaModificacion).HasColumnName("fecha_modificacion").IsRequired();
        builder.Property(m => m.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(m => m.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        // row_version (ROWVERSION) lo administra SQL Server y no se mapea en EF.

        builder.HasIndex(m => m.Clave)
            .IsUnique()
            .HasDatabaseName("UQ_config_modulos_clave");
    }
}
