using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Features.OrdenesCompra.Captura.DTOs
{
    public class OrdenCompraResponse
    {
        public int IdOrden { get; set; }
        public string Folio { get; set; } = string.Empty;
        public int IdEmpresa { get; set; }
        public int IdSucursal { get; set; }
        public int IdArea { get; set; }
        public int IdTipoGasto { get; set; }
        public int? IdProveedor { get; set; }
        public List<int>? IdsCuentasBancarias { get; set; }
        public string Estado { get; set; } = string.Empty;
        public int? IdPasoActual { get; set; }
        public bool SinDatosFiscales { get; set; }
        public string? NotaFormaPago { get; set; }
        public string? NotasGenerales { get; set; }
        public int? IdCentroCosto { get; set; }
        public string? CentroCostoNombre { get; set; }
        public int? IdCuentaContable { get; set; }
        public string? CuentaContableNumero { get; set; }
        public string? CuentaContableDescripcion { get; set; }
        public bool RequiereComprobacionPago { get; set; }
        public bool RequiereComprobacionGasto { get; set; }
        public DateTime FechaSolicitud { get; set; }
        public DateTime FechaLimitePago { get; set; }
        public decimal Subtotal { get; set; }
        public decimal TotalIva { get; set; }
        public decimal Total { get; set; }
        public int? IdMoneda { get; set; }
        public string? MonedaCodigo { get; set; }
        public string? MonedaSimbolo { get; set; }
        public decimal TipoCambioAplicado { get; set; }
        public List<OrdenCompraPartidaResponse> Partidas { get; set; } = new();
    }

    public class OrdenCompraRequest
    {
        public int? IdEmpresa { get; set; }
        public int? IdSucursal { get; set; }
        public EstadoOC? Estado { get; set; }
        public string? OrderBy { get; set; } = "FechaCreacion";
        public string? OrderDirection { get; set; } = "desc";
    }

    public class CreateOrdenCompraRequest
    {
        public int? IdOrden { get; set; }
        public required int IdEmpresa { get; set; }
        public required int IdSucursal { get; set; }
        public required int IdArea { get; set; }
        public required int IdTipoGasto { get; set; }
        public required DateTime FechaLimitePago { get; set; }
        public int? IdProveedor { get; set; }
        public List<int>? IdsCuentasBancarias { get; set; }
        public bool SinDatosFiscales { get; set; }
        public string? NotaFormaPago { get; set; }
        public string? NotasGenerales { get; set; }
        public int? IdMoneda { get; set; }
        public decimal TipoCambioAplicado { get; set; } = 1m;
        public required List<CreatePartidaRequest> Partidas { get; set; }
    }

    public class OrdenCompraPartidaResponse
    {
        public int IdPartida { get; set; }
        public int NumeroPartida { get; set; }
        public string Descripcion { get; set; } = string.Empty;
        public decimal Cantidad { get; set; }
        public int IdUnidadMedida { get; set; }
        public decimal PrecioUnitario { get; set; }
        public decimal Descuento { get; set; }
        public decimal PorcentajeIva { get; set; }
        public decimal TotalRetenciones { get; set; }
        public decimal OtrosImpuestos { get; set; }
        public bool Deducible { get; set; }
        public decimal Total { get; set; }
        public int? IdProveedor { get; set; }
        public string? IdsCuentasBancarias { get; set; }
        public bool RequiereFactura { get; set; } = true;
        public string? TipoComprobante { get; set; }
        public decimal? CantidadFacturada { get; set; }
        public decimal? ImporteFacturado { get; set; }
        public byte EstadoFacturacion { get; set; }
    }

    public class CreatePartidaRequest
    {
        public required string Descripcion { get; set; }
        public required decimal Cantidad { get; set; }
        public required int IdUnidadMedida { get; set; }
        public required decimal PrecioUnitario { get; set; }
        public decimal Descuento { get; set; }
        public decimal PorcentajeIva { get; set; } = 16;
        public decimal TotalRetenciones { get; set; }
        public decimal OtrosImpuestos { get; set; }
        public bool Deducible { get; set; } = true;
        public int? IdProveedor { get; set; }
        public string? IdsCuentasBancarias { get; set; }
        public bool RequiereFactura { get; set; } = true;
        public string? TipoComprobante { get; set; }
    }
}
