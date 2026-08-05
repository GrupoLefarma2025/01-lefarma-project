using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh
{
    public class EnvioSolicitudConfiguration : IEntityTypeConfiguration<EnvioSolicitud>
    {
        public void Configure(EntityTypeBuilder<EnvioSolicitud> builder)
        {
            builder.ToTable("envios_solicitudes", "rh");
            builder.HasKey(e => e.IdEnvio);
            builder.Property(e => e.IdEnvio).HasColumnName("id_envio").ValueGeneratedOnAdd();

            builder.Property(e => e.IdSolicitud).HasColumnName("id_solicitud").IsRequired();

            builder.Property(e => e.IdUsuarioEnvio).HasColumnName("id_usuario_envio").IsRequired();
            builder.Property(e => e.FechaEnvio).HasColumnName("fecha_envio").HasDefaultValueSql("GETDATE()");

            builder.Property(e => e.Estado).HasColumnName("estado").HasMaxLength(20).IsRequired();
            builder.Property(e => e.FechaRespuesta).HasColumnName("fecha_respuesta");
            builder.Property(e => e.IdUsuarioRespuesta).HasColumnName("id_usuario_respuesta");
            builder.Property(e => e.ComentarioRespuesta).HasColumnName("comentario_respuesta").HasMaxLength(500);

            builder.Property(e => e.TokenSeguridad).HasColumnName("token_seguridad").HasMaxLength(100).IsRequired();
            builder.HasIndex(e => e.TokenSeguridad).IsUnique();

            builder.Property(e => e.IdTipoSolicitud).HasColumnName("id_tipo_solicitud"  );
            builder.Property(e => e.IdUsuarioSolicitante).HasColumnName("id_usuario_solicitante").IsRequired();

            builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");
            builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");

            builder.Property(e => e.Activo).HasColumnName("activo").HasDefaultValue(true);

            // Relación con SolicitudPersonal
            builder.HasOne(e => e.Solicitud)
                .WithMany()
                .HasForeignKey(e => e.IdSolicitud)
                .OnDelete(DeleteBehavior.Restrict);

            // Relación con TipoSolicitud
            builder.HasOne(e => e.TipoSolicitud)
                .WithMany()
                .HasForeignKey(e => e.IdTipoSolicitud)
                .OnDelete(DeleteBehavior.Restrict);

        }

    }
}
