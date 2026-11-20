using Lefarma.API.Domain.Entities.Telemetria;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Telemetria;

public class EventoErrorTelemetriaConfiguration : IEntityTypeConfiguration<EventoErrorTelemetria>
{
    public void Configure(EntityTypeBuilder<EventoErrorTelemetria> builder)
    {
        builder.ToTable("evento_error", "telemetria");
        builder.HasKey(e => e.IdError);

        builder.Property(e => e.IdError).HasColumnName("id_error").ValueGeneratedOnAdd();
        builder.Property(e => e.RecibidoEn).HasColumnName("recibido_en").HasColumnType("datetime2(3)").IsRequired();
        builder.Property(e => e.OcurridoEn).HasColumnName("ocurrido_en").HasColumnType("datetime2(3)").IsRequired();
        builder.Property(e => e.LoteId).HasColumnName("lote_id").HasMaxLength(64).IsRequired();
        builder.Property(e => e.VisitaId).HasColumnName("visita_id").HasMaxLength(64);
        builder.Property(e => e.Huella).HasColumnName("huella").HasColumnType("char(16)").IsRequired();
        builder.Property(e => e.TipoError).HasColumnName("tipo_error").HasMaxLength(20).IsRequired();
        builder.Property(e => e.Mensaje).HasColumnName("mensaje").HasMaxLength(2048).IsRequired();
        builder.Property(e => e.Stack).HasColumnName("stack").HasColumnType("nvarchar(max)");
        builder.Property(e => e.Url).HasColumnName("url").HasMaxLength(2048);
        builder.Property(e => e.Ruta).HasColumnName("ruta").HasMaxLength(512).IsRequired();
        builder.Property(e => e.MetodoHttp).HasColumnName("metodo_http").HasMaxLength(10);
        builder.Property(e => e.EstadoHttp).HasColumnName("estado_http");
        builder.Property(e => e.RequestId).HasColumnName("request_id").HasMaxLength(100);
        builder.Property(e => e.Navegador).HasColumnName("navegador").HasMaxLength(256);
        builder.Property(e => e.VersionApp).HasColumnName("version_app").HasMaxLength(40);
        builder.Property(e => e.UsuarioHash).HasColumnName("usuario_hash").HasColumnType("char(32)");
        builder.Property(e => e.Rol).HasColumnName("rol").HasMaxLength(100);
        builder.Property(e => e.Contexto).HasColumnName("contexto").HasColumnType("nvarchar(max)");
        builder.Property(e => e.Entorno).HasColumnName("entorno").HasMaxLength(20).IsRequired();
        builder.Property(e => e.Servidor).HasColumnName("servidor").HasMaxLength(100);

        builder.HasIndex(e => e.RecibidoEn).HasDatabaseName("IX_telemetria_evento_error_recibido");
        builder.HasIndex(e => new { e.Huella, e.RecibidoEn }).HasDatabaseName("IX_telemetria_evento_error_huella");
        builder.HasIndex(e => new { e.Ruta, e.RecibidoEn }).HasDatabaseName("IX_telemetria_evento_error_ruta");
    }
}
