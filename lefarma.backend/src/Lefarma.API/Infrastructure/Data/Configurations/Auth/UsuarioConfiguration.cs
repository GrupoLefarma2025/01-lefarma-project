using Lefarma.API.Domain.Entities.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Auth {
public class UsuarioConfiguration : IEntityTypeConfiguration<Usuario>
    {
        public void Configure(EntityTypeBuilder<Usuario> builder)
        {
            builder.ToTable("Usuarios", "app");

            builder.HasKey(e => e.IdUsuario);
            builder.Property(e => e.IdUsuario)
                .ValueGeneratedOnAdd();

            builder.Property(e => e.SamAccountName)
                .HasMaxLength(256);

            builder.Property(e => e.Dominio)
                .HasMaxLength(256);

            builder.Property(e => e.NombreCompleto)
                .HasMaxLength(512);

            builder.Property(e => e.Correo)
                .HasMaxLength(512);

            builder.Property(e => e.EsAnonimo)
                .HasDefaultValue(false);

            builder.Property(e => e.EsActivo)
                .HasDefaultValue(true);

            builder.Property(e => e.EsRobot)
                .HasDefaultValue(false);

            builder.Property(e => e.FechaCreacion)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.HasIndex(e => new { e.SamAccountName, e.Dominio })
                .HasDatabaseName("IX_Usuarios_SamAccount_Dominio")
                .HasFilter("[SamAccountName] IS NOT NULL");

            builder.HasIndex(e => e.Correo)
                .HasDatabaseName("IX_Usuarios_Correo")
                .HasFilter("[EsAnonimo] = 1");
        }
    }
}
