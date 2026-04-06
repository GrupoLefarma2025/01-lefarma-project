using Lefarma.API.Domain.Entities.Help;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Help;
public class HelpModuleConfiguration : IEntityTypeConfiguration<HelpModule>
{
    public void Configure(EntityTypeBuilder<HelpModule> builder)
    {
        builder.ToTable("HelpModules", schema: "help");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        builder.Property(x => x.Nombre)
            .HasColumnName("nombre")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.Label)
            .HasColumnName("label")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(x => x.Orden)
            .HasColumnName("orden")
            .HasDefaultValue(0);

        builder.Property(x => x.Activo)
            .HasColumnName("activo")
            .HasDefaultValue(true);

        builder.Property(x => x.FechaCreacion)
            .HasColumnName("fecha_creacion")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(x => x.FechaActualizacion)
            .HasColumnName("fecha_actualizacion")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.HasIndex(x => new { x.Orden, x.Activo })
            .HasDatabaseName("IX_HelpModules_orden_activo");

        builder.HasIndex(x => x.Nombre)
            .IsUnique()
            .HasDatabaseName("IX_HelpModules_nombre");
    }
}
