using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos
{
    public class MonedaConfiguration : IEntityTypeConfiguration<Moneda>
    {
        public void Configure(EntityTypeBuilder<Moneda> builder)
        {
            builder.ToTable("monedas", "catalogos");

            builder.HasKey(e => e.IdMoneda);
            builder.Property(e => e.IdMoneda)
                .HasColumnName("id_moneda")
                .ValueGeneratedOnAdd();

            builder.Property(e => e.Codigo)
                .HasColumnName("codigo")
                .HasMaxLength(3)
                .IsRequired();

            builder.HasIndex(e => e.Codigo)
                .IsUnique();

            builder.Property(e => e.Nombre)
                .HasColumnName("nombre")
                .HasMaxLength(100)
                .IsRequired();

            builder.Property(e => e.Simbolo)
                .HasColumnName("simbolo")
                .HasMaxLength(5)
                .IsRequired();

            builder.Property(e => e.Locale)
                .HasColumnName("locale")
                .HasMaxLength(10)
                .IsRequired();

            builder.Property(e => e.TipoCambio)
                .HasColumnName("tipo_cambio")
                .HasPrecision(18, 6)
                .HasDefaultValue(1m);

            builder.Property(e => e.EsDefault)
                .HasColumnName("es_default")
                .HasDefaultValue(false);

            builder.Property(e => e.Activo)
                .HasColumnName("activo")
                .HasDefaultValue(true);

            builder.Property(e => e.FechaCreacion)
                .HasColumnName("fecha_creacion")
                .IsRequired()
                .HasDefaultValueSql("GETDATE()");

            builder.Property(e => e.FechaModificacion)
                .HasColumnName("fecha_modificacion");
        }
    }
}
