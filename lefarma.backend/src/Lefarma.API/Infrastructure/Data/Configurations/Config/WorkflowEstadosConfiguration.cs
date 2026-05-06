using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class WorkflowEstadosConfiguration : IEntityTypeConfiguration<WorkflowEstados>
    {
        public void Configure(EntityTypeBuilder<WorkflowEstados> builder)
        {
            builder.ToTable("workflow_estados", "config");
            builder.HasKey(e => e.IdEstado);
            builder.Property(e => e.IdEstado).HasColumnName("id_estado").ValueGeneratedOnAdd();
            builder.Property(e => e.Codigo).HasColumnName("codigo").HasMaxLength(50).IsRequired();
            builder.Property(e => e.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
            builder.Property(e => e.ColorHex).HasColumnName("color_hex").HasMaxLength(7);
            builder.Property(e => e.Activo).HasColumnName("activo").HasDefaultValue(true);

            builder.HasIndex(e => e.Codigo).IsUnique();
        }
    }
}
