using Lefarma.API.Domain.Entities.Logging;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Logging;

public class BusinessAuditLogConfiguration : IEntityTypeConfiguration<BusinessAuditLog>
{
    public void Configure(EntityTypeBuilder<BusinessAuditLog> builder)
    {
        builder.ToTable("audit_logs", "logs");

        builder.HasKey(e => e.IdAuditLog);
        builder.Property(e => e.IdAuditLog)
            .HasColumnName("id_audit_log")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.FechaOperacion)
            .HasColumnName("fecha_operacion")
            .IsRequired()
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.EntityName)
            .HasColumnName("entity_name")
            .HasMaxLength(256);

        builder.Property(e => e.EntityId)
            .HasColumnName("entity_id")
            .HasMaxLength(256);

        builder.Property(e => e.NombreEntidad)
            .HasColumnName("nombre_entidad")
            .HasMaxLength(512);

        builder.Property(e => e.Accion)
            .HasColumnName("accion")
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(e => e.UserId)
            .HasColumnName("user_id")
            .HasMaxLength(256);

        builder.Property(e => e.NombreUsuario)
            .HasColumnName("nombre_usuario")
            .HasMaxLength(256);

        builder.Property(e => e.IpCliente)
            .HasColumnName("ip_cliente")
            .HasMaxLength(128);

        builder.Property(e => e.MetodoHttp)
            .HasColumnName("metodo_http")
            .HasMaxLength(10);

        builder.Property(e => e.RutaEndpoint)
            .HasColumnName("ruta_endpoint")
            .HasMaxLength(500);

        builder.Property(e => e.StatusCode)
            .HasColumnName("status_code")
            .IsRequired();

        builder.Property(e => e.Exitoso)
            .HasColumnName("exitoso")
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(e => e.MensajeError)
            .HasColumnName("mensaje_error")
            .HasMaxLength(2048);

        builder.Property(e => e.DatosAdicionales)
            .HasColumnName("datos_adicionales")
            .HasColumnType("nvarchar(max)");

        builder.Property(e => e.RequestId)
            .HasColumnName("request_id");

        builder.Property(e => e.DurationMs)
            .HasColumnName("duration_ms");

        // Índices para consultas frecuentes
        builder.HasIndex(e => e.FechaOperacion)
            .HasDatabaseName("IX_AuditLog_FechaOperacion");

        builder.HasIndex(e => new { e.EntityName, e.EntityId })
            .HasDatabaseName("IX_AuditLog_Entity");

        builder.HasIndex(e => e.UserId)
            .HasDatabaseName("IX_AuditLog_UserId");

        builder.HasIndex(e => e.Accion)
            .HasDatabaseName("IX_AuditLog_Accion");

        builder.HasIndex(e => e.RequestId)
            .HasDatabaseName("IX_AuditLog_RequestId");
    }
}
