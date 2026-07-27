using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh
{
    public class SolicitudPersonalDetalleConfiguration : IEntityTypeConfiguration<SolicitudPersonalDetalle>
    {
        public void Configure(EntityTypeBuilder<SolicitudPersonalDetalle> builder)
        {
            builder.ToTable("solicitudes_personal_detalle", "rh");
            builder.HasKey(d => d.IdDetalle);
            builder.Property(d => d.IdDetalle).HasColumnName("id_detalle").ValueGeneratedOnAdd();
            builder.Property(d => d.IdSolicitud).HasColumnName("id_solicitud");
            builder.Property(d => d.Fecha).HasColumnName("fecha").HasColumnType("date");
            builder.Property(d => d.Comentario).HasColumnName("comentario").HasMaxLength(200);
            builder.Property(d => d.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");

            builder.HasOne(d => d.Solicitud)
                .WithMany(s => s.Detalle)
                .HasForeignKey(d => d.IdSolicitud)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(d => new { d.IdSolicitud, d.Fecha }).IsUnique();
        }
    }
}
