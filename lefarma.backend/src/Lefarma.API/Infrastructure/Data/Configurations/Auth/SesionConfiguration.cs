using Lefarma.API.Domain.Entities.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Auth {
public class SesionConfiguration : IEntityTypeConfiguration<Sesion>
    {
        public void Configure(EntityTypeBuilder<Sesion> builder)
        {
            builder.ToTable("Sesiones", "app");

            builder.HasKey(e => e.IdSesion);
            builder.Property(e => e.IdSesion)
                .ValueGeneratedOnAdd();

            builder.Property(e => e.SessionId)
                .IsRequired()
                .HasMaxLength(128);

            builder.Property(e => e.ClientId)
                .HasMaxLength(256);

            builder.Property(e => e.UserAgent)
                .HasMaxLength(1024);

            builder.Property(e => e.IpAddress)
                .HasMaxLength(128);

            builder.Property(e => e.DeviceInfo)
                .HasMaxLength(512);

            builder.Property(e => e.FechaInicio)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.Property(e => e.FechaUltimaActividad)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.Property(e => e.EsActiva)
                .HasDefaultValue(true);

            builder.HasOne(e => e.Usuario)
                .WithMany(u => u.Sesiones)
                .HasForeignKey(e => e.IdUsuario)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(e => e.SessionId)
                .IsUnique()
                .HasDatabaseName("IX_Sesiones_SessionId");
        }
    }
}
