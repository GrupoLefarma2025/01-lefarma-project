using Lefarma.API.Domain.Entities.Viaticos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Viaticos;

public class MunicipioConfiguration : IEntityTypeConfiguration<Municipio>
{
    public void Configure(EntityTypeBuilder<Municipio> builder)
    {
        builder.ToTable("municipios_cat", "viaticos");
        builder.HasKey(e => e.IdMunicipio);

        builder.Property(e => e.IdMunicipio).HasColumnName("id_municipio");
        builder.Property(e => e.CodigoEstado).HasColumnName("codigo_estado");
        builder.Property(e => e.Nombre).HasColumnName("nombre").HasMaxLength(150);
        builder.Property(e => e.ClaveMunicipio).HasColumnName("clave_municipio").HasMaxLength(30);
        builder.Property(e => e.Latitud).HasColumnName("latitud");
        builder.Property(e => e.Longitud).HasColumnName("longitud");
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");

        builder.HasIndex(e => new { e.CodigoEstado, e.Nombre }).IsUnique();
    }
}