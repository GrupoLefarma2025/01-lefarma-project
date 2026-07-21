using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Catalogos
{
    public class TipoDiaConfiguration : IEntityTypeConfiguration<TipoDia>
    {
        public void Configure(EntityTypeBuilder<TipoDia> builder)
        {
            builder.ToTable("tipos_dia", "catalogos");
            builder.HasKey(e => e.IdTipoDia);
            builder.Property(e => e.IdTipoDia).HasColumnName("id_tipo_dia").ValueGeneratedOnAdd();

            builder.Property(e => e.Clave).HasColumnName("clave").HasMaxLength(50).IsRequired();
            builder.Property(e => e.Nombre).HasColumnName("nombre").HasMaxLength(100).IsRequired();
            builder.Property(e => e.Descripcion).HasColumnName("descripcion").HasMaxLength(255);
            builder.Property(e => e.Activo).HasColumnName("activo").HasDefaultValue(true);
            builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");

            builder.HasIndex(e => e.Clave).HasDatabaseName("UQ_tipos_dia_clave").IsUnique();
        }
    }
}
