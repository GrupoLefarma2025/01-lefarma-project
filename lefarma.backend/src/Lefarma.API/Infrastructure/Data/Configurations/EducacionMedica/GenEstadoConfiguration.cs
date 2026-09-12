using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class GenEstadoConfiguration : IEntityTypeConfiguration<GenEstado>
{
    public void Configure(EntityTypeBuilder<GenEstado> builder)
    {
        builder.ToTable("genEstadosCat", "dbo");
        builder.HasKey(e => e.CodigoEstado);

        builder.Property(e => e.CodigoEstado).HasColumnName("codigoEstado");
        builder.Property(e => e.NombreEstado).HasColumnName("nombreEstado").HasMaxLength(50);
    }
}
