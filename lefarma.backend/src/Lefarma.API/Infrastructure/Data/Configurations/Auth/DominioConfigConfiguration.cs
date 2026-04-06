using Lefarma.API.Domain.Entities.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Auth {
public class DominioConfigConfiguration : IEntityTypeConfiguration<DominioConfig>
    {
        public void Configure(EntityTypeBuilder<DominioConfig> builder)
        {
            builder.ToTable("DominioConfig", "app");

            builder.HasKey(e => e.Id);
            builder.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            builder.Property(e => e.Dominio)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(e => e.Servidor)
                .IsRequired()
                .HasMaxLength(255);

            builder.Property(e => e.Puerto)
                .HasDefaultValue(389);

            builder.Property(e => e.BaseDn)
                .HasMaxLength(500);

            builder.HasIndex(e => e.Dominio)
                .IsUnique()
                .HasDatabaseName("IX_DominioConfig_Dominio");
        }
    }
}
