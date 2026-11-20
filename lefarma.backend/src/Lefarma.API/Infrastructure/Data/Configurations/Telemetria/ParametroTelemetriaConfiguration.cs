using Lefarma.API.Domain.Entities.Telemetria;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Telemetria;

public class ParametroTelemetriaConfiguration : IEntityTypeConfiguration<ParametroTelemetria>
{
    public void Configure(EntityTypeBuilder<ParametroTelemetria> builder)
    {
        builder.ToTable("parametro", "telemetria");
        builder.HasKey(p => p.Clave);

        builder.Property(p => p.Clave).HasColumnName("clave").HasMaxLength(50).IsRequired();
        builder.Property(p => p.Valor).HasColumnName("valor").HasMaxLength(500).IsRequired();
        builder.Property(p => p.ActualizadoEn).HasColumnName("actualizado_en").HasColumnType("datetime2(3)").IsRequired();
    }
}
