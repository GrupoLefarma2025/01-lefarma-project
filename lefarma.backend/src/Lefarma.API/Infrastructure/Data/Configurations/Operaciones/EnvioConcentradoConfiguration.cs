using Lefarma.API.Domain.Entities.Operaciones;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Operaciones
{
    public class EnvioConcentradoConfiguration : IEntityTypeConfiguration<EnvioConcentrado>
    {
        public void Configure(EntityTypeBuilder<EnvioConcentrado> builder)
        {
            builder.ToTable("envios_concentrado", "operaciones");
            builder.HasKey(e => e.IdEnvioConcentrado);
            builder.Property(e => e.IdEnvioConcentrado).HasColumnName("id_envio_concentrado").ValueGeneratedOnAdd();
            
            builder.Property(e => e.IdUsuarioEnvio).HasColumnName("id_usuario_envio").IsRequired();
            builder.Property(e => e.FechaEnvio).HasColumnName("fecha_envio").HasDefaultValueSql("GETDATE()");
            
            builder.Property(e => e.Estado).HasColumnName("estado").HasMaxLength(20).IsRequired();
            builder.Property(e => e.FechaRespuesta).HasColumnName("fecha_respuesta");
            builder.Property(e => e.IdUsuarioRespuesta).HasColumnName("id_usuario_respuesta");
            builder.Property(e => e.ComentarioRespuesta).HasColumnName("comentario_respuesta").HasMaxLength(500);
            
            builder.Property(e => e.TokenSeguridad).HasColumnName("token_seguridad").HasMaxLength(100).IsRequired();
            builder.HasIndex(e => e.TokenSeguridad).IsUnique();
            
            builder.Property(e => e.Total).HasColumnName("total").HasColumnType("decimal(18,2)").HasDefaultValue(0);
            builder.Property(e => e.CantidadOrdenes).HasColumnName("cantidad_ordenes").HasDefaultValue(0);
            
            builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");
            builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
            
            builder.Property(e => e.Activo).HasColumnName("activo").HasDefaultValue(true);
            
            // Relación muchos a muchos con ordenes_compra
            builder.HasMany(e => e.Ordenes)
                .WithMany()
                .UsingEntity<Dictionary<string, object>>(
                    "envios_concentrado_ordenes",
                    j => j.HasOne<OrdenCompra>().WithMany().HasForeignKey("id_orden"),
                    j => j.HasOne<EnvioConcentrado>().WithMany().HasForeignKey("id_envio_concentrado"),
                    j =>
                    {
                        j.ToTable("envios_concentrado_ordenes", "operaciones");
                        j.HasKey("id_envio_concentrado", "id_orden");
                    }
                );
        }
    }
}
