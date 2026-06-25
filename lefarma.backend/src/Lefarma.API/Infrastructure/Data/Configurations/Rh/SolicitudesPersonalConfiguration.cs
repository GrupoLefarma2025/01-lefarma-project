using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh
{
    public class SolicitudesPersonalConfiguration : IEntityTypeConfiguration<SolicitudPersonal>
    {
        public void Configure(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<SolicitudPersonal> builder)
        {
            builder.ToTable("solicitudes_personal", "rh");
            builder.HasKey(s => s.IdSolicitud);
            builder.Property(s => s.IdSolicitud).HasColumnName("id_solicitud").ValueGeneratedOnAdd();
            builder.Property(s => s.Folio).HasColumnName("folio").HasMaxLength(20).IsRequired();
            builder.Property(s => s.IdEmpresa).HasColumnName("id_empresa");
            builder.Property(s => s.IdSucursal).HasColumnName("id_sucursal");
            builder.Property(s => s.IdArea).HasColumnName("id_area");
            builder.Property(s => s.IdUsuarioCreador).HasColumnName("id_usuario_creador");
            builder.Property(s => s.IdEstado).HasColumnName("id_estado");
            builder.HasOne(o => o.Estado)
                .WithMany()
                .HasForeignKey(o => o.IdEstado)
                .OnDelete(DeleteBehavior.Restrict);
            builder.Property(s => s.IdWorkflow).HasColumnName("id_workflow");
            builder.Property(s => s.IdPasoActual).HasColumnName("id_paso_actual").IsRequired(false);
            builder.HasOne(s => s.Empresa)
                .WithMany()
                .HasForeignKey(s => s.IdEmpresa)
                .OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(s => s.Sucursal)
                .WithMany()
                .HasForeignKey(s => s.IdSucursal)
                .OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(s => s.Area)
                .WithMany()
                .HasForeignKey(s => s.IdArea)
                .OnDelete(DeleteBehavior.Restrict);
            builder.Property(s => s.IdTipoSolicitud).HasColumnName("id_tipo_solicitud");
            builder.Property(s => s.LugarComision).HasColumnName("lugar_comision").HasMaxLength(100).IsRequired(false);
            builder.Property(s => s.Motivo).HasColumnName("motivo").HasMaxLength(500).IsRequired(false);
            builder.Property(s => s.FechaEnvio).HasColumnName("fecha_envio").IsRequired(false);
            builder.Property(s => s.FechaInicio).HasColumnName("fecha_inicio").IsRequired(false);
            builder.Property(s => s.FechaFin).HasColumnName("fecha_fin").IsRequired(false);
            builder.Property(s => s.FechaReposicion).HasColumnName("fecha_reposicion").IsRequired(false);
            builder.Property(s => s.DiasSolicitados).HasColumnName("dias_solicitados").IsRequired(false);
            builder.Property(s => s.FechaRegreso).HasColumnName("fecha_regreso").IsRequired(false);
            builder.Property(s => s.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");
            builder.Property(s => s.FechaModificacion).HasColumnName("fecha_modificacion").IsRequired(false);


        }
    }
}
