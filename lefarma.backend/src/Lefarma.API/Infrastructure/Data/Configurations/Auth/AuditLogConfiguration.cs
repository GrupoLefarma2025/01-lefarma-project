using Lefarma.API.Domain.Entities.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Auth {
public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
    {
        public void Configure(EntityTypeBuilder<AuditLog> builder)
        {
            builder.ToTable("AuditLog", "app");

            builder.HasKey(e => e.IdAudit);
            builder.Property(e => e.IdAudit)
                .ValueGeneratedOnAdd();

            builder.Property(e => e.Usuario)
                .HasMaxLength(256);

            builder.Property(e => e.Accion)
                .IsRequired()
                .HasMaxLength(256);

            builder.Property(e => e.Recurso)
                .HasMaxLength(256);

            builder.Property(e => e.Detalles)
                .HasColumnType("nvarchar(max)");

            builder.Property(e => e.Fecha)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.Property(e => e.IpAddress)
                .HasMaxLength(128);

            builder.Property(e => e.UserAgent)
                .HasMaxLength(1024);

            builder.Property(e => e.Exitoso)
                .HasDefaultValue(true);

            builder.Property(e => e.MensajeError)
                .HasColumnType("nvarchar(max)");

            builder.HasIndex(e => e.IdUsuario)
                .HasDatabaseName("IX_AuditLog_IdUsuario");

            builder.HasIndex(e => e.Accion)
                .HasDatabaseName("IX_AuditLog_Accion");

            builder.HasIndex(e => e.Fecha)
                .HasDatabaseName("IX_AuditLog_Fecha");
        }
    }
}
