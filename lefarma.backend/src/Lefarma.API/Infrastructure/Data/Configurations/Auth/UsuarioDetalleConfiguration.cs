using Lefarma.API.Domain.Entities.Catalogos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Auth;
public class UsuarioDetalleConfiguration : IEntityTypeConfiguration<UsuarioDetalle>
{
    public void Configure(EntityTypeBuilder<UsuarioDetalle> builder)
    {
        builder.ToTable("usuario_detalle", "config");

        builder.HasKey(ud => ud.IdUsuario);

        builder.Property(ud => ud.IdUsuario)
            .HasColumnName("id_usuario");

        builder.Property(ud => ud.IdEmpresa)
            .HasColumnName("id_empresa")
            .IsRequired();

        builder.Property(ud => ud.IdSucursal)
            .HasColumnName("id_sucursal")
            .IsRequired();

        builder.Property(ud => ud.IdArea)
            .HasColumnName("id_area");

        builder.Property(ud => ud.IdCentroCosto)
            .HasColumnName("id_centro_costo");

        // Información laboral
        builder.Property(ud => ud.Puesto)
            .HasColumnName("puesto")
            .HasMaxLength(150);

        builder.Property(ud => ud.NumeroEmpleado)
            .HasColumnName("numero_empleado")
            .HasMaxLength(50);

        builder.Property(ud => ud.FirmaPath)
            .HasColumnName("firma_path")
            .HasMaxLength(500);

        // Contacto
        builder.Property(ud => ud.TelefonoOficina)
            .HasColumnName("telefono_oficina")
            .HasMaxLength(20);

        builder.Property(ud => ud.Extension)
            .HasColumnName("extension")
            .HasMaxLength(10);

        builder.Property(ud => ud.Celular)
            .HasColumnName("celular")
            .HasMaxLength(20);

        builder.Property(ud => ud.TelegramChat)
            .HasColumnName("telegram_chat")
            .HasMaxLength(200);

        // Configuración de notificaciones
        builder.Property(ud => ud.NotificarEmail)
            .HasColumnName("notificar_email")
            .HasDefaultValue(true);

        builder.Property(ud => ud.NotificarApp)
            .HasColumnName("notificar_app")
            .HasDefaultValue(true);

        builder.Property(ud => ud.NotificarWhatsapp)
            .HasColumnName("notificar_whatsapp")
            .HasDefaultValue(false);

        builder.Property(ud => ud.NotificarSms)
            .HasColumnName("notificar_sms")
            .HasDefaultValue(false);

        builder.Property(ud => ud.NotificarTelegram)
            .HasColumnName("notificar_telegram")
            .HasDefaultValue(false);

        // Filtros específicos de notificación
        builder.Property(ud => ud.NotificarSoloUrgentes)
            .HasColumnName("notificar_solo_urgentes")
            .HasDefaultValue(false);

        builder.Property(ud => ud.NotificarResumenDiario)
            .HasColumnName("notificar_resumen_diario")
            .HasDefaultValue(true);

        builder.Property(ud => ud.NotificarRechazos)
            .HasColumnName("notificar_rechazos")
            .HasDefaultValue(true);

        builder.Property(ud => ud.NotificarVencimientos)
            .HasColumnName("notificar_vencimientos")
            .HasDefaultValue(true);

        // Continuidad operativa
        builder.Property(ud => ud.IdUsuarioDelegado)
            .HasColumnName("id_usuario_delegado");

        builder.Property(ud => ud.DelegacionHasta)
            .HasColumnName("delegacion_hasta")
            .HasColumnType("DATE");

        // Configuración de interfaz
        builder.Property(ud => ud.AvatarUrl)
            .HasColumnName("avatar_url")
            .HasMaxLength(255);

        builder.Property(ud => ud.TemaInterfaz)
            .HasColumnName("tema_interfaz")
            .HasMaxLength(20)
            .HasDefaultValue("light");

        builder.Property(ud => ud.DashboardInicio)
            .HasColumnName("dashboard_inicio")
            .HasMaxLength(50);

        builder.Property(ud => ud.Activo)
            .HasColumnName("activo")
            .HasDefaultValue(true);

        // Auditoría
        builder.Property(ud => ud.FechaCreacion)
            .HasColumnName("fecha_creacion")
            .HasDefaultValueSql("GETDATE()");

        builder.Property(ud => ud.FechaModificacion)
            .HasColumnName("fecha_modificacion")
            .HasDefaultValueSql("GETDATE()");

        // Relaciones
        builder.HasOne(ud => ud.Empresa)
            .WithMany()
            .HasForeignKey(ud => ud.IdEmpresa)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_usuario_detalle_empresa");

        builder.HasOne(ud => ud.Sucursal)
            .WithMany()
            .HasForeignKey(ud => ud.IdSucursal)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_usuario_detalle_sucursal");

        builder.HasOne(ud => ud.Area)
            .WithMany()
            .HasForeignKey(ud => ud.IdArea)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_usuario_detalle_area");
    }
}
