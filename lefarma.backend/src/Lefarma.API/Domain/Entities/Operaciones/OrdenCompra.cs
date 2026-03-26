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
        public int IdFormaPago { get; set; }
        public int IdUsuarioCreador { get; set; }

        public EstadoOC Estado { get; set; } = EstadoOC.Creada;
        public int? IdPasoActual { get; set; }  // FK lógica a config.workflow_pasos

        // Proveedor
        public bool SinDatosFiscales { get; set; }
        public string RazonSocialProveedor { get; set; } = null!;
        public string? RfcProveedor { get; set; }
        public string? CodigoPostalProveedor { get; set; }
        public int? IdRegimenFiscal { get; set; }
        public string? PersonaContacto { get; set; }
        public string? NotaFormaPago { get; set; }
        public string? NotasGenerales { get; set; }

        // Asignado en Firma 3 - CxP
        public int? IdCentroCosto { get; set; }
        public string? CuentaContable { get; set; }

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
    }
}
