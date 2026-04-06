using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos {
public class RegimenFiscalConfiguration : IEntityTypeConfiguration<RegimenFiscal>
    {
        public void Configure(EntityTypeBuilder<RegimenFiscal> builder)
        {
            builder.ToTable("regimenes_fiscales", "catalogos");

            builder.HasKey(e => e.IdRegimenFiscal);
            builder.Property(e => e.IdRegimenFiscal)
                .HasColumnName("id_regimen_fiscal")
                .ValueGeneratedOnAdd();

            builder.Property(e => e.Clave)
                .HasColumnName("clave")
                .HasMaxLength(10)
                .IsRequired();

            builder.Property(e => e.Descripcion)
                .HasColumnName("descripcion")
                .HasMaxLength(255)
                .IsRequired();

            builder.Property(e => e.TipoPersona)
                .HasColumnName("tipo_persona")
                .HasMaxLength(10)
                .IsRequired();

            builder.Property(e => e.Activo)
                .HasColumnName("activo")
                .HasDefaultValue(true);

            builder.Property(e => e.FechaCreacion)
                .HasColumnName("fecha_creacion")
                .IsRequired()
                .HasDefaultValueSql("GETDATE()");

            builder.HasIndex(e => e.Clave).IsUnique();
        }
    }
}
