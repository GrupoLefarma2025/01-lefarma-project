using Lefarma.API.Domain.Entities.Telemetria;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Telemetria;

public class LoteTelemetriaProcesadoConfiguration : IEntityTypeConfiguration<LoteTelemetriaProcesado>
{
    public void Configure(EntityTypeBuilder<LoteTelemetriaProcesado> builder)
    {
        builder.ToTable("lote_procesado", "telemetria");
        builder.HasKey(l => l.LoteId);
        builder.Property(l => l.LoteId).HasColumnName("lote_id").HasMaxLength(64).IsRequired();
        builder.Property(l => l.RecibidoEn).HasColumnName("recibido_en").HasColumnType("datetime2(3)").IsRequired();
    }
}
