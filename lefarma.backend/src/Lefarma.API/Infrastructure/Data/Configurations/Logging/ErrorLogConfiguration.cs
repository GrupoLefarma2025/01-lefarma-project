using Lefarma.API.Domain.Entities.Logging;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Logging;
public class ErrorLogConfiguration : IEntityTypeConfiguration<ErrorLog>
{
    public void Configure(EntityTypeBuilder<ErrorLog> builder)
    {
        builder.ToTable("error_logs", "logs");

        // Primary Key
        builder.HasKey(e => e.IdErrorLog);
        builder.Property(e => e.IdErrorLog)
            .HasColumnName("id_error_log")
            .ValueGeneratedOnAdd();

        // Identificación
        builder.Property(e => e.ErrorGuid)
            .HasColumnName("error_guid")
            .IsRequired()
            .HasDefaultValueSql("NEWID()");

        // Temporal
        builder.Property(e => e.FechaError)
            .HasColumnName("fecha_error")
            .IsRequired()
            .HasDefaultValueSql("GETUTCDATE()");

        // Información del error
        builder.Property(e => e.TipoExcepcion)
            .HasColumnName("tipo_excepcion")
            .IsRequired()
            .HasMaxLength(256);

        builder.Property(e => e.MensajeError)
            .HasColumnName("mensaje_error")
            .IsRequired()
            .HasMaxLength(2048);

        builder.Property(e => e.MensajeDetallado)
            .HasColumnName("mensaje_detallado")
            .HasColumnType("nvarchar(max)");

        builder.Property(e => e.StackTrace)
            .HasColumnName("stack_trace")
            .HasColumnType("nvarchar(max)");

        // Severidad
        builder.Property(e => e.Severidad)
            .HasColumnName("severidad")
            .IsRequired()
            .HasMaxLength(50)
            .HasDefaultValue("Error");

        builder.Property(e => e.Categoria)
            .HasColumnName("categoria")
            .HasMaxLength(100);

        // Contexto HTTP
        builder.Property(e => e.MetodoHttp)
            .HasColumnName("metodo_http")
            .HasMaxLength(10);

        builder.Property(e => e.RutaEndpoint)
            .HasColumnName("ruta_endpoint")
            .HasMaxLength(500);

        builder.Property(e => e.QueryString)
            .HasColumnName("query_string")
            .HasMaxLength(2048);

        builder.Property(e => e.StatusCode)
            .HasColumnName("status_code");

        builder.Property(e => e.IpCliente)
            .HasColumnName("ip_cliente")
            .HasMaxLength(128);

        builder.Property(e => e.UserAgent)
            .HasColumnName("user_agent")
            .HasMaxLength(1024);

        // Contexto de usuario
        builder.Property(e => e.UserId)
            .HasColumnName("user_id")
            .HasMaxLength(256);

        builder.Property(e => e.NombreUsuario)
            .HasColumnName("nombre_usuario")
            .HasMaxLength(256);

        // Contexto de negocio
        builder.Property(e => e.EntityName)
            .HasColumnName("entity_name")
            .HasMaxLength(256);

        builder.Property(e => e.EntityId)
            .HasColumnName("entity_id")
            .HasMaxLength(256);

        builder.Property(e => e.OperacionNegocio)
            .HasColumnName("operacion_negocio")
            .HasMaxLength(256);

        builder.Property(e => e.DatosAdicionales)
            .HasColumnName("datos_adicionales")
            .HasColumnType("nvarchar(max)");

        // Información técnica
        builder.Property(e => e.Entorno)
            .HasColumnName("entorno")
            .HasMaxLength(50);

        builder.Property(e => e.Servidor)
            .HasColumnName("servidor")
            .HasMaxLength(256);

        builder.Property(e => e.DurationMs)
            .HasColumnName("duration_ms");

        // Correlación WideEvent
        builder.Property(e => e.RequestId)
            .HasColumnName("request_id");

        builder.Property(e => e.TraceId)
            .HasColumnName("trace_id");

        // Índices para consultas frecuentes
        builder.HasIndex(e => e.FechaError)
            .HasDatabaseName("IX_ErrorLog_FechaError");

        builder.HasIndex(e => e.ErrorGuid)
            .IsUnique()
            .HasDatabaseName("IX_ErrorLog_ErrorGuid");

        builder.HasIndex(e => e.Severidad)
            .HasDatabaseName("IX_ErrorLog_Severidad");

        builder.HasIndex(e => e.TipoExcepcion)
            .HasDatabaseName("IX_ErrorLog_TipoExcepcion");

        builder.HasIndex(e => new { e.EntityName, e.EntityId })
            .HasDatabaseName("IX_ErrorLog_Entity");

        builder.HasIndex(e => e.RequestId)
            .HasDatabaseName("IX_ErrorLog_RequestId");

        builder.HasIndex(e => e.UserId)
            .HasDatabaseName("IX_ErrorLog_UserId");
    }
}
