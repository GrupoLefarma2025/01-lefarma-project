using Lefarma.API.Domain.Entities.Telemetria;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Telemetria;

public class VisitaTelemetriaConfiguration : IEntityTypeConfiguration<VisitaTelemetria>
{
    public void Configure(EntityTypeBuilder<VisitaTelemetria> builder)
    {
        builder.ToTable("visita", "telemetria");
        builder.HasKey(v => v.IdVisita);

        builder.Property(v => v.IdVisita).HasColumnName("id_visita").ValueGeneratedOnAdd();
        builder.Property(v => v.RecibidoEn).HasColumnName("recibido_en").HasColumnType("datetime2(3)").IsRequired();
        builder.Property(v => v.LoteId).HasColumnName("lote_id").HasMaxLength(64).IsRequired();
        builder.Property(v => v.VisitaId).HasColumnName("visita_id").HasMaxLength(64);
        builder.Property(v => v.RutaEntrada).HasColumnName("ruta_entrada").HasMaxLength(512).IsRequired();
        builder.Property(v => v.Inicio).HasColumnName("inicio").HasColumnType("datetime2(3)");
        builder.Property(v => v.Fin).HasColumnName("fin").HasColumnType("datetime2(3)");
        builder.Property(v => v.Segundos).HasColumnName("segundos");
        builder.Property(v => v.ScrollMax).HasColumnName("scroll_max");
        builder.Property(v => v.Navegador).HasColumnName("navegador").HasMaxLength(256);
        builder.Property(v => v.Sistema).HasColumnName("sistema").HasMaxLength(50);
        builder.Property(v => v.ViewportAncho).HasColumnName("viewport_ancho");
        builder.Property(v => v.ViewportAlto).HasColumnName("viewport_alto");
        builder.Property(v => v.VersionApp).HasColumnName("version_app").HasMaxLength(40);
        builder.Property(v => v.UsuarioHash).HasColumnName("usuario_hash").HasColumnType("char(32)");
        builder.Property(v => v.Rol).HasColumnName("rol").HasMaxLength(100);
        builder.Property(v => v.Entorno).HasColumnName("entorno").HasMaxLength(20).IsRequired();
        builder.Property(v => v.Servidor).HasColumnName("servidor").HasMaxLength(100);

        builder.HasIndex(v => v.RecibidoEn).HasDatabaseName("IX_telemetria_visita_recibido");
    }
}
