using Lefarma.API.Domain.Entities.Configuracion;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Configuracion;

public class ConfigVariableConfiguration : IEntityTypeConfiguration<ConfigVariable>
{
    public void Configure(EntityTypeBuilder<ConfigVariable> builder)
    {
        builder.ToTable("variables", "config");

        builder.HasKey(v => v.IdVariable);
        builder.Property(v => v.IdVariable).HasColumnName("id_variable").ValueGeneratedOnAdd();

        builder.Property(v => v.Clave).HasColumnName("clave").HasMaxLength(200).IsRequired();
        builder.Property(v => v.Nombre).HasColumnName("nombre").HasMaxLength(200).IsRequired();
        builder.Property(v => v.Descripcion).HasColumnName("descripcion").HasMaxLength(1000);
        builder.Property(v => v.TipoDato).HasColumnName("tipo_dato").HasMaxLength(30).IsRequired();

        builder.Property(v => v.ValorJson).HasColumnName("valor_json").HasColumnType("nvarchar(max)").IsRequired();
        builder.Property(v => v.EsquemaJson).HasColumnName("esquema_json").HasColumnType("nvarchar(max)");

        builder.Property(v => v.DisponibleBackend).HasColumnName("disponible_backend").IsRequired();
        builder.Property(v => v.DisponibleFrontend).HasColumnName("disponible_frontend").IsRequired();
        builder.Property(v => v.DisponibleSql).HasColumnName("disponible_sql").IsRequired();
        builder.Property(v => v.DisponibleIntegraciones).HasColumnName("disponible_integraciones").IsRequired();

        builder.Property(v => v.Activo).HasColumnName("activo").IsRequired();
        builder.Property(v => v.FechaCreacion).HasColumnName("fecha_creacion").IsRequired();
        builder.Property(v => v.FechaModificacion).HasColumnName("fecha_modificacion").IsRequired();
        builder.Property(v => v.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(v => v.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        // Control de concurrencia optimista del módulo.
        builder.Property(v => v.Version).HasColumnName("version").HasDefaultValue(0L).IsConcurrencyToken().IsRequired();

        // row_version (ROWVERSION) lo administra SQL Server y no se mapea en EF.

        builder.HasIndex(v => v.Clave)
            .IsUnique()
            .HasDatabaseName("UQ_config_variables_clave");
    }
}
