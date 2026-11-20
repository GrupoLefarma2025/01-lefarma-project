using Lefarma.API.Domain.Entities.Telemetria;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Telemetria;

public class EventoClicTelemetriaConfiguration : IEntityTypeConfiguration<EventoClicTelemetria>
{
    public void Configure(EntityTypeBuilder<EventoClicTelemetria> builder)
    {
        builder.ToTable("evento_clic", "telemetria");
        builder.HasKey(e => e.IdClic);

        builder.Property(e => e.IdClic).HasColumnName("id_clic").ValueGeneratedOnAdd();
        builder.Property(e => e.RecibidoEn).HasColumnName("recibido_en").HasColumnType("datetime2(3)").IsRequired();
        builder.Property(e => e.OcurridoEn).HasColumnName("ocurrido_en").HasColumnType("datetime2(3)").IsRequired();
        builder.Property(e => e.LoteId).HasColumnName("lote_id").HasMaxLength(64).IsRequired();
        builder.Property(e => e.VisitaId).HasColumnName("visita_id").HasMaxLength(64);
        builder.Property(e => e.Ruta).HasColumnName("ruta").HasMaxLength(512).IsRequired();
        builder.Property(e => e.Elemento).HasColumnName("elemento").HasMaxLength(200);
        builder.Property(e => e.Etiqueta).HasColumnName("etiqueta").HasMaxLength(120);
        builder.Property(e => e.TipoElemento).HasColumnName("tipo_elemento").HasMaxLength(30);
        builder.Property(e => e.X).HasColumnName("x");
        builder.Property(e => e.Y).HasColumnName("y");
        builder.Property(e => e.ViewportAncho).HasColumnName("viewport_ancho");
        builder.Property(e => e.ViewportAlto).HasColumnName("viewport_alto");
        builder.Property(e => e.VersionApp).HasColumnName("version_app").HasMaxLength(40);
        builder.Property(e => e.UsuarioHash).HasColumnName("usuario_hash").HasColumnType("char(32)");
        builder.Property(e => e.Rol).HasColumnName("rol").HasMaxLength(100);
        builder.Property(e => e.Entorno).HasColumnName("entorno").HasMaxLength(20).IsRequired();
        builder.Property(e => e.Servidor).HasColumnName("servidor").HasMaxLength(100);

        builder.HasIndex(e => e.RecibidoEn).HasDatabaseName("IX_telemetria_evento_clic_recibido");
        builder.HasIndex(e => new { e.Ruta, e.RecibidoEn }).HasDatabaseName("IX_telemetria_evento_clic_ruta");
        builder.HasIndex(e => e.Elemento).HasDatabaseName("IX_telemetria_evento_clic_elemento");
    }
}
