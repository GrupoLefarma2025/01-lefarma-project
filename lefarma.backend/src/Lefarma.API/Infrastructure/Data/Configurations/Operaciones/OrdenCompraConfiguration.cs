using Lefarma.API.Domain.Entities.Operaciones;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Operaciones {
public class OrdenCompraConfiguration : IEntityTypeConfiguration<OrdenCompra>
    {
        public void Configure(EntityTypeBuilder<OrdenCompra> builder)
        {
            builder.ToTable("ordenes_compra", "operaciones");
            builder.HasKey(o => o.IdOrden);
            builder.Property(o => o.IdOrden).HasColumnName("id_orden").ValueGeneratedOnAdd();
            builder.Property(o => o.Folio).HasColumnName("folio").HasMaxLength(20).IsRequired();
            builder.HasIndex(o => o.Folio).IsUnique();
            builder.Property(o => o.IdEmpresa).HasColumnName("id_empresa");
            builder.Property(o => o.IdSucursal).HasColumnName("id_sucursal");
            builder.Property(o => o.IdArea).HasColumnName("id_area");
            builder.Property(o => o.IdTipoGasto).HasColumnName("id_tipo_gasto");
            builder.Property(o => o.IdUsuarioCreador).HasColumnName("id_usuario_creador");
            builder.Property(o => o.Estado).HasColumnName("estado").HasConversion<int>();
            builder.Property(o => o.IdPasoActual).HasColumnName("id_paso_actual");
            builder.Property(o => o.IdProveedor).HasColumnName("id_proveedor");
            builder.Property(o => o.IdsCuentasBancarias).HasColumnName("ids_cuentas_bancarias").HasColumnType("nvarchar(max)");
            builder.Property(o => o.SinDatosFiscales).HasColumnName("sin_datos_fiscales").HasDefaultValue(false);
            builder.Property(o => o.NotaFormaPago).HasColumnName("nota_forma_pago").HasMaxLength(500);
            builder.Property(o => o.NotasGenerales).HasColumnName("notas_generales").HasMaxLength(1000);
            builder.Property(o => o.IdCentroCosto).HasColumnName("id_centro_costo");
            builder.Property(o => o.IdCuentaContable).HasColumnName("id_cuenta_contable");
            builder.Property(o => o.RequiereComprobacionPago).HasColumnName("requiere_comprobacion_pago").HasDefaultValue(true);
            builder.Property(o => o.RequiereComprobacionGasto).HasColumnName("requiere_comprobacion_gasto").HasDefaultValue(true);
            builder.Property(o => o.FechaSolicitud).HasColumnName("fecha_solicitud");
            builder.Property(o => o.FechaLimitePago).HasColumnName("fecha_limite_pago");
            builder.Property(o => o.FechaCreacion).HasColumnName("fecha_creacion").HasDefaultValueSql("GETDATE()");
            builder.Property(o => o.FechaModificacion).HasColumnName("fecha_modificacion");
            builder.Property(o => o.FechaAutorizacion).HasColumnName("fecha_autorizacion");
            builder.Property(o => o.Subtotal).HasColumnName("subtotal").HasColumnType("decimal(18,2)");
            builder.Property(o => o.TotalIva).HasColumnName("total_iva").HasColumnType("decimal(18,2)");
            builder.Property(o => o.TotalRetenciones).HasColumnName("total_retenciones").HasColumnType("decimal(18,2)");
            builder.Property(o => o.TotalOtrosImpuestos).HasColumnName("total_otros_impuestos").HasColumnType("decimal(18,2)");
            builder.Property(o => o.Total).HasColumnName("total").HasColumnType("decimal(18,2)");

            builder.HasMany(o => o.Partidas).WithOne(p => p.Orden).HasForeignKey(p => p.IdOrden).OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(o => o.Proveedor)
                .WithMany()
                .HasForeignKey(o => o.IdProveedor)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(o => o.CentroCosto)
                .WithMany()
                .HasForeignKey(o => o.IdCentroCosto)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(o => o.CuentaContable)
                .WithMany()
                .HasForeignKey(o => o.IdCuentaContable)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Property(o => o.IdMoneda).HasColumnName("id_moneda");
            builder.Property(o => o.TipoCambioAplicado)
                .HasColumnName("tipo_cambio_aplicado")
                .HasPrecision(18, 6)
                .HasDefaultValue(1m);

            builder.HasOne(o => o.Moneda)
                .WithMany()
                .HasForeignKey(o => o.IdMoneda)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
