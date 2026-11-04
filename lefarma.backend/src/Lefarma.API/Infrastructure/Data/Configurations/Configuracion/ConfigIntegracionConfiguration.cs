using Lefarma.API.Domain.Entities.Configuracion;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Configuracion;

public class ConfigIntegracionConfiguration : IEntityTypeConfiguration<ConfigIntegracion>
{
    public void Configure(EntityTypeBuilder<ConfigIntegracion> builder)
    {
        builder.ToTable("integraciones", "config");

        builder.HasKey(i => i.IdIntegracion);
        builder.Property(i => i.IdIntegracion).HasColumnName("id_integracion").ValueGeneratedOnAdd();

        builder.Property(i => i.Nombre).HasColumnName("nombre").HasMaxLength(200).IsRequired();
        builder.Property(i => i.PrefijoLlave).HasColumnName("prefijo_llave").HasMaxLength(24).IsRequired();
        builder.Property(i => i.HashLlave).HasColumnName("hash_llave").HasColumnType("char(64)").IsRequired();
        builder.Property(i => i.ClavesPermitidasJson).HasColumnName("claves_permitidas_json").HasColumnType("nvarchar(max)");
        builder.Property(i => i.Activo).HasColumnName("activo").IsRequired();
        builder.Property(i => i.FechaCreacion).HasColumnName("fecha_creacion").IsRequired();
        builder.Property(i => i.FechaExpiracion).HasColumnName("fecha_expiracion");
        builder.Property(i => i.UltimaUtilizacion).HasColumnName("ultima_utilizacion");

        builder.HasIndex(i => i.HashLlave)
            .IsUnique()
            .HasDatabaseName("UQ_config_integraciones_hash");
    }
}
