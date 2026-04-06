using Lefarma.API.Domain.Entities.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Auth;
/// <summary>
/// Configuration for the vwDirectorioActivo view (read-only).
/// </summary>
public class VwDirectorioActivoConfiguration : IEntityTypeConfiguration<VwDirectorioActivo>
{
    public void Configure(EntityTypeBuilder<VwDirectorioActivo> builder)
    {
        builder.ToView("vwDirectorioActivo", "dbo");

        // Configure as keyless entity (view)
        builder.HasNoKey();

        builder.Property(e => e.SamAccountName)
            .HasMaxLength(256);

        builder.Property(e => e.Dominio)
            .HasMaxLength(256);

        builder.Property(e => e.Mail)
            .HasMaxLength(512);

        builder.Property(e => e.DisplayName)
            .HasMaxLength(512);

        builder.Property(e => e.GivenName)
            .HasMaxLength(256);

        builder.Property(e => e.Sn)
            .HasMaxLength(256);

        builder.Property(e => e.Department)
            .HasMaxLength(256);

        builder.Property(e => e.NumeroNomina)
            .HasMaxLength(50);

        builder.Property(e => e.TelephoneNumber)
            .HasMaxLength(50);

        builder.Property(e => e.UserPrincipalName)
            .HasMaxLength(512);

        builder.Property(e => e.TelefonoIP)
            .HasMaxLength(50);

        builder.Property(e => e.Titulo)
            .HasMaxLength(256);
    }
}
