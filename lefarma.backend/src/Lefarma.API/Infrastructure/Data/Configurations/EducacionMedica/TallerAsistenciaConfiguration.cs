using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class TallerAsistenciaConfiguration : IEntityTypeConfiguration<TallerAsistencia>
{
    public void Configure(EntityTypeBuilder<TallerAsistencia> builder)
    {
        builder.ToTable("taller_asistencias", "educacion_medica");
        builder.HasKey(e => e.IdAsistencia);

        builder.Property(e => e.IdAsistencia).HasColumnName("id_asistencia");
        builder.Property(e => e.IdTaller).HasColumnName("id_taller");
        builder.Property(e => e.Numero).HasColumnName("numero").HasColumnType("tinyint").HasConversion<byte>();
        builder.Property(e => e.NombreMedico).HasColumnName("nombre_medico").HasMaxLength(150);
        builder.Property(e => e.CedulaProfesional).HasColumnName("cedula_profesional").HasMaxLength(30);
        builder.Property(e => e.PuestoMedico).HasColumnName("puesto_medico").HasMaxLength(120);
        builder.Property(e => e.TelefonoCelular).HasColumnName("telefono_celular").HasMaxLength(30);
        builder.Property(e => e.CorreoElectronico).HasColumnName("correo_electronico").HasMaxLength(150);
        builder.Property(e => e.Observaciones).HasColumnName("observaciones").HasMaxLength(300);
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");
        builder.Property(e => e.IdUsuarioCreacion).HasColumnName("id_usuario_creacion");
        builder.Property(e => e.IdUsuarioModificacion).HasColumnName("id_usuario_modificacion");

        builder.HasOne(e => e.Taller)
            .WithMany(t => t.Asistencias)
            .HasForeignKey(e => e.IdTaller)
            .HasConstraintName("FK_taller_asistencia_taller")
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.IdTaller, e.Numero })
            .IsUnique()
            .HasDatabaseName("UQ_taller_asistencia_numero");
    }
}
