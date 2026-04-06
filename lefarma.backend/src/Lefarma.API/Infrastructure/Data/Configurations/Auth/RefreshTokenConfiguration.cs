using Lefarma.API.Domain.Entities.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Auth {
public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
    {
        public void Configure(EntityTypeBuilder<RefreshToken> builder)
        {
            builder.ToTable("RefreshTokens", "app");

            builder.HasKey(e => e.IdRefreshToken);
            builder.Property(e => e.IdRefreshToken)
                .ValueGeneratedOnAdd();

            builder.Property(e => e.TokenHash)
                .IsRequired()
                .HasMaxLength(128);

            builder.Property(e => e.JtiAccess)
                .IsRequired()
                .HasMaxLength(128);

            builder.Property(e => e.ClientId)
                .HasMaxLength(256);

            builder.Property(e => e.Scope)
                .HasMaxLength(1024);

            builder.Property(e => e.FechaCreacion)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            builder.Property(e => e.EsRevocado)
                .HasDefaultValue(false);

            builder.HasOne(e => e.Usuario)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(e => e.IdUsuario)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(e => e.Sesion)
                .WithMany(s => s.RefreshTokens)
                .HasForeignKey(e => e.IdSesion)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(e => e.TokenHash)
                .HasDatabaseName("IX_RefreshTokens_TokenHash")
                .HasFilter("[EsRevocado] = 0");
        }
    }
}
