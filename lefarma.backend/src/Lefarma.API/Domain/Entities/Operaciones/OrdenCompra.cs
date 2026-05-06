using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Entities.Config;

namespace Lefarma.API.Domain.Entities.Operaciones
{
    public class OrdenCompra
    {
        public int IdOrden { get; set; }
        public string Folio { get; set; } = null!;  // OC-2026-00001

        public int IdEmpresa { get; set; }
        public int IdSucursal { get; set; }
        public int IdArea { get; set; }
        public int IdTipoGasto { get; set; }
        public int IdUsuarioCreador { get; set; }

        public int IdEstado { get; set; }
        public virtual WorkflowEstados? Estado { get; set; } 

        public int IdWorkflow { get; set; }
        public int? IdPasoActual { get; set; }

        // Proveedor: FK opcional al catálogo
        public int? IdProveedor { get; set; }
        // Múltiples cuentas bancarias como JSON array, ej: "[1,2,3]"
        public string? IdsCuentasBancarias { get; set; }
        public bool SinDatosFiscales { get; set; }
        public string? NotaFormaPago { get; set; }
        public string? NotasGenerales { get; set; }

        // Asignado en Firma 3 - CxP
        public int? IdCentroCosto { get; set; }
        public int? IdCuentaContable { get; set; }

        // Moneda de la orden
        public int? IdMoneda { get; set; }
        public decimal TipoCambioAplicado { get; set; } = 1m;  // congelado al momento de crear

        // Navegación a catálogos 
        public virtual Proveedor? Proveedor { get; set; }
        public virtual CentroCosto? CentroCosto { get; set; }
        public virtual CuentaContable? CuentaContable { get; set; }
        public virtual Moneda? Moneda { get; set; }
        public virtual Empresa? Empresa { get; set; }
        public virtual Sucursal? Sucursal { get; set; }
        public virtual Area? Area { get; set; }

        // Configurado en Firma 4 - GAF
        public bool RequiereComprobacionPago { get; set; } = true;
        public bool RequiereComprobacionGasto { get; set; } = true;

        public DateTime FechaSolicitud { get; set; }
        public DateTime FechaLimitePago { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
        public DateTime? FechaAutorizacion { get; set; }

        public decimal Subtotal { get; set; }
        public decimal TotalIva { get; set; }
        public decimal TotalRetenciones { get; set; }
        public decimal TotalOtrosImpuestos { get; set; }
        public decimal Total { get; set; }

        public virtual ICollection<OrdenCompraPartida> Partidas { get; set; } = new List<OrdenCompraPartida>();
        public virtual ICollection<Pago> Pagos { get; set; } = new List<Pago>();
        public virtual ICollection<Comprobacion> Comprobaciones { get; set; } = new List<Comprobacion>();
    }
}
