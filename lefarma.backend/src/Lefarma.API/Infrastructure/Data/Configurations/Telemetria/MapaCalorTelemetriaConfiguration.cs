using Lefarma.API.Domain.Entities.Telemetria;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Telemetria;

public class MapaCalorTelemetriaConfiguration : IEntityTypeConfiguration<MapaCalorTelemetria>
{
    public void Configure(EntityTypeBuilder<MapaCalorTelemetria> builder)
    {
        builder.ToTable("mapa_calor", "telemetria");
        builder.HasKey(m => m.IdMapa);

        builder.Property(m => m.IdMapa).HasColumnName("id_mapa").ValueGeneratedOnAdd();
        builder.Property(m => m.RecibidoEn).HasColumnName("recibido_en").HasColumnType("datetime2(3)").IsRequired();
        builder.Property(m => m.OcurridoEn).HasColumnName("ocurrido_en").HasColumnType("datetime2(3)").IsRequired();
        builder.Property(m => m.LoteId).HasColumnName("lote_id").HasMaxLength(64).IsRequired();
        builder.Property(m => m.VisitaId).HasColumnName("visita_id").HasMaxLength(64);
        builder.Property(m => m.Ruta).HasColumnName("ruta").HasMaxLength(512).IsRequired();
        builder.Property(m => m.Columnas).HasColumnName("columnas").IsRequired();
        builder.Property(m => m.Filas).HasColumnName("filas").IsRequired();
        builder.Property(m => m.TamanoCelda).HasColumnName("tamano_celda").IsRequired();
        builder.Property(m => m.Celdas).HasColumnName("celdas").HasColumnType("varbinary(max)").IsRequired();
        builder.Property(m => m.Movimientos).HasColumnName("movimientos").IsRequired();
        builder.Property(m => m.ScrollMax).HasColumnName("scroll_max");
        builder.Property(m => m.SegundosVisibles).HasColumnName("segundos_visibles");
        builder.Property(m => m.ViewportAncho).HasColumnName("viewport_ancho");
        builder.Property(m => m.ViewportAlto).HasColumnName("viewport_alto");
        builder.Property(m => m.VersionApp).HasColumnName("version_app").HasMaxLength(40);
        builder.Property(m => m.UsuarioHash).HasColumnName("usuario_hash").HasColumnType("char(32)");
        builder.Property(m => m.Rol).HasColumnName("rol").HasMaxLength(100);
        builder.Property(m => m.Entorno).HasColumnName("entorno").HasMaxLength(20).IsRequired();
        builder.Property(m => m.Servidor).HasColumnName("servidor").HasMaxLength(100);

        builder.HasIndex(m => new { m.Ruta, m.RecibidoEn }).HasDatabaseName("IX_telemetria_mapa_calor_ruta");
    }
}
