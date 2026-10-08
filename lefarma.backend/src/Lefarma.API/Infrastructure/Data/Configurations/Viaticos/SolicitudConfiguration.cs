using Lefarma.API.Domain.Entities.Viaticos;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Viaticos;

/// <summary>
/// Mapeo Fluent API para las tablas del wizard de viáticos
/// ([viaticos].[solicitudes], [viaticos].[solicitud_opciones],
/// [viaticos].[solicitud_ajustes], [viaticos].[solicitud_eventos]).
///
/// Refleja el script 0003_20261007-0000_viaticos_schema-solicitudes.lefarma.sql
/// (snake_case + tipos). La regla "autorizada_con_ajustes requiere >=1
/// ajuste" la valida el backend, no la BD.
/// </summary>
public class SolicitudConfiguration : IEntityTypeConfiguration<Solicitud>
{
    public void Configure(EntityTypeBuilder<Solicitud> builder)
    {
        builder.ToTable("solicitudes", "viaticos");
        builder.HasKey(e => e.IdSolicitud);

        builder.Property(e => e.IdSolicitud).HasColumnName("id_solicitud");
        builder.Property(e => e.IdUsuarioSolicitante).HasColumnName("id_usuario_solicitante");
        builder.Property(e => e.Periodo).HasColumnName("periodo").HasMaxLength(7).IsRequired();
        builder.Property(e => e.Gerencia).HasColumnName("gerencia").HasMaxLength(150).IsRequired();
        builder.Property(e => e.Estado).HasColumnName("estado").HasMaxLength(30).IsRequired();
        builder.Property(e => e.DatosJson).HasColumnName("datos_json").IsRequired();
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
        builder.Property(e => e.FechaModificacion).HasColumnName("fecha_modificacion");

        builder.HasMany(e => e.Opciones)
            .WithOne()
            .HasForeignKey(o => o.IdSolicitud)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(e => e.Ajustes)
            .WithOne()
            .HasForeignKey(a => a.IdSolicitud)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(e => e.Eventos)
            .WithOne()
            .HasForeignKey(ev => ev.IdSolicitud)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class SolicitudOpcionConfiguration : IEntityTypeConfiguration<SolicitudOpcion>
{
    public void Configure(EntityTypeBuilder<SolicitudOpcion> builder)
    {
        builder.ToTable("solicitud_opciones", "viaticos");
        builder.HasKey(e => e.IdOpcion);

        builder.Property(e => e.IdOpcion).HasColumnName("id_opcion");
        builder.Property(e => e.IdSolicitud).HasColumnName("id_solicitud");
        builder.Property(e => e.Tipo).HasColumnName("tipo").HasMaxLength(20).IsRequired();
        builder.Property(e => e.Linea).HasColumnName("linea").HasMaxLength(150).IsRequired();
        builder.Property(e => e.DatosJson).HasColumnName("datos_json");
        builder.Property(e => e.Precio).HasColumnName("precio").HasColumnType("decimal(12,2)");
        builder.Property(e => e.Moneda).HasColumnName("moneda").HasMaxLength(5);
        builder.Property(e => e.UrlCompra).HasColumnName("url_compra").HasMaxLength(500);
        builder.Property(e => e.Fuente).HasColumnName("fuente").HasMaxLength(150).IsRequired();
        builder.Property(e => e.FueElegida).HasColumnName("fue_elegida");
        builder.Property(e => e.RutaCaptura).HasColumnName("ruta_captura").HasMaxLength(500);
        builder.Property(e => e.CapturadaEn).HasColumnName("capturada_en");
    }
}

public class SolicitudAjusteConfiguration : IEntityTypeConfiguration<SolicitudAjuste>
{
    public void Configure(EntityTypeBuilder<SolicitudAjuste> builder)
    {
        builder.ToTable("solicitud_ajustes", "viaticos");
        builder.HasKey(e => e.IdAjuste);

        builder.Property(e => e.IdAjuste).HasColumnName("id_ajuste");
        builder.Property(e => e.IdSolicitud).HasColumnName("id_solicitud");
        builder.Property(e => e.IdOpcion).HasColumnName("id_opcion");
        builder.Property(e => e.Campo).HasColumnName("campo").HasMaxLength(100).IsRequired();
        builder.Property(e => e.ValorAnterior).HasColumnName("valor_anterior");
        builder.Property(e => e.ValorNuevo).HasColumnName("valor_nuevo");
        builder.Property(e => e.Motivo).HasColumnName("motivo").HasMaxLength(1000).IsRequired();
        builder.Property(e => e.IdUsuarioAdmin).HasColumnName("id_usuario_admin");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
    }
}

public class SolicitudEventoConfiguration : IEntityTypeConfiguration<SolicitudEvento>
{
    public void Configure(EntityTypeBuilder<SolicitudEvento> builder)
    {
        builder.ToTable("solicitud_eventos", "viaticos");
        builder.HasKey(e => e.IdEvento);

        builder.Property(e => e.IdEvento).HasColumnName("id_evento");
        builder.Property(e => e.IdSolicitud).HasColumnName("id_solicitud");
        builder.Property(e => e.Tipo).HasColumnName("tipo").HasMaxLength(50).IsRequired();
        builder.Property(e => e.PayloadJson).HasColumnName("payload_json");
        builder.Property(e => e.IdUsuario).HasColumnName("id_usuario");
        builder.Property(e => e.FechaCreacion).HasColumnName("fecha_creacion");
    }
}
